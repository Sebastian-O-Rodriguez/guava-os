import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { graphPath, loadConfig, promotionRecordPath, sandboxDir, type RunRef, type RuntimeConfig } from "../src/config/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { DEFAULT_RUN_ID, executeRun, type RunOutput } from "../src/run/run.js";
import { executeApprove } from "../src/review/decision.js";
import { executePromote, cherryPickCommit } from "../src/promote/promote.js";
import { GorpError } from "../src/errors/index.js";
import type { GateRecord, GraphNode, PromotionRecord } from "../src/contracts/types.js";

const clock: Clock = { now: () => "2026-07-15T09:00:00.000Z" };

let stateHome: string;
let repo: string;
let cfg: RuntimeConfig;

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeNode(partial: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "node-1",
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

/** Create+approve a graph, run it to awaiting_review, return the run output. */
async function reviewedRun(graphId: string, node: GraphNode = makeNode()): Promise<RunOutput> {
  const store = new GraphStore(cfg);
  const draft = buildDraftGraph(
    {
      graphId,
      project: { projectId: "p1" },
      baseCommit: git(["rev-parse", "HEAD"], repo).trim(),
      nodes: [node],
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
  return executeRun(cfg, { projectId: "p1", graphId, nodeId: node.nodeId, actorId: "orch" }, clock);
}

function nodeRef(graphId: string, nodeId = "node-1"): RunRef {
  return { graphId, nodeId, runId: DEFAULT_RUN_ID };
}

function approveRun(graphId: string, reviewedCommit: string): void {
  executeApprove(
    cfg,
    { projectId: "p1", graphId, nodeId: "node-1", actorId: "reviewer:op", reason: "reviewed and approved", reviewedCommit },
    clock,
  );
}

function promoteArgs(graphId: string) {
  return { projectId: "p1", graphId, nodeId: "node-1", actorId: "reviewer:op" };
}

function expectCode(fn: () => unknown, code: "PROMOTION_BLOCKED" | "REVIEW_BLOCKED" | "AUDIT_TAMPERED", check?: string): GorpError {
  let err: GorpError | null = null;
  try {
    fn();
  } catch (e) {
    err = e as GorpError;
  }
  expect(err, `expected ${code}${check ? `(${check})` : ""}`).not.toBeNull();
  expect(err!.code).toBe(code);
  if (check) expect(err!.details["check"]).toBe(check);
  return err!;
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-promote-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = mkdtempSync(join(tmpdir(), "gorp-promote-repo-"));
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

describe("Wave C+D promote: approved decision -> promote -> done", () => {
  it("happy path: approve then promote cherry-picks the reviewed commit, completes graph, cleans sandbox", async () => {
    const run = await reviewedRun("g-promote");
    const reviewed = run.sandbox!.headCommit;
    const baseCommit = git(["rev-parse", "HEAD"], repo).trim();

    approveRun("g-promote", reviewed);
    const out = executePromote(cfg, promoteArgs("g-promote"), clock);

    // exactly one new commit on the target, child of the recorded base
    expect(out.promotedCommit).toBe(reviewed);
    const head = git(["rev-parse", "HEAD"], repo).trim();
    expect(out.resultCommit).toBe(head);
    expect(git(["rev-parse", "HEAD^"], repo).trim()).toBe(baseCommit);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
    expect(readFileSync(join(repo, "docs/note.md"), "utf8")).toContain("add a governed note");

    // graph complete, node promoted
    expect(out.graphStatus).toBe("running"); // promotion does NOT complete the graph (orchestrator owns completion)
    expect(out.nodeState).toBe("promoted");

    // immutable promotion record links promotion -> decision -> artifact
    const pr = JSON.parse(readFileSync(promotionRecordPath(cfg, "p1", nodeRef("g-promote")), "utf8")) as PromotionRecord;
    expect(pr.promotedCommit).toBe(reviewed);
    expect(pr.resultCommit).toBe(out.resultCommit);
    expect(pr.baseCommit).toBe(baseCommit);
    expect(pr.reviewDecisionSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pr.promotedAt).toBe(clock.now());

    // sandbox cleaned: worktree dir and branch both gone
    expect(out.sandboxCleaned).toBe(true);
    expect(existsSync(sandboxDir(cfg, "p1", nodeRef("g-promote")))).toBe(false);
    expect(git(["branch", "--list", "gorp/run/*"], repo).trim()).toBe("");
  });

  it("gate record is fully immutable: byte-identical from run through approve and promote", async () => {
    const run = await reviewedRun("g-immutable");
    const bytesAfterRun = readFileSync(run.records.gateRecord, "utf8");
    approveRun("g-immutable", run.sandbox!.headCommit);
    expect(readFileSync(run.records.gateRecord, "utf8")).toBe(bytesAfterRun);
    executePromote(cfg, promoteArgs("g-immutable"), clock);
    expect(readFileSync(run.records.gateRecord, "utf8")).toBe(bytesAfterRun);
    const gate = JSON.parse(bytesAfterRun) as GateRecord;
    expect(gate.review.status).toBe("pending"); // decisions live in their own record now
    expect(gate.validation.artifactHash).toMatch(/^[0-9a-f]{40}$/); // artifactHash is a commit SHA
  });

  it("audit history explains the full path after promotion", async () => {
    const run = await reviewedRun("g-audit");
    approveRun("g-audit", run.sandbox!.headCommit);
    executePromote(cfg, promoteArgs("g-audit"), clock);
    const g = new GraphStore(cfg).load("p1", "g-audit");
    const path = g.transitions.map((t) => `${t.entityType}:${t.fromState}->${t.toState}`);
    expect(path).toEqual([
      "graph:draft->approved",
      "graph:approved->running",
      "node:pending->ready",
      "node:ready->running",
      "node:running->awaiting_review",
      "node:awaiting_review->approved",
      "node:approved->promoted",
    ]); // no graph completion transition: promote never completes the graph
    // every transition is operator/orchestrator/system — never a worker
    for (const t of g.transitions) {
      expect(["operator", "orchestrator", "system"]).toContain(t.actorType);
    }
  });

  it("bad base commit: target HEAD moved after approval -> blocked, nothing mutated, sandbox kept", async () => {
    const run = await reviewedRun("g-base");
    approveRun("g-base", run.sandbox!.headCommit);
    writeFileSync(join(repo, "OTHER.md"), "moved\n");
    git(["add", "."], repo);
    git(["commit", "-q", "-m", "target moved"], repo);
    const headBefore = git(["rev-parse", "HEAD"], repo).trim();

    expectCode(() => executePromote(cfg, promoteArgs("g-base"), clock), "PROMOTION_BLOCKED", "base-commit");

    expect(git(["rev-parse", "HEAD"], repo).trim()).toBe(headBefore); // no partial
    expect(existsSync(run.sandbox!.dir)).toBe(true); // sandbox kept for the operator
    expect(existsSync(promotionRecordPath(cfg, "p1", nodeRef("g-base")))).toBe(false); // no promotion record
    const g = new GraphStore(cfg).load("p1", "g-base");
    expect(g.nodes[0]!.state).toBe("approved"); // decision stands; promotion blocked
  });

  it("out-of-scope rerun fail: scope narrowed after approval -> blocked, target untouched", async () => {
    const run = await reviewedRun("g-rerun");
    approveRun("g-rerun", run.sandbox!.headCommit);
    // Narrow the persisted graph's allowed scope so the live rerun fails.
    const gPath = graphPath(cfg, "p1", "g-rerun");
    const doc = JSON.parse(readFileSync(gPath, "utf8")) as { nodes: Array<{ allowedPaths: string[] }> };
    doc.nodes[0]!.allowedPaths = ["other/**"];
    writeFileSync(gPath, JSON.stringify(doc, null, 2));
    const headBefore = git(["rev-parse", "HEAD"], repo).trim();

    expectCode(() => executePromote(cfg, promoteArgs("g-rerun"), clock), "PROMOTION_BLOCKED", "scope-rerun");
    expect(git(["rev-parse", "HEAD"], repo).trim()).toBe(headBefore);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
  });

  it("promote cannot run twice: completed graph is blocked", async () => {
    const run = await reviewedRun("g-twice");
    approveRun("g-twice", run.sandbox!.headCommit);
    executePromote(cfg, promoteArgs("g-twice"), clock);
    expectCode(() => executePromote(cfg, promoteArgs("g-twice"), clock), "PROMOTION_BLOCKED", "node-state");
  });
});

describe("cherry-pick conflict handling (unit: unreachable in-flow by construction)", () => {
  it("conflict -> abort, pristine tree, PROMOTION_CONFLICT, no partial application", async () => {
    // divergent history: base -> C (target) and base -> B (to pick), both touch README
    const base = git(["rev-parse", "HEAD"], repo).trim();
    git(["checkout", "-q", "-b", "pick-src"], repo);
    writeFileSync(join(repo, "README.md"), "# consumer\nfrom B\n");
    git(["add", "."], repo);
    git(["commit", "-q", "-m", "B"], repo);
    const commitB = git(["rev-parse", "HEAD"], repo).trim();
    git(["checkout", "-q", "-"], repo);
    writeFileSync(join(repo, "README.md"), "# consumer\nfrom C\n");
    git(["add", "."], repo);
    git(["commit", "-q", "-m", "C"], repo);
    const headBefore = git(["rev-parse", "HEAD"], repo).trim();
    expect(headBefore).not.toBe(base);

    let err: GorpError | null = null;
    try {
      cherryPickCommit(repo, commitB, clock);
    } catch (e) {
      err = e as GorpError;
    }
    expect(err).not.toBeNull();
    expect(err!.code).toBe("PROMOTION_CONFLICT");
    expect(err!.details["restoredClean"]).toBe(true);
    // aborted: no partial application, HEAD unchanged, tree pristine
    expect(git(["rev-parse", "HEAD"], repo).trim()).toBe(headBefore);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
    expect(readFileSync(join(repo, "README.md"), "utf8")).toContain("from C");
  });
});

describe("boundary re-verification", () => {
  it("sandbox and all runtime state stay inside GORP_STATE_HOME; worker writes none of it", async () => {
    const run = await reviewedRun("g-boundary");
    expect(run.sandbox!.dir.startsWith(stateHome)).toBe(true);
    for (const p of Object.values(run.records)) expect(p.startsWith(stateHome)).toBe(true);
    // the worker's only footprint is inside the sandbox: consumer tree clean,
    // and the state root contains exactly the expected runtime files
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
    const expected = ["audit-chain.jsonl", "gate-record.json", "run-record.json", "sandbox", "worker-result.json"];
    const entries = execFileSync("ls", [join(stateHome, "projects", "p1", "runs", "g-boundary", "node-1", DEFAULT_RUN_ID)], { encoding: "utf8" })
      .trim().split("\n").sort();
    expect(entries).toEqual(expected);
  });
});
