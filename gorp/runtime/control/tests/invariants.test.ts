import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Internal APIs are used ONLY to CONSTRUCT states (approved graphs, a
// simulated mid-run crash). Every ASSERTION runs against the public CLI.
import { loadConfig, runDir, type RuntimeConfig } from "../src/config/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, applyNodeTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { DEFAULT_RUN_ID, executeRun } from "../src/run/run.js";
import { executeApprove } from "../src/review/decision.js";
import { executePromote } from "../src/promote/promote.js";
import type { GraphNode } from "../src/contracts/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const CLI = join(PKG, "dist", "cli", "main.js");

const clock: Clock = { now: () => "2026-07-16T09:00:00.000Z" };

let stateHome: string;
let repo: string;
let cfg: RuntimeConfig;

beforeAll(() => {
  execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: PKG, stdio: "pipe" });
}, 120_000);

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function runCli(argv: string[]): { stdout: string; code: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...argv], {
      env: { ...process.env, GORP_STATE_HOME: stateHome },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, code: 0 };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { stdout: err.stdout ?? "", code: err.status ?? -1 };
  }
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

function approvedGraph(graphId: string, nodes: GraphNode[]): void {
  const store = new GraphStore(cfg);
  const draft = buildDraftGraph(
    {
      graphId,
      project: { projectId: "p1" },
      baseCommit: git(["rev-parse", "HEAD"], repo).trim(),
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

/** Drive one node through run -> approve -> promote (internal, setup only). */
async function promoteNode(graphId: string, nodeId: string): Promise<void> {
  const run = await executeRun(cfg, { projectId: "p1", graphId, nodeId, actorId: "orch" }, clock);
  executeApprove(
    cfg,
    { projectId: "p1", graphId, nodeId, actorId: "op", reason: "ok", reviewedCommit: run.sandbox!.headCommit },
    clock,
  );
  executePromote(cfg, { projectId: "p1", graphId, nodeId, actorId: "op" }, clock);
}

function completeArgv(graphId: string): string[] {
  return [
    "graph", "transition", "--project-id", "p1", "--graph-id", graphId,
    "--to", "completed", "--actor-type", "orchestrator", "--actor-id", "sched",
    "--reason-code", "ALL_NODES_TERMINAL", "--reason", "closing the graph",
  ];
}

/**
 * Simulate the mid-run crash window: `gorp run` persisted the node's
 * ready->running transitions and then the process died before creating the
 * run directory / records. The runtime never leaves a node in-flight at rest,
 * so this state is only reachable by a crash.
 */
function simulateInterruptedRun(graphId: string, nodeId: string): void {
  const store = new GraphStore(cfg);
  let g = store.load("p1", graphId);
  g = applyGraphTransition(
    g,
    { to: "running", actorType: "orchestrator", actorId: "orch", reasonCode: "RUN_START", reasonText: "crash sim" },
    clock,
  );
  g = applyNodeTransition(
    g,
    { nodeId, to: "ready", actorType: "orchestrator", actorId: "orch", reasonCode: "NODE_ELIGIBLE", reasonText: "crash sim" },
    clock,
  );
  g = applyNodeTransition(
    g,
    { nodeId, to: "running", actorType: "orchestrator", actorId: "orch", reasonCode: "WORKER_START", reasonText: "crash sim" },
    clock,
  );
  store.update(g);
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-invariant-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = mkdtempSync(join(tmpdir(), "gorp-invariant-repo-"));
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# consumer\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
  registerProjects({ p1: repo });
});
afterEach(() => {
  delete process.env["GORP_PROJECT_REGISTRY"];
  delete process.env["GORP_STATE_HOME"];
  rmSync(stateHome, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("invariant 1: graph completion requires every node terminal", () => {
  it("premature completion fails closed with a structured error and NO mutation", async () => {
    approvedGraph("inv-premature", [node("n1", "docs/one.md"), node("n2", "docs/two.md", ["n1"])]);
    await promoteNode("inv-premature", "n1"); // n2 stays pending; graph running

    const before = runCli(["graph", "show", "--project-id", "p1", "--graph-id", "inv-premature"]).stdout;

    const call = runCli(completeArgv("inv-premature"));
    expect(call.code).toBe(7); // ILLEGAL_STATE_TRANSITION
    const j = JSON.parse(call.stdout) as {
      success: boolean;
      error: { code: string; details: { reason: string; nonTerminalNodes: Array<{ nodeId: string; state: string }>; terminalStates: string[] } };
    };
    expect(j.success).toBe(false);
    expect(j.error.code).toBe("ILLEGAL_STATE_TRANSITION");
    expect(j.error.details.reason).toBe("nodes_not_terminal");
    expect(j.error.details.nonTerminalNodes).toEqual([{ nodeId: "n2", state: "pending" }]);
    expect(j.error.details.terminalStates).toEqual(["promoted", "rejected", "cancelled", "failed"]);

    // no mutation: graph document identical, still running, n2 still workable
    const after = runCli(["graph", "show", "--project-id", "p1", "--graph-id", "inv-premature"]).stdout;
    expect(after).toBe(before);
    const run2 = runCli(["run", "--project-id", "p1", "--graph-id", "inv-premature", "--node-id", "n2", "--actor-id", "sched"]);
    expect(run2.code).toBe(0); // the wedge is gone: n2 remains runnable
  });

  it("every in-flight/review/approved state blocks completion", async () => {
    approvedGraph("inv-review", [node("n1", "docs/one.md")]);
    await executeRun(cfg, { projectId: "p1", graphId: "inv-review", nodeId: "n1", actorId: "orch" }, clock);
    // node awaiting_review
    const awaiting = runCli(completeArgv("inv-review"));
    expect(awaiting.code).toBe(7);
    let err = (JSON.parse(awaiting.stdout) as { error: { details: { nonTerminalNodes: Array<{ state: string }> } } }).error;
    expect(err.details.nonTerminalNodes[0]!.state).toBe("awaiting_review");

    // node approved (decision recorded, not promoted)
    const review = runCli(["review", "--project-id", "p1", "--graph-id", "inv-review", "--node-id", "n1"]);
    const reviewed = (JSON.parse(review.stdout) as { data: { gateRecord: { validation: { artifactHash: string } } } })
      .data.gateRecord.validation.artifactHash;
    expect(
      runCli([
        "approve", "--project-id", "p1", "--graph-id", "inv-review", "--node-id", "n1",
        "--actor-id", "op", "--reviewed-commit", reviewed, "--reason", "ok",
      ]).code,
    ).toBe(0);
    const approved = runCli(completeArgv("inv-review"));
    expect(approved.code).toBe(7);
    err = (JSON.parse(approved.stdout) as { error: { details: { nonTerminalNodes: Array<{ state: string }> } } }).error;
    expect(err.details.nonTerminalNodes[0]!.state).toBe("approved");
  });

  it("completion succeeds with MIXED terminal states (promoted + cancelled)", async () => {
    approvedGraph("inv-mixed", [node("n1", "docs/one.md"), node("n2", "docs/two.md")]);
    await promoteNode("inv-mixed", "n1");
    // operator cancels the remaining pending node (legal: pending -> cancelled)
    const store = new GraphStore(cfg);
    store.update(
      applyNodeTransition(
        store.load("p1", "inv-mixed"),
        { nodeId: "n2", to: "cancelled", actorType: "operator", actorId: "op", reasonCode: "DESCOPED", reasonText: "n2 descoped by operator" },
        clock,
      ),
    );

    const call = runCli(completeArgv("inv-mixed"));
    expect(call.code).toBe(0);
    const shown = JSON.parse(
      runCli(["graph", "show", "--project-id", "p1", "--graph-id", "inv-mixed"]).stdout,
    ) as { data: { status: string; nodes: Array<{ state: string }> } };
    expect(shown.data.status).toBe("completed");
    expect(shown.data.nodes.map((n) => n.state)).toEqual(["promoted", "cancelled"]);
  });
});

describe("invariant 2: mid-run crash leaves a detectable, non-retryable, operator-owned state", () => {
  it("node running with NO run directory: show + inspect expose the interrupted run", async () => {
    approvedGraph("inv-crash", [node("n1", "docs/one.md")]);
    simulateInterruptedRun("inv-crash", "n1");

    // `graph show` evidence: the node is at rest in an in-flight state
    const shown = JSON.parse(
      runCli(["graph", "show", "--project-id", "p1", "--graph-id", "inv-crash"]).stdout,
    ) as { data: { status: string; nodes: Array<{ nodeId: string; state: string }> } };
    expect(shown.data.status).toBe("running");
    expect(shown.data.nodes[0]!.state).toBe("running");

    // `inspect` does NOT throw RUN_NOT_FOUND for an in-flight node: it returns
    // the machine-readable recovery state instead
    const call = runCli(["inspect", "--project-id", "p1", "--graph-id", "inv-crash", "--node-id", "n1"]);
    expect(call.code).toBe(0);
    const view = JSON.parse(call.stdout) as {
      data: {
        readOnly: boolean;
        recovery: { state: string; nodeState: string; missingRecords: string[]; autoRetry: boolean; requiredAction: string | null };
        errors: string[];
        workerResult: { present: boolean };
        runRecord: { present: boolean };
      };
    };
    expect(view.data.readOnly).toBe(true);
    expect(view.data.recovery.state).toBe("interrupted-run");
    expect(view.data.recovery.nodeState).toBe("running");
    expect(view.data.recovery.missingRecords).toEqual(["run-record.json", "worker-result.json", "gate-record.json"]);
    expect(view.data.recovery.autoRetry).toBe(false);
    expect(view.data.recovery.requiredAction).toContain("operator action required");
    expect(view.data.recovery.requiredAction).toContain("graph transition --to failed");
    expect(view.data.errors.some((e) => e.includes("interrupted-run"))).toBe(true);
    expect(view.data.runRecord.present).toBe(false);

    // no auto-retry: run is refused with the node's actual state
    const rerun = runCli(["run", "--project-id", "p1", "--graph-id", "inv-crash", "--node-id", "n1", "--actor-id", "sched"]);
    expect(rerun.code).toBe(8); // STATE_CONFLICT
    const rerunErr = JSON.parse(rerun.stdout) as { error: { code: string; details: { state: string } } };
    expect(rerunErr.error.code).toBe("STATE_CONFLICT");
    expect(rerunErr.error.details.state).toBe("running");

    // the documented operator action works and terminates the graph
    const closeOut = runCli([
      "graph", "transition", "--project-id", "p1", "--graph-id", "inv-crash",
      "--to", "failed", "--actor-type", "system", "--actor-id", "op",
      "--reason-code", "INTERRUPTED_RUN", "--reason", "run was interrupted mid-command; closed out by operator",
    ]);
    expect(closeOut.code).toBe(0);
    const after = JSON.parse(
      runCli(["graph", "show", "--project-id", "p1", "--graph-id", "inv-crash"]).stdout,
    ) as { data: { status: string } };
    expect(after.data.status).toBe("failed");
  });

  it("node running with a PARTIAL run directory (records missing) is also detected", async () => {
    approvedGraph("inv-partial", [node("n1", "docs/one.md")]);
    simulateInterruptedRun("inv-partial", "n1");
    // crash window variant: the run dir was created but no record landed
    mkdirSync(runDir(cfg, "p1", { graphId: "inv-partial", nodeId: "n1", runId: DEFAULT_RUN_ID }), { recursive: true });

    const call = runCli(["inspect", "--project-id", "p1", "--graph-id", "inv-partial", "--node-id", "n1"]);
    expect(call.code).toBe(0);
    const view = JSON.parse(call.stdout) as {
      data: { recovery: { state: string; missingRecords: string[]; autoRetry: boolean } };
    };
    expect(view.data.recovery.state).toBe("interrupted-run");
    expect(view.data.recovery.missingRecords).toContain("run-record.json");
    expect(view.data.recovery.autoRetry).toBe(false);

    // and the duplicate-run protection still holds (run dir exists)
    const rerun = runCli(["run", "--project-id", "p1", "--graph-id", "inv-partial", "--node-id", "n1", "--actor-id", "sched"]);
    expect(rerun.code).toBe(8);
  });

  it("healthy runs report recovery.state 'none'", async () => {
    approvedGraph("inv-healthy", [node("n1", "docs/one.md")]);
    await executeRun(cfg, { projectId: "p1", graphId: "inv-healthy", nodeId: "n1", actorId: "orch" }, clock);
    const view = JSON.parse(
      runCli(["inspect", "--project-id", "p1", "--graph-id", "inv-healthy", "--node-id", "n1"]).stdout,
    ) as { data: { recovery: { state: string; missingRecords: string[]; requiredAction: string | null }; errors: string[] } };
    expect(view.data.recovery.state).toBe("none");
    expect(view.data.recovery.missingRecords).toEqual([]);
    expect(view.data.recovery.requiredAction).toBeNull();
    expect(view.data.errors).toEqual([]);
  });

  it("a pending node with no run still fails closed as RUN_NOT_FOUND (not everything is 'recovery')", async () => {
    approvedGraph("inv-norun", [node("n1", "docs/one.md")]);
    const call = runCli(["inspect", "--project-id", "p1", "--graph-id", "inv-norun", "--node-id", "n1"]);
    expect(call.code).toBe(14); // RUN_NOT_FOUND
    const j = JSON.parse(call.stdout) as { error: { code: string } };
    expect(j.error.code).toBe("RUN_NOT_FOUND");
    expect(existsSync(runDir(cfg, "p1", { graphId: "inv-norun", nodeId: "n1", runId: DEFAULT_RUN_ID }))).toBe(false);
  });
});
