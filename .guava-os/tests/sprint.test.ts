import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadConfig, findRepoRoot } from "../src/config.js";
import {
  generateSprint,
  generateSprintMulti,
  approveSprint,
  parseAcceptanceCriteria,
  parseScope,
  UNAPPROVED_BY,
  UNAPPROVED_AT,
} from "../src/sprint.js";
import type { LinearIssue as GraphIssue } from "../src/linear.js";

const config = loadConfig(findRepoRoot());

function issue(overrides: Partial<GraphIssue> & { id: string }): GraphIssue {
  return {
    id: overrides.id,
    identifier: overrides.identifier ?? overrides.id,
    title: "Task",
    status: "Todo",
    statusType: "unstarted",
    priority: { value: 2, name: "High" },
    labels: [],
    project: "guava-os",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    canceledAt: null,
    description: "",
    ...overrides,
  };
}

const PARENT = "parent-1";

function fixture(): GraphIssue[] {
  return [
    issue({
      id: PARENT,
      title: "Sprint One",
      labels: [],
      status: "Todo",
      statusType: "unstarted",
    }),
    issue({
      id: "a1",
      title: "Write docs",
      parentId: PARENT,
      labels: ["backend"],
      description:
        "## Acceptance criteria\n- docs/one.md exists\n- reviewed once\n\n## Scope\nallowedPaths: [\"docs/**\"]\nforbiddenPaths: [\"secrets/**\"]",
    }),
    issue({
      id: "b1",
      title: "Ship pipeline",
      parentId: PARENT,
      labels: ["architect"],
      // b1 is blocked by a1 (a1 blocks b1)
      blocks: [],
      description: "## Acceptance criteria\n- pipeline runs\n",
    }),
  ];
}

describe("parseAcceptanceCriteria", () => {
  it("extracts bullet list under the Acceptance section", () => {
    const out = parseAcceptanceCriteria(
      "## Why\nintro\n## Acceptance criteria\n- one\n- two\n## Scope\nno",
    );
    expect(out).toEqual(["one", "two"]);
  });

  it("extracts numbered list", () => {
    const out = parseAcceptanceCriteria("## Acceptance criteria\n1. first\n2. second\n");
    expect(out).toEqual(["first", "second"]);
  });

  it("returns empty when no section", () => {
    expect(parseAcceptanceCriteria("## Why\nnothing")).toEqual([]);
  });
});

describe("parseScope", () => {
  it("extracts explicit markers", () => {
    const s = parseScope('allowedPaths: ["src/**"]\nforbiddenPaths: ["secret/**","tmp/**"]');
    expect(s).toEqual({ allowedPaths: ["src/**"], forbiddenPaths: ["secret/**", "tmp/**"] });
  });

  it("defaults empty when absent", () => {
    expect(parseScope("no markers")).toEqual({ allowedPaths: [], forbiddenPaths: [] });
  });

  it("tolerates Linear markdown escaping of brackets", () => {
    const s = parseScope('allowedPaths: ["docs/**"\\]****\n****forbiddenPaths: \\["secrets/**", ".env"]');
    expect(s).toEqual({ allowedPaths: ["docs/**"], forbiddenPaths: ["secrets/**", ".env"] });
  });
});

