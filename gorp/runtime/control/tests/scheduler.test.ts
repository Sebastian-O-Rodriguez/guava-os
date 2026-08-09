import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The unit under test. The scheduler itself imports ONLY node builtins and
// drives the compiled CLI as subprocesses; these internal imports are used
// solely to CONSTRUCT test states (graphs, a simulated crash) and to call
// runSchedulerLoop directly with maxSteps for crash simulation.
import { runSchedulerLoop, type SchedulerResult, type StepRecord } from "../src/orchestrator/scheduler.js";
import { registerProjects, writeProjectRegistry } from "./helpers.js";
import { loadConfig, type RuntimeConfig } from "../src/config/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, applyNodeTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { executeRun } from "../src/run/run.js";
import { executeReject } from "../src/review/decision.js";
import type { GraphNode } from "../src/contracts/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const CLI = join(PKG, "dist", "cli", "main.js");

const clock: Clock = { now: () => "2026-07-16T12:00:00.000Z" };

let stateHome: string;
let repo: string;
let cfg: RuntimeConfig;

beforeAll(() => {
  execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: PKG, stdio: "pipe" });
}, 120_000);

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function node(nodeId: string, artifact: string, deps: string[] = []): GraphNode {
  return {
    nodeId,
    taskType: "fixture-mutation",
    objective: `write ${artifact}`,
    acceptanceCriteria: ["artifact exists"],
    allowedPaths: ["docs/**"],
    forbiddenPaths: ["secrets/**"],
    requiredCommands: [],
    expectedArtifacts: [artifact],
    workerAdapter: "fixture",
    dependencies: deps,
    state: "pending",
    attempt: 0,
  };
}

