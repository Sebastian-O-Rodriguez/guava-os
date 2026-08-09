import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { compileGraph } from "../src/compiler/graph-compiler.js";
import { serializeDeterministic } from "../src/storage/serialize.js";
import { validateAgainst } from "../src/contracts/validator.js";
import { GorpError } from "../src/errors/index.js";
import type { Clock } from "../src/graph/graph.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const CLI = join(PKG, "dist", "cli", "main.js");
const clock: Clock = { now: () => "2026-07-17T16:00:00.000Z" };
const BASE = "1234567890abcdef1234567890abcdef12345678";

let stateHome: string;
let repo: string;

beforeAll(() => {
  execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: PKG, stdio: "pipe" });
}, 120_000);

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function task(taskId: string, artifact: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taskId,
    objective: `write ${artifact}`,
    acceptanceCriteria: ["artifact exists"],
    dependencies: [],
    scope: { allowedPaths: ["docs/**"], forbiddenPaths: ["secrets/**"] },
    gates: [{ executable: "git", args: ["--version"] }],
    expectedArtifacts: [artifact],
    worker: "fixture",
    review: "fixture-auto",
    maxAttempts: 1,
    escalation: "operator",
    ...over,
  };
}

function sprint(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sprintId: "sprint-t1",
    project: { projectId: "p1" },
    approvedBy: "operator:test",
    approvedAt: "2026-07-17T15:00:00.000Z",
    tasks: [task("t1", "docs/one.md"), task("t2", "docs/two.md", { dependencies: ["t1"] })],
    ...over,
  };
}

function expectReject(doc: unknown, reasonIncludes: string): GorpError {
  let err: GorpError | null = null;
  try {
    compileGraph(doc, { baseCommit: BASE, clock });
  } catch (e) {
    err = e as GorpError;
  }
  expect(err, `expected graph compiler rejection (${reasonIncludes})`).not.toBeNull();
  expect(err!.code).toBe("INVALID_ARGUMENT");
  expect(String(err!.details["compilerRejection"])).toContain(reasonIncludes);
  return err!;
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-plan-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  repo = mkdtempSync(join(tmpdir(), "gorp-plan-repo-"));
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# consumer\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
  registerProjects({ p1: repo });
});
afterEach(() => {
  delete process.env["GORP_STATE_HOME"];
  delete process.env["GORP_PROJECT_REGISTRY"];
  rmSync(stateHome, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("planner: approved sprint -> deterministic draft graph", () => {
  it("good sprint: schema-valid draft graph with tasks, deps, scope, gates mapped 1:1", () => {
    const graph = compileGraph(sprint(), { baseCommit: BASE, clock });
    expect(validateAgainst("execution-graph", graph).valid).toBe(true);
    expect(graph.status).toBe("draft"); // planner approves NOTHING
    expect(graph.approvalStatus).toBe("unapproved");
    expect(graph.graphId).toBe("sprint-t1");
    expect(graph.nodes.map((n) => n.nodeId)).toEqual(["t1", "t2"]);
    expect(graph.nodes[1]!.dependencies).toEqual(["t1"]);
    expect(graph.nodes[0]!.allowedPaths).toEqual(["docs/**"]);
    expect(graph.nodes[0]!.requiredCommands).toEqual([{ executable: "git", args: ["--version"] }]);
    expect(graph.nodes.every((n) => n.state === "pending" && n.attempt === 0)).toBe(true);
    expect(graph.provenance.createdBy).toBe("operator:test");
    expect(graph.provenance.source).toContain("graph-compiler: sprint sprint-t1");
  });

  it("same input = same graph (byte-identical, twice)", () => {
    const a = serializeDeterministic(compileGraph(sprint(), { baseCommit: BASE, clock }));
    const b = serializeDeterministic(compileGraph(sprint(), { baseCommit: BASE, clock }));
    expect(a).toBe(b);
  });

  it("bad sprints are rejected, never repaired", () => {
    expectReject({ nonsense: true }, "schema validation");
    expectReject(sprint({ tasks: [task("t1", "a.md"), task("t1", "b.md")] }), "duplicate taskId");
    expectReject(sprint({ tasks: [task("t1", "a.md", { dependencies: ["ghost"] })] }), "unknown task");
    expectReject(sprint({ tasks: [task("t1", "a.md", { dependencies: ["t1"] })] }), "depends on itself");
    const err = expectReject(
      sprint({
        tasks: [
          task("t1", "a.md", { dependencies: ["t2"] }),
          task("t2", "b.md", { dependencies: ["t1"] }),
        ],
      }),
      "cycle",
    );
    expect(err.details["cyclicTasks"]).toEqual(["t1", "t2"]);
    expectReject(sprint({ tasks: [task("t1", "a.md", { worker: "gpt-magic" })] }), "unregistered adapter");
    expectReject(
      sprint({ tasks: [task("t1", "a.md", { worker: "omp", review: "fixture-auto" })] }),
      "only legal for the deterministic fixture worker",
    );
    // capability lies die at the schema: retries and non-operator escalation
    expectReject(sprint({ tasks: [task("t1", "a.md", { maxAttempts: 3 })] }), "schema validation");
    expectReject(sprint({ tasks: [task("t1", "a.md", { escalation: "ai-supervisor" })] }), "schema validation");
  });

  it("capstone: sprint -> gorp compile-graph -> operator approval -> orchestrate -> both tasks promoted", () => {
    const sprintPath = join(stateHome, "sprint.json");
    writeFileSync(sprintPath, JSON.stringify(sprint({ sprintId: "sprint-e2e" }), null, 2));
    const env = { ...process.env, GORP_STATE_HOME: stateHome };

    // plan (draft only)
    const plan = JSON.parse(
      execFileSync(process.execPath, [CLI, "compile-graph", "--from", sprintPath], { env, encoding: "utf8" }),
    ) as { success: boolean; data: { status: string; approvalStatus: string; nodes: Array<{ nodeId: string }> } };
    expect(plan.success).toBe(true);
    expect(plan.data.status).toBe("draft");
    expect(plan.data.approvalStatus).toBe("unapproved");
    expect(plan.data.nodes.map((n) => n.nodeId)).toEqual(["t1", "t2"]);

    // the planner executed nothing: no runs, consumer untouched
    expect(existsSync(join(stateHome, "projects", "p1", "runs"))).toBe(false);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");

    // operator approval, then the existing scheduler drives it to completion
    execFileSync(
      process.execPath,
      [CLI, "graph", "transition", "--project-id", "p1", "--graph-id", "sprint-e2e",
        "--to", "approved", "--actor-type", "operator", "--actor-id", "op",
        "--reason-code", "OPERATOR_APPROVAL", "--reason", "sprint approved"],
      { env, encoding: "utf8" },
    );
    const orch = JSON.parse(
      execFileSync(process.execPath, [CLI, "orchestrate", "--project-id", "p1", "--graph-id", "sprint-e2e"], {
        env,
        encoding: "utf8",
      }),
    ) as { data: { outcome: string; nodeStates: Record<string, string> } };
    expect(orch.data.outcome).toBe("completed");
    expect(orch.data.nodeStates).toEqual({ t1: "promoted", t2: "promoted" });
    expect(existsSync(join(repo, "docs", "one.md"))).toBe(true);
    expect(existsSync(join(repo, "docs", "two.md"))).toBe(true);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
  }, 180_000);
});