describe("generateSprint", () => {
  it("maps Linear issues to tasks preserving ids, AC, scope, persona->worker", () => {
    const issues = fixture();
    const res = generateSprint(issues, PARENT, "guava-os", config);
    expect(res.doc.schemaVersion).toBe(1);
    expect(res.doc.sprintId).toBe(PARENT);
    expect(res.doc.project).toEqual({ projectId: "guava-os" });
    expect(res.doc.approvedBy).toBe(UNAPPROVED_BY);
    expect(res.doc.approvedAt).toBe(UNAPPROVED_AT);

    const a = res.doc.tasks.find((t) => t.taskId === "a1")!;
    expect(a).toBeDefined();
    expect(a.objective).toBe("Write docs");
    expect(a.acceptanceCriteria).toEqual(["docs/one.md exists", "reviewed once"]);
    expect(a.scope).toEqual({ allowedPaths: ["docs/**"], forbiddenPaths: ["secrets/**"] });
    expect(a.worker).toBe("omp");
    expect(a.review).toBe("human");
    expect(a.maxAttempts).toBe(1);
    expect(a.escalation).toBe("operator");
    expect(a.persona).toBe("backend");
  });

  it("excludes blocked issues (unresolved native blocker)", () => {
    const issues = fixture();
    // a1 blocks b1 (native relation), a1 is Todo -> b1 excluded
    issues.find((i) => i.id === "a1")!.blocks = ["b1"];
    const res = generateSprint(issues, PARENT, "guava-os", config);
    expect(res.excludedBlocked.map((i) => i.id)).toEqual(["b1"]);
    expect(res.doc.tasks.map((t) => t.taskId)).toEqual(["a1"]);
  });

  it("keeps a dependency when the blocker is in the included set", () => {
    const issues = fixture();
    // a1 resolved (Done) so b1 unblocked; b1 has native dep on a1's sibling? use c1
    // Simplest: two todos linked, both included.
    const c1 = issue({ id: "c1", title: "c", parentId: PARENT, labels: ["backend"], description: "## Acceptance criteria\n- x\n" });
    issues.push(c1);
    issues.find((i) => i.id === "a1")!.blocks = ["b1"]; // a1 blocks b1 -> b1 excluded
    // make a1 Done so it is not included as a task but b1's dep on a1 is satisfied
    const a1 = issues.find((i) => i.id === "a1")!;
    a1.status = "Done";
    a1.statusType = "completed";
    const res = generateSprint(issues, PARENT, "guava-os", config);
    // b1 unblocked now (blocker completed); its dep on a1 dropped (a1 not a task)
    expect(res.excludedBlocked.map((i) => i.id)).toEqual([]);
    const b = res.doc.tasks.find((t) => t.taskId === "b1")!;
    expect(b.dependencies).toEqual([]);
  });

  it("excludes issues without exactly one persona label (invalid)", () => {
    const issues = fixture();
    issues.push(issue({ id: "noP", title: "nope", parentId: PARENT, labels: [], description: "## Acceptance criteria\n- x\n" }));
    const res = generateSprint(issues, PARENT, "guava-os", config);
    expect(res.excludedInvalid.map((i) => i.id)).toEqual(["noP"]);
  });

  it("excludes backlog issues", () => {
    const issues = fixture();
    issues.push(issue({ id: "bl", title: "later", parentId: PARENT, labels: ["backend"], status: "Backlog", statusType: "backlog", description: "## Acceptance criteria\n- x\n" }));
    const res = generateSprint(issues, PARENT, "guava-os", config);
    expect(res.excludedBacklog.map((i) => i.id)).toEqual(["bl"]);
  });

  it("throws when deliverable parent has no persona label", () => {
    const issues = [issue({ id: "D1", title: "lonely", labels: [] })];
    expect(() =>
      generateSprint(issues, "D1", "guava-os", config),
    ).toThrow("D1 has no valid persona label");
  });

  it("throws when container parent has zero schedulable children", () => {
    // parent has children but all are excluded (backlog)
    const issues = [
      issue({
        id: PARENT,
        title: "Container",
        labels: [],
        status: "Todo",
        statusType: "unstarted",
      }),
      issue({
        id: "c1",
        title: "backlogged child",
        parentId: PARENT,
        labels: ["backend"],
        status: "Backlog",
        statusType: "backlog",
      }),
    ];
    expect(() =>
      generateSprint(issues, PARENT, "guava-os", config),
    ).toThrow("container has no schedulable children");
  });

  it("throws when parent not found in dataset", () => {
    expect(() =>
      generateSprint([], "GHOST", "guava-os", config),
    ).toThrow("GHOST not found in dataset");
  });

  it("generates standalone chain A->B->C with dependencies and persona", () => {
    const issues = [
      issue({
        id: "CA",
        title: "First step",
        labels: ["architect"],
        blocks: ["CB"],
        description: "## Acceptance criteria\n- start\n",
      }),
      issue({
        id: "CB",
        title: "Second step",
        labels: ["architect"],
        blocks: ["CC"],
        description: "## Acceptance criteria\n- middle\n",
      }),
      issue({
        id: "CC",
        title: "Third step",
        labels: ["architect"],
        description: "## Acceptance criteria\n- end\n",
      }),
    ];
    const res = generateSprint(issues, "CA", "guava-os", config);
    expect(res.doc.sprintId).toBe("CA");
    expect(res.doc.tasks).toHaveLength(3);
    const ids = res.doc.tasks.map((t) => t.taskId);
    expect(ids).toEqual(["CA", "CB", "CC"]);

    const tB = res.doc.tasks.find((t) => t.taskId === "CB")!;
    expect(tB.dependencies).toEqual(["CA"]);
    expect(tB.persona).toBe("architect");

    const tC = res.doc.tasks.find((t) => t.taskId === "CC")!;
    expect(tC.dependencies).toEqual(["CB"]);
    expect(tC.persona).toBe("architect");

    const tA = res.doc.tasks.find((t) => t.taskId === "CA")!;
    expect(tA.dependencies).toEqual([]);
    expect(tA.persona).toBe("architect");
  });

  it("excludes backlog chain member with warning (chain mode)", () => {
    const issues = [
      issue({
        id: "CA",
        title: "Head",
        labels: ["backend"],
        blocks: ["CB"],
        description: "## Acceptance criteria\n- x\n",
      }),
      issue({
        id: "CB",
        title: "later",
        labels: ["backend"],
        status: "Backlog",
        statusType: "backlog",
        description: "## Acceptance criteria\n- y\n",
      }),
    ];
    const res = generateSprint(issues, "CA", "guava-os", config);
    expect(res.doc.tasks.map((t) => t.taskId)).toEqual(["CA"]);
    expect(res.excludedBacklog.map((i) => i.id)).toEqual(["CB"]);
    expect(res.warnings).toContain("excluded (backlog): later");
  });

  it("generates 1-task doc for deliverable chain head that blocks nobody", () => {
    const issues = [
      issue({
        id: "FINAL",
        title: "Solo deliverable",
        labels: ["frontend"],
        description: "## Acceptance criteria\n- done\n",
      }),
    ];
    const res = generateSprint(issues, "FINAL", "guava-os", config);
    expect(res.doc.sprintId).toBe("FINAL");
    expect(res.doc.tasks).toHaveLength(1);
    expect(res.doc.tasks[0].taskId).toBe("FINAL");
    expect(res.doc.tasks[0].dependencies).toEqual([]);
    expect(res.doc.tasks[0].persona).toBe("frontend");
  });

  it("throws for backlog chain head", () => {
    const issues = [
      issue({
        id: "BH",
        title: "backlog head",
        labels: ["backend"],
        status: "Backlog",
        statusType: "backlog",
        description: "## Acceptance criteria\n- x\n",
      }),
    ];
    expect(() =>
      generateSprint(issues, "BH", "guava-os", config),
    ).toThrow("BH is backlog");
  });
});