function approvedGraph(graphId: string, nodes: GraphNode[], repoDir = repo, home = stateHome): void {
  const localCfg = loadConfig({ GORP_STATE_HOME: home } as NodeJS.ProcessEnv);
  const store = new GraphStore(localCfg);
  const draft = buildDraftGraph(
    {
      graphId,
      project: { projectId: "p1" },
      baseCommit: git(["rev-parse", "HEAD"], repoDir).trim(),
      nodes,
      createdBy: "op",
      createdByType: "operator",
    },
    clock,
  );
  store.save(draft);
  store.update(
    applyGraphTransition(
      draft,
      { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OPERATOR_APPROVAL", reasonText: "approved" },
      clock,
    ),
  );
}

function schedule(graphId: string, opts: { maxSteps?: number; home?: string; registry?: string } = {}): SchedulerResult {
  return runSchedulerLoop({
    cli: CLI,
    projectId: "p1",
    graphId,
    env: {
      GORP_STATE_HOME: opts.home ?? stateHome,
      ...(opts.registry !== undefined ? { GORP_PROJECT_REGISTRY: opts.registry } : {}),
    },
    ...(opts.maxSteps !== undefined ? { maxSteps: opts.maxSteps } : {}),
  });
}

/** Deterministic projection of a step log (drops nothing the proof needs). */
function actionsOf(steps: readonly StepRecord[]): string[] {
  return steps.map((s) => (s.action.kind === "complete" ? "complete" : `${s.action.kind}:${s.action.nodeId}`));
}

function makeConsumer(): string {
  const dir = mkdtempSync(join(tmpdir(), "gorp-sched-repo-"));
  git(["init", "-q"], dir);
  git(["config", "user.email", "t@example.com"], dir);
  git(["config", "user.name", "t"], dir);
  writeFileSync(join(dir, "README.md"), "# consumer\n");
  git(["add", "."], dir);
  git(["commit", "-q", "-m", "init"], dir);
  return dir;
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-sched-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = makeConsumer();
  registerProjects({ p1: repo });
});
afterEach(() => {
  delete process.env["GORP_STATE_HOME"];
  delete process.env["GORP_PROJECT_REGISTRY"];
  rmSync(stateHome, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

const CHAIN_2 = (): GraphNode[] => [node("n1", "docs/one.md"), node("n2", "docs/two.md", ["n1"])];
const DAG_3 = (): GraphNode[] => [
  node("n1", "docs/base.md"),
  node("n2", "docs/left.md", ["n1"]),
  node("n3", "docs/right.md", ["n1"]),
];

const CANON_2 = ["run:n1", "approve:n1", "promote:n1", "run:n2", "approve:n2", "promote:n2", "complete"];
const CANON_3 = [
  "run:n1", "approve:n1", "promote:n1",
  "run:n2", "approve:n2", "promote:n2",
  "run:n3", "approve:n3", "promote:n3",
  "complete",
];

describe("Sprint 3A scheduler: single-process loop over the public CLI", () => {
  it("completes a 2-node chain: dependency order, no duplicate work, machine state printed", async () => {
    approvedGraph("sch-2", CHAIN_2());
    const result = schedule("sch-2");

    expect(result.outcome).toBe("completed");
    expect(result.reason).toBeNull();
    expect(result.graphStatus).toBe("completed");
    expect(result.nodeStates).toEqual({ n1: "promoted", n2: "promoted" });

    // exact canonical sequence: dependency order held, nothing repeated
    expect(actionsOf(result.steps)).toEqual(CANON_2);
    expect(result.steps.every((s) => s.ok)).toBe(true);
    // machine state: every step carries re-discovered node states
    expect(result.steps[0]!.nodeStates).toEqual({ n1: "awaiting_review", n2: "pending" });
    expect(result.steps[2]!.nodeStates).toEqual({ n1: "promoted", n2: "pending" });

    // consumer received both artifacts, clean tree, no leftover branches
    expect(existsSync(join(repo, "docs", "one.md"))).toBe(true);
    expect(existsSync(join(repo, "docs", "two.md"))).toBe(true);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
    expect(git(["branch", "--list", "gorp/run/*"], repo).trim()).toBe("");
  }, 120_000);

  it("completes a 3-node DAG in deterministic document order", async () => {
    approvedGraph("sch-3", DAG_3());
    const result = schedule("sch-3");
    expect(result.outcome).toBe("completed");
    expect(actionsOf(result.steps)).toEqual(CANON_3);
    // n2 and n3 both ran strictly after n1 was promoted (dependency order)
    const promoteN1 = actionsOf(result.steps).indexOf("promote:n1");
    expect(actionsOf(result.steps).indexOf("run:n2")).toBeGreaterThan(promoteN1);
    expect(actionsOf(result.steps).indexOf("run:n3")).toBeGreaterThan(promoteN1);
  }, 180_000);

  it("crash/restart: fresh scheduler instances (maxSteps=1) converge to the same result with zero repeated work", async () => {
    approvedGraph("sch-crash", CHAIN_2());

    const allActions: string[] = [];
    let outcome: SchedulerResult | null = null;
    for (let restarts = 0; restarts < 20; restarts++) {
      // a brand-new scheduler with NO memory of anything before
      const r = schedule("sch-crash", { maxSteps: 1 });
      allActions.push(...actionsOf(r.steps));
      if (r.outcome === "completed") {
        outcome = r;
        break;
      }
      expect(r.reason).toBe("max-steps"); // stopped only by the crash cap
    }
    expect(outcome).not.toBeNull();
    // across all restarts, the union of executed actions is EXACTLY the
    // canonical sequence: no duplicates, nothing lost
    expect(allActions).toEqual(CANON_2);
    expect(outcome!.graphStatus).toBe("completed");
    expect(outcome!.nodeStates).toEqual({ n1: "promoted", n2: "promoted" });
  }, 180_000);

  it("deterministic result: two identical graphs in isolated worlds produce identical action logs and terminal states", async () => {
    const homeB = mkdtempSync(join(tmpdir(), "gorp-sched-stateB-"));
    const repoB = makeConsumer();
    try {
      approvedGraph("sch-det", DAG_3());
      approvedGraph("sch-det", DAG_3(), repoB, homeB);
      const a = schedule("sch-det");
      const b = schedule("sch-det", { home: homeB, registry: writeProjectRegistry({ p1: repoB }) });
      expect(a.outcome).toBe("completed");
      expect(b.outcome).toBe("completed");
      expect(actionsOf(a.steps)).toEqual(actionsOf(b.steps));
      expect(a.nodeStates).toEqual(b.nodeStates);
      expect(a.steps.map((s) => s.graphStatus)).toEqual(b.steps.map((s) => s.graphStatus));
    } finally {
      rmSync(homeB, { recursive: true, force: true });
      rmSync(repoB, { recursive: true, force: true });
    }
  }, 240_000);

  it("stops on reject: graph cancelled by a rejection is reported, not fought", async () => {
    approvedGraph("sch-reject", CHAIN_2());
    await executeRun(cfg, { projectId: "p1", graphId: "sch-reject", nodeId: "n1", actorId: "orch" }, clock);
    executeReject(cfg, { projectId: "p1", graphId: "sch-reject", nodeId: "n1", actorId: "op", reason: "not wanted" }, clock);

    const result = schedule("sch-reject");
    expect(result.outcome).toBe("stopped");
    expect(result.reason).toBe("node-rejected");
    expect(result.graphStatus).toBe("cancelled");
    expect(result.stopState).toEqual({ rejectedNodes: ["n1"] });
    expect(result.steps).toEqual([]); // it did NOT try to do anything
  }, 60_000);

  it("stops on failure: an out-of-scope node fails the gate and the scheduler reports the exact error", async () => {
    approvedGraph("sch-fail", [node("n1", "src/evil.ts")]); // outside docs/** scope
    const result = schedule("sch-fail");
    expect(result.outcome).toBe("stopped");
    expect(result.reason).toBe("command-failed");
    expect(result.graphStatus).toBe("failed");
    expect(result.nodeStates).toEqual({ n1: "failed" });
    const stop = result.stopState as { failedCommand: string; nodeId: string; error: { code: string }; exitCode: number };
    expect(stop.failedCommand).toBe("run");
    expect(stop.nodeId).toBe("n1");
    expect(stop.error.code).toBe("GATE_FAILED");
    expect(stop.exitCode).toBe(13);
    // and a restarted scheduler stops immediately with graph-failed (no retry)
    const again = schedule("sch-fail");
    expect(again.reason).toBe("graph-failed");
    expect(again.steps).toEqual([]);
  }, 60_000);

  it("stops on interrupted-run with the machine-readable recovery state", async () => {
    approvedGraph("sch-interrupted", [node("n1", "docs/one.md")]);
    // simulate the mid-run crash window (node left running, no records)
    const store = new GraphStore(cfg);
    let g = store.load("p1", "sch-interrupted");
    g = applyGraphTransition(g, { to: "running", actorType: "orchestrator", actorId: "orch", reasonCode: "RUN_START", reasonText: "sim" }, clock);
    g = applyNodeTransition(g, { nodeId: "n1", to: "ready", actorType: "orchestrator", actorId: "orch", reasonCode: "NODE_ELIGIBLE", reasonText: "sim" }, clock);
    g = applyNodeTransition(g, { nodeId: "n1", to: "running", actorType: "orchestrator", actorId: "orch", reasonCode: "WORKER_START", reasonText: "sim" }, clock);
    store.update(g);

    const result = schedule("sch-interrupted");
    expect(result.outcome).toBe("stopped");
    expect(result.reason).toBe("interrupted-run");
    const stop = result.stopState as { nodeId: string; recovery: { state: string; autoRetry: boolean; requiredAction: string } };
    expect(stop.nodeId).toBe("n1");
    expect(stop.recovery.state).toBe("interrupted-run");
    expect(stop.recovery.autoRetry).toBe(false);
    expect(stop.recovery.requiredAction).toContain("operator action required");
    expect(result.steps).toEqual([]); // no guessing, no auto-retry
  }, 60_000);

  it("stops wedged (machine state, no guessing) when a pending node's dependency terminated without promotion", async () => {
    approvedGraph("sch-wedge", CHAIN_2());
    // operator cancels n1 before anything runs: n2 can never become eligible
    const store = new GraphStore(cfg);
    store.update(
      applyNodeTransition(
        store.load("p1", "sch-wedge"),
        { nodeId: "n1", to: "cancelled", actorType: "operator", actorId: "op", reasonCode: "DESCOPED", reasonText: "n1 descoped" },
        clock,
      ),
    );
    const result = schedule("sch-wedge");
    expect(result.outcome).toBe("stopped");
    expect(result.reason).toBe("wedged");
    expect((result.stopState as { nodeStates: Record<string, string> }).nodeStates).toEqual({
      n1: "cancelled",
      n2: "pending",
    });
  }, 60_000);

  it("gorp orchestrate drives the same loop end-to-end through the CLI, and is idempotent on a completed graph", async () => {
    approvedGraph("sch-cli", CHAIN_2());
    const first = execFileSync(
      process.execPath,
      [CLI, "orchestrate", "--project-id", "p1", "--graph-id", "sch-cli"],
      { env: { ...process.env, GORP_STATE_HOME: stateHome }, encoding: "utf8" },
    );
    const parsed = JSON.parse(first) as { success: boolean; data: SchedulerResult };
    expect(parsed.success).toBe(true);
    expect(parsed.data.outcome).toBe("completed");
    expect(actionsOf(parsed.data.steps)).toEqual(CANON_2);

    // re-running the orchestrator on a completed graph is a clean no-op
    const second = execFileSync(
      process.execPath,
      [CLI, "orchestrate", "--project-id", "p1", "--graph-id", "sch-cli"],
      { env: { ...process.env, GORP_STATE_HOME: stateHome }, encoding: "utf8" },
    );
    const parsed2 = JSON.parse(second) as { success: boolean; data: SchedulerResult };
    expect(parsed2.data.outcome).toBe("completed");
    expect(parsed2.data.steps).toEqual([]);
  }, 180_000);
});
