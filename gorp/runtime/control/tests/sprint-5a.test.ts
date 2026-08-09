/**
 * Sprint 5A: retry verdict, projectId-only state (registry resolution +
 * lazy migration), and the enriched worker-result contract.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig, sandboxDir, graphPath, type RuntimeConfig } from "../src/config/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { executeRun } from "../src/run/run.js";
import { executeApprove, executeRetry } from "../src/review/decision.js";
import { executePromote } from "../src/promote/promote.js";
import { inspectRun } from "../src/inspect/inspect.js";
import { resolveProjectRepoPath } from "../src/registry/projects.js";
import { invokeAdapter, type WorkerAdapter } from "../src/worker/adapter.js";
import { GorpError } from "../src/errors/index.js";
import type { ExecutionGraph, GraphNode, ReviewDecision, WorkerResult } from "../src/contracts/types.js";

const clock: Clock = { now: () => "2026-07-20T12:00:00.000Z" };

let stateHome: string;
let repo: string;
let cfg: RuntimeConfig;

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeNode(partial: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "n1",
    taskType: "fixture-mutation",
    objective: "add a governed note",
    acceptanceCriteria: ["note exists"],
    allowedPaths: ["docs/**"],
    forbiddenPaths: ["secrets/**"],
    requiredCommands: [],
    expectedArtifacts: ["docs/note.md"],
    workerAdapter: "fixture",
    dependencies: [],
    state: "pending",
    attempt: 0,
    ...partial,
  };
}

function approvedGraph(graphId: string, nodes: GraphNode[]): ExecutionGraph {
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
  const approved = applyGraphTransition(
    draft,
    { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OPERATOR_APPROVAL", reasonText: "approved" },
    clock,
  );
  store.update(approved);
  return approved;
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-5a-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = mkdtempSync(join(tmpdir(), "gorp-5a-repo-"));
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

describe("projectId-only state: registry resolution", () => {
  it("run fails closed (PROJECT_NOT_REGISTERED) for a project the registry does not know", async () => {
    registerProjects({ someoneElse: repo }); // p1 is NOT registered
    approvedGraph("g-unreg", [makeNode()]);
    let err: GorpError | null = null;
    try {
      await executeRun(cfg, { projectId: "p1", graphId: "g-unreg", nodeId: "n1", actorId: "orch" }, clock);
    } catch (e) {
      err = e as GorpError;
    }
    expect(err).not.toBeNull();
    expect(err!.code).toBe("PROJECT_NOT_REGISTERED");
  });

  it("resolves ~ and returns an absolute existing path", () => {
    expect(resolveProjectRepoPath("p1")).toBe(repo);
  });

  it("legacy graph JSON with repositoryPath fields loads (lazy migration) and persists migrated", () => {
    const store = new GraphStore(cfg);
    const legacy = {
      schemaVersion: 1,
      graphId: "g-legacy",
      project: { projectId: "p1", repositoryPath: "/moved/away/long/ago" },
      repositoryPath: "/moved/away/long/ago",
      baseCommit: git(["rev-parse", "HEAD"], repo).trim(),
      approvalStatus: "unapproved",
      provenance: { createdBy: "op", createdByType: "operator", createdAt: "2026-07-17T12:00:00.000Z" },
      status: "draft",
      nodes: [makeNode()],
      transitions: [],
    };
    const target = graphPath(cfg, "p1", "g-legacy");
    mkdirSync(join(stateHome, "projects", "p1", "graphs"), { recursive: true });
    writeFileSync(target, JSON.stringify(legacy, null, 2));

    const loaded = store.load("p1", "g-legacy");
    expect((loaded as unknown as Record<string, unknown>)["repositoryPath"]).toBeUndefined();
    expect(loaded.project).toEqual({ projectId: "p1" });

    store.update(loaded);
    const onDisk = JSON.parse(readFileSync(target, "utf8")) as Record<string, unknown>;
    expect(onDisk["repositoryPath"]).toBeUndefined();
    expect(onDisk["project"]).toEqual({ projectId: "p1" });
  });
});

describe("retry verdict: fresh attempt, same graph, full audit retained", () => {
  it("run -> retry -> run-2 -> approve -> promote; both runs' records and chains survive", async () => {
    approvedGraph("g-retry", [makeNode()]);

    // attempt 1
    const run1 = await executeRun(cfg, { projectId: "p1", graphId: "g-retry", nodeId: "n1", actorId: "orch" }, clock);
    expect(run1.runId).toBe("run-1");
    expect(run1.nodeState).toBe("awaiting_review");

    // operator: retry
    const retry = executeRetry(
      cfg,
      { projectId: "p1", graphId: "g-retry", nodeId: "n1", actorId: "op", reason: "close, but the note needs another pass" },
      clock,
    );
    expect(retry.runId).toBe("run-1");
    expect(retry.decision.decision).toBe("retry");
    expect(retry.nodeState).toBe("pending"); // fresh attempt possible
    expect(retry.graphStatus).toBe("running"); // graph NOT cancelled, NOT rebuilt
    expect(retry.sandboxDestroyed).toBe(true);

    // run-1 evidence is retained and its chain still verifies
    const insp1 = inspectRun(cfg, { projectId: "p1", graphId: "g-retry", nodeId: "n1", runId: "run-1" });
    expect(insp1.reviewDecision.record?.decision).toBe("retry");
    expect(insp1.integrity.chainValid).toBe(true);
    expect(insp1.integrity.chainLength).toBe(4); // worker-result, gate, run-record, review-decision

    // promote of the retried run is impossible
    let promoteErr: GorpError | null = null;
    try {
      executePromote(cfg, { projectId: "p1", graphId: "g-retry", nodeId: "n1", runId: "run-1", actorId: "op" }, clock);
    } catch (e) {
      promoteErr = e as GorpError;
    }
    expect(promoteErr?.code).toBe("PROMOTION_BLOCKED");
    expect(String(promoteErr?.details["check"])).toBe("review-retry");

    // attempt 2: a brand-new run under the SAME graph and node
    const run2 = await executeRun(cfg, { projectId: "p1", graphId: "g-retry", nodeId: "n1", actorId: "orch" }, clock);
    expect(run2.runId).toBe("run-2");
    expect(run2.nodeState).toBe("awaiting_review");
    expect(existsSync(join(stateHome, "projects", "p1", "runs", "g-retry", "n1", "run-1"))).toBe(true);
    expect(existsSync(join(stateHome, "projects", "p1", "runs", "g-retry", "n1", "run-2"))).toBe(true);

    // approve + promote attempt 2 (defaults resolve to the current run)
    const approve = executeApprove(
      cfg,
      { projectId: "p1", graphId: "g-retry", nodeId: "n1", actorId: "op", reason: "second pass is right", reviewedCommit: run2.sandbox!.headCommit },
      clock,
    );
    expect(approve.runId).toBe("run-2");
    const promoted = executePromote(cfg, { projectId: "p1", graphId: "g-retry", nodeId: "n1", actorId: "op" }, clock);
    expect(promoted.runId).toBe("run-2");
    expect(promoted.nodeState).toBe("promoted");

    // graph history: one appended transition log, including the retry
    const graph = new GraphStore(cfg).load("p1", "g-retry");
    const reasonCodes = graph.transitions.map((t) => t.reasonCode);
    expect(reasonCodes).toContain("RETRY_REQUESTED");
    expect(graph.nodes[0]!.attempt).toBe(2);

    // both chains verify end-to-end
    const insp2 = inspectRun(cfg, { projectId: "p1", graphId: "g-retry", nodeId: "n1", runId: "run-2" });
    expect(insp2.integrity.chainValid).toBe(true);
    expect(insp2.promotionRecord.record?.runId).toBe("run-2");
    const insp1After = inspectRun(cfg, { projectId: "p1", graphId: "g-retry", nodeId: "n1", runId: "run-1" });
    expect(insp1After.integrity.chainValid).toBe(true);
  });

  it("a second decision on the retried run fails (immutability per run)", async () => {
    approvedGraph("g-retry-2", [makeNode()]);
    const run1 = await executeRun(cfg, { projectId: "p1", graphId: "g-retry-2", nodeId: "n1", actorId: "orch" }, clock);
    executeRetry(cfg, { projectId: "p1", graphId: "g-retry-2", nodeId: "n1", actorId: "op", reason: "again" }, clock);
    let err: GorpError | null = null;
    try {
      executeApprove(
        cfg,
        { projectId: "p1", graphId: "g-retry-2", nodeId: "n1", runId: "run-1", actorId: "op", reason: "changed my mind", reviewedCommit: run1.sandbox!.headCommit },
        clock,
      );
    } catch (e) {
      err = e as GorpError;
    }
    expect(err?.code).toBe("REVIEW_BLOCKED");
    expect(err?.message).toContain("already-decided");
  });
});

describe("enriched worker result", () => {
  it("fixture worker reports summary, expectedFiles, and reviewerNotes", async () => {
    approvedGraph("g-wr", [makeNode()]);
    const out = await executeRun(cfg, { projectId: "p1", graphId: "g-wr", nodeId: "n1", actorId: "orch" }, clock);
    const wr = JSON.parse(readFileSync(out.records.workerResult, "utf8")) as WorkerResult;
    expect(wr.summary).toContain("deterministic fixture worker");
    expect(wr.expectedFiles).toEqual(["docs/note.md"]);
    expect(wr.reviewerNotes).toContain("fixture worker");
    expect(wr.changedFiles).toEqual(["docs/note.md"]);
  });

  it("adapter boundary refuses a result without a summary", async () => {
    const silent: WorkerAdapter = {
      name: "fixture",
      invoke: async (input) => ({
        schemaVersion: 1,
        graphId: input.graphId,
        nodeId: input.node.nodeId,
        runId: input.runId,
        workerAdapter: "fixture",
        outcome: "succeeded",
        startedAt: clock.now(),
        endedAt: clock.now(),
      }),
    };
    let err: GorpError | null = null;
    try {
      await invokeAdapter(silent, {
        sandbox: { dir: repo, branch: "b", repositoryPath: repo, baseCommit: "x" },
        graphId: "g",
        runId: "run-1",
        node: makeNode(),
        clock,
      });
    } catch (e) {
      err = e as GorpError;
    }
    expect(err?.code).toBe("WORKER_FAILED");
    expect(err?.message).toContain("summary");
  });
});

describe("retry decision record shape", () => {
  it("the retry decision is schema-valid and hash-bound like any other decision", async () => {
    approvedGraph("g-shape", [makeNode()]);
    await executeRun(cfg, { projectId: "p1", graphId: "g-shape", nodeId: "n1", actorId: "orch" }, clock);
    const out = executeRetry(cfg, { projectId: "p1", graphId: "g-shape", nodeId: "n1", actorId: "op", reason: "shape check" }, clock);
    const decision = JSON.parse(readFileSync(out.decisionPath, "utf8")) as ReviewDecision;
    expect(decision.decision).toBe("retry");
    expect(decision.reviewer).toBe("op");
    expect(decision.reviewedArtifactHash).toMatch(/^[0-9a-f]{40}$/);
    expect(decision.gateRecordSha256).toMatch(/^[0-9a-f]{64}$/);
    // sandbox is gone; run dir and records remain
    expect(existsSync(sandboxDir(cfg, "p1", { graphId: "g-shape", nodeId: "n1", runId: "run-1" }))).toBe(false);
  });
});