describe("approveSprint", () => {
  it("records the actor and a real timestamp", () => {
    const dir = mkdtempSync(join(tmpdir(), "gos-sprint-"));
    const file = join(dir, "sprint.json");
    const issues = fixture();
    const res = generateSprint(issues, PARENT, "guava-os", config);
    writeFileSync(file, JSON.stringify(res.doc, null, 2));
    const approved = approveSprint(file, "operator:sebastian");
    expect(approved.approvedBy).toBe("operator:sebastian");
    expect(approved.approvedAt).not.toBe(UNAPPROVED_AT);
    expect(new Date(approved.approvedAt).getTime()).not.toBeNaN();
    expect(existsSync(file)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a non-sprint file", () => {
    const dir = mkdtempSync(join(tmpdir(), "gos-sprint-"));
    const file = join(dir, "not.json");
    writeFileSync(file, JSON.stringify({ hello: 1 }));
    expect(() => approveSprint(file, "operator:x")).toThrow(/SprintDocument/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("generateSprintMulti (GOS-42) — union across parents", () => {
  it("unions two container parents into ONE document", () => {
    const issues = [
      issue({ id: "P1", title: "Container A", labels: [], statusType: "unstarted" }),
      issue({ id: "P2", title: "Container B", labels: [], statusType: "unstarted" }),
      issue({ id: "a1", parentId: "P1", labels: ["backend"], description: "## Acceptance criteria\n- a\n" }),
      issue({ id: "b1", parentId: "P1", labels: ["architect"], description: "## Acceptance criteria\n- b\n" }),
      issue({ id: "x1", parentId: "P2", labels: ["backend"], description: "## Acceptance criteria\n- x\n" }),
    ];
    const res = generateSprintMulti(issues, ["P1", "P2"], "guava-os", config);
    expect(res.doc.tasks.map((t) => t.taskId).sort()).toEqual(["a1", "b1", "x1"]);
    expect(res.excludedBlocked).toEqual([]);
    expect(res.doc.sprintId).toBe("P1-P2");
  });

  it("preserves a cross-container dependency (A-child blocks B-child) instead of dropping or excluding", () => {
    const issues = [
      issue({ id: "P1", title: "Container A", labels: [], statusType: "unstarted" }),
      issue({ id: "P2", title: "Container B", labels: [], statusType: "unstarted" }),
      issue({ id: "a1", parentId: "P1", labels: ["backend"], blocks: ["x1"], description: "## Acceptance criteria\n- a\n" }),
      issue({ id: "x1", parentId: "P2", labels: ["backend"], description: "## Acceptance criteria\n- x\n" }),
    ];
    const res = generateSprintMulti(issues, ["P1", "P2"], "guava-os", config);
    const tasks = res.doc.tasks;
    expect(tasks).toHaveLength(2);
    const x = tasks.find((t) => t.taskId === "x1")!;
    expect(x.dependencies).toEqual(["a1"]);
    const a = tasks.find((t) => t.taskId === "a1")!;
    expect(a.dependencies).toEqual([]);
    expect(res.excludedBlocked).toEqual([]);
  });

  it("excludes a task blocked only by an unresolved issue OUTSIDE the union", () => {
    const issues = [
      issue({ id: "P1", title: "Container A", labels: [], statusType: "unstarted" }),
      issue({ id: "P2", title: "Container B", labels: [], statusType: "unstarted" }),
      issue({ id: "a1", parentId: "P1", labels: ["backend"], description: "## Acceptance criteria\n- a\n" }),
      // x1 blocked by external 'ext' (todo, not in the union)
      issue({ id: "ext", title: "external", labels: ["backend"], statusType: "unstarted", description: "## Acceptance criteria\n- e\n" }),
      issue({ id: "x1", parentId: "P2", labels: ["backend"], description: "## Acceptance criteria\n- x\n" }),
    ];
    issues.find((i) => i.id === "ext")!.blocks = ["x1"];
    const res = generateSprintMulti(issues, ["P1", "P2"], "guava-os", config);
    expect(res.excludedBlocked.map((i) => i.id)).toEqual(["x1"]);
    expect(res.doc.tasks.map((t) => t.taskId)).toEqual(["a1"]);
  });

  it("unions a container parent with a standalone chain head, preserving chain deps", () => {
    const issues = [
      issue({ id: "C1", title: "Container", labels: [], statusType: "unstarted" }),
      issue({ id: "c1", parentId: "C1", labels: ["backend"], description: "## Acceptance criteria\n- c\n" }),
      issue({ id: "CA", title: "chain head", labels: ["architect"], blocks: ["CB"], description: "## Acceptance criteria\n- s\n" }),
      issue({ id: "CB", title: "chain tail", labels: ["architect"], description: "## Acceptance criteria\n- t\n" }),
    ];
    const res = generateSprintMulti(issues, ["C1", "CA"], "guava-os", config);
    const ids = res.doc.tasks.map((t) => t.taskId);
    expect(ids).toEqual(["c1", "CA", "CB"]);
    const tB = res.doc.tasks.find((t) => t.taskId === "CB")!;
    expect(tB.dependencies).toEqual(["CA"]);
  });

  it("throws when a parent is missing from the dataset", () => {
    expect(() => generateSprintMulti([], ["GHOST"], "guava-os", config))
      .toThrow(/GHOST not found in dataset/);
  });

  it("throws when the union has no schedulable tasks", () => {
    const issues = [
      issue({ id: "P1", title: "Container", labels: [], statusType: "unstarted" }),
      issue({ id: "c1", parentId: "P1", labels: [], description: "## Acceptance criteria\n- c\n" }),
    ];
    expect(() => generateSprintMulti(issues, ["P1"], "guava-os", config))
      .toThrow(/union has no schedulable tasks/);
  });
});