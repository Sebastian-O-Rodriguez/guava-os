import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig, runDir, type RunRef, type RuntimeConfig } from "../src/config/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { DEFAULT_RUN_ID, executeRun } from "../src/run/run.js";
import { executeApprove } from "../src/review/decision.js";
import { executePromote } from "../src/promote/promote.js";
import { inspectRun } from "../src/inspect/inspect.js";
import { GorpError } from "../src/errors/index.js";
import type { GraphNode, RunRecord } from "../src/contracts/types.js";

const clock: Clock = { now: () => "2026-07-15T11:00:00.000Z" };

let stateHome: string;
let repo: string;
let cfg: RuntimeConfig;

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

/** Persist + operator-approve a graph with the given nodes. */
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

function runNode(graphId: string, nodeId: string) {
  return executeRun(cfg, { projectId: "p1", graphId, nodeId, actorId: "orch" }, clock);
}

function approveAndPromote(graphId: string, nodeId: string, reviewedCommit: string) {
  executeApprove(
    cfg,
    { projectId: "p1", graphId, nodeId, actorId: "reviewer:op", reason: "ok", reviewedCommit },
    clock,
  );
  return executePromote(cfg, { projectId: "p1", graphId, nodeId, actorId: "reviewer:op" }, clock);
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-multi-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = mkdtempSync(join(tmpdir(), "gorp-multi-repo-"));
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

const TWO_NODES = (): GraphNode[] => [
  node("n1", "docs/one.md"),
  node("n2", "docs/two.md", ["n1"]),
];

describe("Sprint 2A: multi-node graphs", () => {
  it("persists and reloads a multi-node graph with dependencies", async () => {
    approvedGraph("mg-persist", TWO_NODES());
    const g = new GraphStore(cfg).load("p1", "mg-persist");
    expect(g.nodes.map((n) => n.nodeId)).toEqual(["n1", "n2"]);
    expect(g.nodes[1]!.dependencies).toEqual(["n1"]);
  });

  it("runs ONLY the chosen node; the other node is untouched", async () => {
    approvedGraph("mg-choose", TWO_NODES());
    const out = await runNode("mg-choose", "n1");
    expect(out.nodeId).toBe("n1");
    const g = new GraphStore(cfg).load("p1", "mg-choose");
    expect(g.nodes.find((n) => n.nodeId === "n1")!.state).toBe("awaiting_review");
    expect(g.nodes.find((n) => n.nodeId === "n2")!.state).toBe("pending"); // untouched
    // no run directory exists for the node that was not run
    expect(existsSync(runDir(cfg, "p1", { graphId: "mg-choose", nodeId: "n2", runId: DEFAULT_RUN_ID }))).toBe(false);
  });

  it("wrong / missing node fails closed with no fallback and no mutation", async () => {
    approvedGraph("mg-wrong", TWO_NODES());
    let err: GorpError | null = null;
    try {
      await runNode("mg-wrong", "nope");
    } catch (e) {
      err = e as GorpError;
    }
    expect(err).not.toBeNull();
    expect(err!.code).toBe("INVALID_ARGUMENT");
    expect(err!.details["knownNodes"]).toEqual(["n1", "n2"]);
    const g = new GraphStore(cfg).load("p1", "mg-wrong");
    expect(g.status).toBe("approved"); // nothing ran, nothing transitioned
    expect(g.transitions).toHaveLength(1); // only the operator approval

    // empty nodeId also fails closed (no hidden fallback to the first node)
    await expect(runNode("mg-wrong", "")).rejects.toThrowError(/nodeId is required/);
  });

  it("dependency order is enforced: node 2 cannot run before node 1 is promoted", async () => {
    approvedGraph("mg-order", TWO_NODES());
    let err: GorpError | null = null;
    try {
      await runNode("mg-order", "n2");
    } catch (e) {
      err = e as GorpError;
    }
    expect(err).not.toBeNull();
    expect(err!.code).toBe("STATE_CONFLICT");
    expect(err!.details["unmetDependencies"]).toEqual(["n1"]);
  });

  it("two nodes get separate run dirs, sandboxes, and branches; node 2 bases on post-node-1 HEAD", async () => {
    approvedGraph("mg-full", TWO_NODES());
    const base0 = git(["rev-parse", "HEAD"], repo).trim();

    // node 1: run -> approve -> promote
    const run1 = await runNode("mg-full", "n1");
    expect(run1.baseCommit).toBe(base0);
    expect(run1.sandbox!.branch).toBe(`gorp/run/mg-full/n1/${DEFAULT_RUN_ID}`);
    const promoted1 = approveAndPromote("mg-full", "n1", run1.sandbox!.headCommit);
    const head1 = git(["rev-parse", "HEAD"], repo).trim();
    expect(promoted1.resultCommit).toBe(head1);
    expect(head1).not.toBe(base0);

    // promoting one node does NOT complete the graph
    const gMid = new GraphStore(cfg).load("p1", "mg-full");
    expect(gMid.status).toBe("running");
    expect(gMid.nodes.find((n) => n.nodeId === "n1")!.state).toBe("promoted");
    expect(gMid.nodes.find((n) => n.nodeId === "n2")!.state).toBe("pending");

    // node 2: bases on the HEAD produced by node 1's promotion
    const run2 = await runNode("mg-full", "n2");
    expect(run2.baseCommit).toBe(head1); // per-node-run base, not graph.baseCommit
    expect(run2.sandbox!.branch).toBe(`gorp/run/mg-full/n2/${DEFAULT_RUN_ID}`);
    expect(run2.sandbox!.dir).not.toBe(run1.sandbox!.dir);
    const ref1: RunRef = { graphId: "mg-full", nodeId: "n1", runId: DEFAULT_RUN_ID };
    const ref2: RunRef = { graphId: "mg-full", nodeId: "n2", runId: DEFAULT_RUN_ID };
    expect(runDir(cfg, "p1", ref1)).not.toBe(runDir(cfg, "p1", ref2));
    expect(existsSync(runDir(cfg, "p1", ref1))).toBe(true);
    expect(existsSync(runDir(cfg, "p1", ref2))).toBe(true);
    const rr2 = JSON.parse(readFileSync(run2.records.runRecord, "utf8")) as RunRecord;
    expect(rr2.baseCommit).toBe(head1);

    // node 2 promotes cleanly on top of node 1's result
    const promoted2 = approveAndPromote("mg-full", "n2", run2.sandbox!.headCommit);
    expect(git(["rev-parse", "HEAD"], repo).trim()).toBe(promoted2.resultCommit);
    expect(git(["rev-parse", "HEAD^"], repo).trim()).toBe(head1);
    expect(readFileSync(join(repo, "docs/one.md"), "utf8")).toContain("write docs/one.md");
    expect(readFileSync(join(repo, "docs/two.md"), "utf8")).toContain("write docs/two.md");

    // both nodes promoted; the graph STILL is not completed (orchestrator's job)
    const gEnd = new GraphStore(cfg).load("p1", "mg-full");
    expect(gEnd.status).toBe("running");
    expect(gEnd.nodes.every((n) => n.state === "promoted")).toBe(true);

    // per-node inspect: chains verify independently
    for (const nid of ["n1", "n2"]) {
      const view = inspectRun(cfg, { projectId: "p1", graphId: "mg-full", nodeId: nid });
      expect(view.integrity.chainValid).toBe(true);
      expect(view.promotionRecord.record).not.toBeNull();
      expect(view.errors).toEqual([]);
    }
  });

  it("graph integrity fails closed: duplicate node ids and unknown dependencies", async () => {
    approvedGraph("mg-dup", [node("nx", "docs/a.md"), node("nx", "docs/b.md")]);
    await expect(runNode("mg-dup", "nx")).rejects.toThrowError(/duplicate nodeId/);

    approvedGraph("mg-baddep", [node("n1", "docs/a.md", ["ghost"])]);
    let err: GorpError | null = null;
    try {
      await runNode("mg-baddep", "n1");
    } catch (e) {
      err = e as GorpError;
    }
    expect(err!.code).toBe("UNSUPPORTED_GRAPH_SHAPE");
    expect(err!.details["dependency"]).toBe("ghost");
  });
});
