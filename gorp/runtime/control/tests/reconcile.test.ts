import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";
import { EXIT_CODES } from "../src/errors/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { loadConfig, graphAuditChainPath } from "../src/config/index.js";
import { compileGraph } from "../src/compiler/graph-compiler.js";
import { computeGraphDrift } from "../src/compiler/drift.js";
import { loadChain } from "../src/audit/chain.js";
import type { Clock } from "../src/graph/graph.js";

const clock: Clock = { now: () => "2026-08-14T16:00:00.000Z" };
const BASE = "1234567890abcdef1234567890abcdef12345678";
let stateHome: string;
let sprintPath: string;
let sprintV2Path: string;

function task(taskId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taskId,
    objective: `write ${taskId}`,
    acceptanceCriteria: ["artifact exists"],
    dependencies: [],
    scope: { allowedPaths: ["docs/**"], forbiddenPaths: ["secrets/**"] },
    gates: [{ executable: "git", args: ["--version"] }],
    expectedArtifacts: [`docs/${taskId}.md`],
    worker: "fixture",
    review: "fixture-auto",
    maxAttempts: 1,
    escalation: "operator",
    ...over,
  };
}

function sprintDoc(tasks: unknown[]): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sprintId: "sprint-recon",
    project: { projectId: "p1" },
    approvedBy: "operator:test",
    approvedAt: "2026-08-14T15:00:00.000Z",
    tasks,
  };
}

// sprint v1 (compiled graph): t1..t4. t2→t1, t3→t1, t4→t2.
const v1 = () =>
  sprintDoc([
    task("t1"),
    task("t2", { dependencies: ["t1"] }),
    task("t3", { dependencies: ["t1"] }),
    task("t4", { dependencies: ["t2"] }),
  ]);

// sprint v2 (desired state): t1 scope changed, t4 removed, t3 dependency
// corrected to t2, t5 added (depends on t3).
const v2 = () =>
  sprintDoc([
    task("t1", { scope: { allowedPaths: ["docs/**", "src/**"], forbiddenPaths: ["secrets/**"] } }),
    task("t2", { dependencies: ["t1"] }),
    task("t3", { dependencies: ["t2"] }),
    task("t5", { dependencies: ["t3"] }),
  ]);

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-reconcile-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  sprintPath = join(stateHome, "sprint.json");
  sprintV2Path = join(stateHome, "sprint-v2.json");
  writeFileSync(sprintPath, JSON.stringify(v1(), null, 2));
  writeFileSync(sprintV2Path, JSON.stringify(v2(), null, 2));

  // Seed a compiled graph directly (no git needed — baseCommit is explicit).
  const graph = compileGraph(JSON.parse(readFileSync(sprintPath, "utf8")), { baseCommit: BASE, clock });
  new GraphStore(loadConfig()).save(graph);
});

afterEach(() => {
  delete process.env["GORP_STATE_HOME"];
  delete process.env["GORP_PROJECT_REGISTRY"];
  rmSync(stateHome, { recursive: true, force: true });
});

function reconcileArgs(extra: string[] = []): string[] {
  return ["reconcile", "--project-id", "p1", "--graph-id", "sprint-recon", "--from", sprintV2Path, ...extra];
}

