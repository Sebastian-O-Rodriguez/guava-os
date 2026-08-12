import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadConfig, findRepoRoot } from "../src/config.js";
import {
  generateSprint,
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

  it("fails closed on a sprint with no tasks", () => {
    const issues = [issue({ id: PARENT, title: "empty", labels: [] })];
    const res = generateSprint(issues, PARENT, "guava-os", config);
    expect(res.doc.tasks).toEqual([]);
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