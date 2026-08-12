import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig, sandboxDir, type RuntimeConfig } from "../src/config/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { DEFAULT_RUN_ID, executeRun } from "../src/run/run.js";
import { reviewRun } from "../src/run/review.js";
import { globToRegExp, matchesAny } from "../src/gate/scope.js";
import { GorpError } from "../src/errors/index.js";
import type { ExecutionGraph, GateRecord, GraphNode, RunRecord, WorkerResult } from "../src/contracts/types.js";

const clock: Clock = { now: () => "2026-07-14T12:00:00.000Z" };

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

function approvedGraph(graphId: string, node: GraphNode): ExecutionGraph {
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
  const approved = applyGraphTransition(
    draft,
    { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OPERATOR_APPROVAL", reasonText: "approved" },
    clock,
  );
  store.update(approved);
  return approved;
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-run-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = mkdtempSync(join(tmpdir(), "gorp-run-repo-"));
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

describe("glob scope matcher", () => {
  it("matches segment and cross-segment globs, literally otherwise", async () => {
    expect(globToRegExp("docs/**").test("docs/a.md")).toBe(true);
    expect(globToRegExp("docs/**").test("docs/a/b/c.md")).toBe(true);
    expect(globToRegExp("docs/**").test("src/a.md")).toBe(false);
    expect(globToRegExp("*.md").test("a.md")).toBe(true);
    expect(globToRegExp("*.md").test("docs/a.md")).toBe(false); // * stays in-segment
    expect(globToRegExp("a+b.txt").test("a+b.txt")).toBe(true); // regex chars literal
    expect(globToRegExp("a+b.txt").test("aab.txt")).toBe(false);
    expect(matchesAny("docs/x.md", ["src/**", "docs/**"])).toBe(true);
  });
});

describe("Wave B run: approved graph -> sandbox -> worker -> result -> gate -> review", () => {
  it("happy path: gate passes, node awaits review, sandbox kept, consumer untouched", async () => {
    approvedGraph("g-happy", makeNode());
    const out = await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-happy", actorId: "orch" }, clock);

    expect(out.finalStatus).toBe("succeeded");
    expect(out.nodeState).toBe("awaiting_review");
    expect(out.graphStatus).toBe("running");
    expect(out.validation.status).toBe("passed");
    expect(out.review.status).toBe("pending");

    // records persisted under the state root, schema-valid on re-read
    for (const p of Object.values(out.records)) {
      expect(p.startsWith(stateHome)).toBe(true);
      expect(existsSync(p)).toBe(true);
    }
    const wr = JSON.parse(readFileSync(out.records.workerResult, "utf8")) as WorkerResult;
    expect(wr.outcome).toBe("succeeded");
    expect(wr.changedFiles).toEqual(["docs/note.md"]);
    const gr = JSON.parse(readFileSync(out.records.gateRecord, "utf8")) as GateRecord;
    expect(gr.validation.checks.map((c) => c.status)).toEqual(["passed", "passed", "passed"]);
    expect(gr.validation.artifactHash).toBe(out.sandbox!.headCommit);
    const rr = JSON.parse(readFileSync(out.records.runRecord, "utf8")) as RunRecord;
    expect(rr.finalStatus).toBe("succeeded");
    expect(rr.sandboxIdentity).toBe(`gorp/run/g-happy/node-1/${out.runId}`);
    expect(rr.baseCommit).toBe(out.baseCommit); // per-node-run base recorded

    // sandbox kept for review, with exactly one commit on top of base
    expect(existsSync(out.sandbox!.dir)).toBe(true);
    expect(out.sandbox!.dir.startsWith(stateHome)).toBe(true);
    const artifact = readFileSync(join(out.sandbox!.dir, "docs/note.md"), "utf8");
    expect(artifact).toContain("add a governed note");
    expect(artifact).toContain("graph: g-happy");
    const commitCount = git(["rev-list", "--count", "HEAD"], out.sandbox!.dir).trim();
    expect(commitCount).toBe("2"); // init + one worker commit

    // consumer checkout untouched: clean status, no new files, HEAD unchanged
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
    expect(readdirSync(repo).filter((e) => e !== ".git")).toEqual(["README.md"]);
    expect(existsSync(join(repo, "docs"))).toBe(false);
  });

  it("worker cannot mutate the graph: only orchestrator/operator transitions exist", async () => {
    approvedGraph("g-actor", makeNode());
    await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-actor", actorId: "orch" }, clock);
    const g = new GraphStore(cfg).load("p1", "g-actor");
    expect(g.transitions.length).toBeGreaterThan(0);
    for (const t of g.transitions) {
      expect(["operator", "orchestrator", "system"]).toContain(t.actorType);
    }
    // node topology untouched: same single node, same scope fields
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0]!.allowedPaths).toEqual(["docs/**"]);
    expect(g.nodes[0]!.attempt).toBe(1);
  });

  it("review is read-only and presents result, gate, and diff", async () => {
    approvedGraph("g-review", makeNode());
    const out = await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-review", actorId: "orch" }, clock);

    const before = readFileSync(out.records.runRecord, "utf8");
    const review = reviewRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-review" });
    expect(review.readOnly).toBe(true);
    expect(review.runId).toBe(DEFAULT_RUN_ID);
    expect(review.nodeState).toBe("awaiting_review");
    expect(review.gateRecord!.validation.status).toBe("passed");
    expect(review.gateRecord!.review.status).toBe("pending");
    expect(review.sandbox!.changedFiles).toEqual(["docs/note.md"]);
    expect(review.sandbox!.diff).toContain("+# add a governed note");

    // no mutation: records byte-identical, graph state unchanged, no decision recorded
    expect(readFileSync(out.records.runRecord, "utf8")).toBe(before);
    const g = new GraphStore(cfg).load("p1", "g-review");
    expect(g.nodes[0]!.state).toBe("awaiting_review");
    const gr = JSON.parse(readFileSync(out.records.gateRecord, "utf8")) as GateRecord;
    expect(gr.review.status).toBe("pending");
  });

  it("out-of-scope artifact: gate fails closed, node+graph failed, sandbox destroyed", async () => {
    approvedGraph("g-oos", makeNode({ expectedArtifacts: ["src/evil.ts"], acceptanceCriteria: ["n/a"] }));
    let err: GorpError | null = null;
    try {
      await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-oos", actorId: "orch" }, clock);
    } catch (e) {
      err = e as GorpError;
    }
    expect(err).not.toBeNull();
    expect(err!.code).toBe("GATE_FAILED");

    const g = new GraphStore(cfg).load("p1", "g-oos");
    expect(g.status).toBe("failed");
    expect(g.nodes[0]!.state).toBe("failed");

    // sandbox destroyed: dir gone, branch gone; consumer still clean
    const sb = sandboxDir(cfg, "p1", { graphId: "g-oos", nodeId: "node-1", runId: DEFAULT_RUN_ID });
    expect(existsSync(sb)).toBe(false);
    expect(git(["branch", "--list", "gorp/run/*"], repo).trim()).toBe("");
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");

    // evidence retained: gate record failed check persisted; run record failed
    const review = reviewRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-oos" });
    expect(review.sandbox).toBeNull();
    expect(review.runRecord.finalStatus).toBe("failed");
    const failed = review.gateRecord!.validation.checks.find((c) => c.name === "changed-files-in-allowed-scope");
    expect(failed!.status).toBe("failed");
    expect(failed!.detail).toContain("src/evil.ts");
  });

  it("forbidden path: gate fails even when allowed scope is wide", async () => {
    approvedGraph("g-forbidden", makeNode({ allowedPaths: ["**"], expectedArtifacts: ["secrets/key.txt"] }));
    await expect(executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-forbidden", actorId: "orch" }, clock)).rejects.toThrowError(
      /gate failed: no-forbidden-paths/,
    );
    const review = reviewRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-forbidden" });
    const check = review.gateRecord!.validation.checks.find((c) => c.name === "no-forbidden-paths");
    expect(check!.status).toBe("failed");
  });

  it("unapproved graph cannot run and nothing is created", async () => {
    const store = new GraphStore(cfg);
    const draft = buildDraftGraph(
      {
        graphId: "g-draft",
        project: { projectId: "p1" },
        baseCommit: git(["rev-parse", "HEAD"], repo).trim(),
        nodes: [makeNode()],
        createdBy: "op",
        createdByType: "operator",
      },
      clock,
    );
    store.save(draft);
    await expect(executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-draft", actorId: "orch" }, clock)).rejects.toThrowError(
      /must be approved/,
    );
    expect(existsSync(join(stateHome, "projects", "p1", "runs"))).toBe(false);
    expect(git(["branch", "--list", "gorp/run/*"], repo).trim()).toBe("");
  });

  it("second run is refused (one run, no retries)", async () => {
    approvedGraph("g-once", makeNode());
    await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-once", actorId: "orch" }, clock);
    let err: GorpError | null = null;
    try {
      await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-once", actorId: "orch" }, clock);
    } catch (e) {
      err = e as GorpError;
    }
    // Refused either as an existing run or (equivalently fail-closed) because
    // the graph is no longer in `approved`.
    expect(err).not.toBeNull();
    expect(err!.code).toBe("STATE_CONFLICT");
  });

  it("unknown worker adapter fails closed BEFORE any mutation (Sprint 3B: resolved at the seam)", async () => {
    approvedGraph("g-unknown", makeNode({ workerAdapter: "unknown-worker" }));
    let err: GorpError | null = null;
    try {
      await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-unknown", actorId: "orch" }, clock);
    } catch (e) {
      err = e as GorpError;
    }
    expect(err).not.toBeNull();
    expect(err!.code).toBe("NOT_IMPLEMENTED");
    expect(err!.details["implemented"]).toEqual(["fixture", "omp"]);
    // fail closed with ZERO mutation: no sandbox, no run dir, graph untouched
    expect(existsSync(sandboxDir(cfg, "p1", { graphId: "g-unknown", nodeId: "node-1", runId: DEFAULT_RUN_ID }))).toBe(false);
    const g = new GraphStore(cfg).load("p1", "g-unknown");
    expect(g.status).toBe("approved"); // not even started
    expect(g.nodes[0]!.state).toBe("pending");
    expect(g.transitions).toHaveLength(1); // only the operator approval
  });


  it("stamps profile into run record when node has persona", async () => {
    approvedGraph("g-profile", makeNode({ persona: "architect" }));
    const out = await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-profile", actorId: "orch" }, clock);
    const rr = JSON.parse(readFileSync(out.records.runRecord, "utf8")) as RunRecord;
    expect(rr.profile).toBeDefined();
    expect(rr.profile!.persona).toBe("architect");
    expect(rr.profile!.model).toBe("default");
  });

  it("omits profile from run record when node has no persona", async () => {
    approvedGraph("g-noprofile", makeNode());
    const out = await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-noprofile", actorId: "orch" }, clock);
    const rr = JSON.parse(readFileSync(out.records.runRecord, "utf8")) as RunRecord;
    expect(rr.profile).toBeUndefined();
  });

  it("worker output is deterministic for identical inputs", async () => {
    approvedGraph("g-det", makeNode());
    const out = await executeRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-det", actorId: "orch" }, clock);
    const artifact = readFileSync(join(out.sandbox!.dir, "docs/note.md"), "utf8");
    expect(artifact).toBe(
      [
        "# add a governed note",
        "",
        "artifact: docs/note.md",
        "graph: g-det",
        "node: node-1",
        `run: ${out.runId}`,
        "task-type: fixture-mutation",
        "",
        "acceptance criteria:",
        "- note exists",
        "",
      ].join("\n"),
    );
  });
});