describe("reconcile (GOS-43): desired-state drift", () => {
  it("drift scenario: readable diff with task/dependency/status deltas", () => {
    const cfg = loadConfig();
    const graph = new GraphStore(cfg).load("p1", "sprint-recon");
    const diff = computeGraphDrift(graph, JSON.parse(readFileSync(sprintV2Path, "utf8")));

    // task deltas
    expect(diff.added).toEqual(["t5"]);
    expect(diff.removed).toEqual(["t4"]);

    // scope/status delta: t1's scope changed
    expect(diff.tasksChanged).toHaveLength(1);
    expect(diff.tasksChanged[0]!.taskId).toBe("t1");
    const scopeChange = diff.tasksChanged[0]!.changes.find((c) => c.field === "allowedPaths");
    expect(scopeChange).toBeDefined();

    // dependency deltas: t3's dependency corrected from t1 to t2
    expect(diff.dependenciesChanged).toHaveLength(1);
    expect(diff.dependenciesChanged[0]!.taskId).toBe("t3");
    expect(diff.dependenciesChanged[0]!.removed).toEqual(["t1"]);
    expect(diff.dependenciesChanged[0]!.added).toEqual(["t2"]);

    // status deltas: graph node states surfaced
    expect(diff.nodeStates).toEqual({ t1: "pending", t2: "pending", t3: "pending", t4: "pending" });
    expect(diff.hasDrift).toBe(true);
  });

  it("report (no --adopt/--regenerate) is read-only: graph file unchanged", async () => {
    const cfg = loadConfig();
    const before = readFileSync(join(stateHome, "projects", "p1", "graphs", "sprint-recon.json"), "utf8");

    const { result, exitCode } = await runCli(reconcileArgs(), clock);
    expect(exitCode).toBe(EXIT_CODES.OK);
    if (result.success) {
      expect(result.command).toBe("reconcile");
      const data = result.data as { action: string; drift: { hasDrift: boolean } };
      expect(data.action).toBe("report");
      expect(data.drift.hasDrift).toBe(true);
    }

    const after = readFileSync(join(stateHome, "projects", "p1", "graphs", "sprint-recon.json"), "utf8");
    expect(after).toBe(before);
  });

  it("running graph: mutation refused, report still read-only", async () => {
    // draft -> approved -> running
    await runCli(
      ["graph", "transition", "--project-id", "p1", "--graph-id", "sprint-recon",
       "--to", "approved", "--actor-type", "operator", "--actor-id", "op",
       "--reason-code", "OPERATOR_APPROVAL", "--reason", "approved"],
      clock,
    );
    await runCli(
      ["graph", "transition", "--project-id", "p1", "--graph-id", "sprint-recon",
       "--to", "running", "--actor-type", "orchestrator", "--actor-id", "sched",
       "--reason-code", "ORCHESTRATION_STARTED", "--reason", "start"],
      clock,
    );

    const before = readFileSync(join(stateHome, "projects", "p1", "graphs", "sprint-recon.json"), "utf8");

    // report works on a running graph
    const report = await runCli(reconcileArgs(), clock);
    expect(report.exitCode).toBe(EXIT_CODES.OK);
    if (report.result.success) {
      expect((report.result.data as { action: string }).action).toBe("report");
    }

    // mutation is refused
    const adopt = await runCli(reconcileArgs(["--adopt"]), clock);
    expect(adopt.exitCode).toBe(EXIT_CODES.STATE_CONFLICT);
    expect(adopt.result.success).toBe(false);

    const after = readFileSync(join(stateHome, "projects", "p1", "graphs", "sprint-recon.json"), "utf8");
    expect(after).toBe(before);
  });

  it("--adopt: rewrites graph and writes an audited reconcile record", async () => {
    const { result, exitCode } = await runCli(reconcileArgs(["--adopt", "--actor-id", "operator:me"]), clock);
    expect(exitCode).toBe(EXIT_CODES.OK);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as { action: string; toGraphId: string };
      expect(data.action).toBe("adopt");
      expect(data.toGraphId).toBe("sprint-recon");
    }

    // graph now reflects desired state: t1, t2, t3, t5 (t4 removed)
    const graph = new GraphStore(loadConfig()).load("p1", "sprint-recon");
    expect(graph.nodes.map((n) => n.nodeId)).toEqual(["t1", "t2", "t3", "t5"]);
    expect(graph.status).toBe("draft");

    // audit chain has a graph-reconcile entry
    const chainPath = graphAuditChainPath(loadConfig(), "p1", "sprint-recon");
    expect(existsSync(chainPath)).toBe(true);
    const chain = loadChain(chainPath);
    expect(chain.length).toBeGreaterThan(0);
    const entry = chain[chain.length - 1]!;
    expect(entry.event).toBe("graph-reconcile");
    expect(entry.ref).toBe("sprint-recon-reconcile.json");

    // audit record persisted + captures drift
    const recordPath = join(stateHome, "projects", "p1", "graphs", "sprint-recon-reconcile.json");
    expect(existsSync(recordPath)).toBe(true);
    const record = JSON.parse(readFileSync(recordPath, "utf8")) as { kind: string; fromGraphId: string; toGraphId: string; drift: { added: string[] } };
    expect(record.kind).toBe("adopt");
    expect(record.fromGraphId).toBe("sprint-recon");
    expect(record.toGraphId).toBe("sprint-recon");
    expect(record.drift.added).toEqual(["t5"]);
  });

  it("--regenerate: writes a fresh graph id and audit record; original untouched", async () => {
    const before = readFileSync(join(stateHome, "projects", "p1", "graphs", "sprint-recon.json"), "utf8");

    const { result, exitCode } = await runCli(reconcileArgs(["--regenerate", "--actor-id", "operator:me"]), clock);
    expect(exitCode).toBe(EXIT_CODES.OK);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as { action: string; toGraphId: string };
      expect(data.action).toBe("regenerate");
      expect(data.toGraphId).not.toBe("sprint-recon");
    }

    // original graph untouched
    const after = readFileSync(join(stateHome, "projects", "p1", "graphs", "sprint-recon.json"), "utf8");
    expect(after).toBe(before);

    // fresh graph exists and reflects desired state
    const newId = (result.success ? (result.data as { toGraphId: string }).toGraphId : "never");
    const fresh = new GraphStore(loadConfig()).load("p1", newId);
    expect(fresh.nodes.map((n) => n.nodeId)).toEqual(["t1", "t2", "t3", "t5"]);
    expect(fresh.status).toBe("draft");

    // audit chain exists for the fresh graph
    const chainPath = graphAuditChainPath(loadConfig(), "p1", newId);
    expect(existsSync(chainPath)).toBe(true);
    expect(loadChain(chainPath).map((e) => e.event)).toEqual(["graph-reconcile"]);
  });

  it("--adopt and --regenerate together are rejected", async () => {
    const { result, exitCode } = await runCli(reconcileArgs(["--adopt", "--regenerate"]), clock);
    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGUMENT);
    expect(result.success).toBe(false);
  });
});
