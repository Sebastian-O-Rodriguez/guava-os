import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Orchestrator-readiness proof (public surface ONLY).
 *
 * This suite proves that an external scheduler can drive the runtime cleanly
 * through nothing but the PUBLIC surface:
 *   - the compiled CLI (node dist/cli/main.js) as a subprocess,
 *   - its structured JSON stdout (success envelope / {success:false, error}),
 *   - its documented exit codes (src/errors EXIT_CODES, per README),
 *   - the documented state layout under GORP_STATE_HOME.
 *
 * NO imports from ../src/** — deliberately. If this file needs a src import,
 * the public surface is insufficient and that is a finding.
 *
 * Crash model: every CLI call is already a separate process, so a scheduler
 * "crash" between steps is modeled as: after each command, throw away ALL
 * in-memory knowledge and re-discover state ONLY from `graph show` (plus
 * `review`/`inspect` where a run exists) before deciding the next command.
 * Duplicate delivery (the crashed scheduler re-sends the last command on
 * restart) must be REFUSED with a structured, non-mutating error.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const CLI = join(PKG, "dist", "cli", "main.js");
const PROJECT = "orch-project";

// Documented exit codes (README + src/errors/index.ts). Restated literally
// here — the scheduler branches on these numbers, never on prose.
const EXIT_OK = 0;
const EXIT_INVALID_ARGUMENT = 2;
const EXIT_GRAPH_ALREADY_EXISTS = 5;
const EXIT_ILLEGAL_STATE_TRANSITION = 7;
const EXIT_STATE_CONFLICT = 8;
const EXIT_PROMOTION_BLOCKED = 15;
const EXIT_REVIEW_BLOCKED = 17;

let stateHome: string;
let repo: string;
let docDir: string;

beforeAll(() => {
  // Ensure the compiled CLI exists for subprocess invocation.
  execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: PKG, stdio: "pipe" });
}, 120_000);

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-orch-state-"));
  repo = mkdtempSync(join(tmpdir(), "gorp-orch-repo-"));
  docDir = mkdtempSync(join(tmpdir(), "gorp-orch-doc-"));
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# consumer\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
  registerProjects({ [PROJECT]: repo });
});
afterEach(() => {
  delete process.env["GORP_PROJECT_REGISTRY"];
  rmSync(stateHome, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
  rmSync(docDir, { recursive: true, force: true });
});

// --- helpers ----------------------------------------------------------------

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

interface CliCall {
  readonly stdout: string;
  readonly code: number;
}

function runCli(argv: string[]): CliCall {
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

interface CliError {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
}

function parseOk<T>(call: CliCall): T {
  expect(call.code).toBe(EXIT_OK);
  const j = JSON.parse(call.stdout) as { success: boolean; data: T };
  expect(j.success).toBe(true);
  return j.data;
}

/** Every refusal must be a structured envelope: success:false + error.code + machine-readable details. */
function parseErr(call: CliCall, expectedExit: number, expectedCode: string): CliError {
  expect(call.code).toBe(expectedExit);
  const j = JSON.parse(call.stdout) as { success: boolean; error: CliError };
  expect(j.success).toBe(false);
  expect(j.error.code).toBe(expectedCode);
  expect(typeof j.error.message).toBe("string");
  expect(j.error.details).toBeTypeOf("object");
  return j.error;
}

// --- graph document (public --from surface) ----------------------------------

function nodeSpec(nodeId: string, artifact: string, deps: string[]): Record<string, unknown> {
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

/** Write a schema-conformant two-node graph document and return its path. */
function writeTwoNodeDoc(graphId: string): string {
  const doc = {
    schemaVersion: 1,
    graphId,
    project: { projectId: PROJECT },
    baseCommit: git(["rev-parse", "HEAD"], repo).trim(),
    approvalStatus: "unapproved",
    provenance: { createdBy: "sched", createdByType: "operator", createdAt: new Date().toISOString() },
    status: "draft",
    nodes: [nodeSpec("n1", "docs/one.md", []), nodeSpec("n2", "docs/two.md", ["n1"])],
    transitions: [],
  };
  const path = join(docDir, `${graphId}.json`);
  writeFileSync(path, JSON.stringify(doc, null, 2));
  return path;
}

function createArgv(graphId: string): string[] {
  return ["graph", "create", "--from", writeTwoNodeDoc(graphId), "--actor-id", "sched"];
}

function approveGraphArgv(graphId: string): string[] {
  return [
    "graph", "transition", "--project-id", PROJECT, "--graph-id", graphId,
    "--to", "approved", "--actor-type", "operator", "--actor-id", "op",
    "--reason-code", "OPERATOR_APPROVAL", "--reason", "operator approved the two-node graph",
  ];
}

function createAndApprove(graphId: string): void {
  expect(runCli(createArgv(graphId)).code).toBe(EXIT_OK);
  expect(runCli(approveGraphArgv(graphId)).code).toBe(EXIT_OK);
}

// --- crash-restart scheduler: state discovery + mechanical decision ----------

interface NodeView {
  readonly nodeId: string;
  readonly state: string;
  readonly dependencies: readonly string[];
}
interface GraphView {
  readonly status: string;
  readonly approvalStatus: string;
  readonly nodes: readonly NodeView[];
  readonly transitions: readonly unknown[];
}

/** The ONLY memory a restarted scheduler has: projectId + graphId -> graph show. */
function showGraph(graphId: string): GraphView {
  return parseOk<GraphView>(runCli(["graph", "show", "--project-id", PROJECT, "--graph-id", graphId]));
}

interface InspectView {
  readonly readOnly: boolean;
  readonly integrity: { chainValid: boolean };
  readonly errors: readonly string[];
  readonly promotionRecord: { record: { baseCommit: string; promotedCommit: string; resultCommit: string } | null };
  readonly reviewDecision: { record: { decision: string } | null };
}

function inspectNode(graphId: string, nodeId: string): InspectView {
  return parseOk<InspectView>(
    runCli(["inspect", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", nodeId]),
  );
}

interface ReviewView {
  readonly readOnly: boolean;
  readonly nodeState: string;
  readonly gateRecord: { validation: { status: string; artifactHash: string } } | null;
  readonly sandbox: { headCommit: string } | null;
}

/**
 * Re-discover the exact reviewed commit from the read-only `review` output:
 * the gate binds to the sandbox HEAD, so gate artifactHash === sandbox HEAD
 * is both an integrity assertion and the value `approve --reviewed-commit`
 * needs. A restarted scheduler needs NOTHING else.
 */
function discoverReviewedCommit(graphId: string, nodeId: string): string {
  const r = parseOk<ReviewView>(
    runCli(["review", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", nodeId]),
  );
  expect(r.readOnly).toBe(true);
  expect(r.gateRecord).not.toBeNull();
  expect(r.sandbox).not.toBeNull();
  expect(r.gateRecord!.validation.status).toBe("passed");
  expect(r.gateRecord!.validation.artifactHash).toMatch(/^[0-9a-f]{40}$/);
  expect(r.gateRecord!.validation.artifactHash).toBe(r.sandbox!.headCommit);
  return r.gateRecord!.validation.artifactHash;
}

type Action =
  | { kind: "run"; nodeId: string }
  | { kind: "approve"; nodeId: string }
  | { kind: "promote"; nodeId: string }
  | { kind: "complete" }
  | { kind: "done" };

/** Purely mechanical next-action derivation from re-discovered state. */
function decideNext(g: GraphView): Action {
  if (g.status === "completed") return { kind: "done" };
  const byId = new Map(g.nodes.map((n) => [n.nodeId, n] as const));
  const awaiting = g.nodes.find((n) => n.state === "awaiting_review");
  if (awaiting) return { kind: "approve", nodeId: awaiting.nodeId };
  const approved = g.nodes.find((n) => n.state === "approved");
  if (approved) return { kind: "promote", nodeId: approved.nodeId };
  const runnable = g.nodes.find(
    (n) => n.state === "pending" && n.dependencies.every((d) => byId.get(d)!.state === "promoted"),
  );
  if (runnable) return { kind: "run", nodeId: runnable.nodeId };
  if (g.nodes.every((n) => n.state === "promoted")) return { kind: "complete" };
  throw new Error(`scheduler wedged: no derivable action from ${JSON.stringify(g.nodes)}`);
}

function argvFor(graphId: string, action: Action, reviewedCommit?: string): string[] {
  switch (action.kind) {
    case "run":
      return ["run", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", action.nodeId, "--actor-id", "sched"];
    case "approve":
      return [
        "approve", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", action.nodeId,
        "--actor-id", "reviewer:sched", "--reviewed-commit", reviewedCommit!,
        "--reason", "scheduler-driven review approved",
      ];
    case "promote":
      return ["promote", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", action.nodeId, "--actor-id", "sched"];
    case "complete":
      return [
        "graph", "transition", "--project-id", PROJECT, "--graph-id", graphId,
        "--to", "completed", "--actor-type", "orchestrator", "--actor-id", "sched",
        "--reason-code", "ALL_NODES_PROMOTED", "--reason", "all nodes promoted",
      ];
    case "done":
      throw new Error("no argv for done");
  }
}

// --- state-home evidence (documented layout) ----------------------------------

function recordsDir(graphId: string, nodeId: string): string {
  return join(stateHome, "projects", PROJECT, "runs", graphId, nodeId, "run-1");
}

/**
 * "No lost state" after a crash: for every node whose (re-discovered) state
 * implies a completed step, the persisted evidence records must exist in the
 * documented layout.
 */
function assertNoLostState(graphId: string, g: GraphView): void {
  for (const n of g.nodes) {
    const ranStates = ["awaiting_review", "approved", "promoted"];
    if (!ranStates.includes(n.state)) continue;
    const dir = recordsDir(graphId, n.nodeId);
    for (const f of ["run-record.json", "worker-result.json", "gate-record.json", "audit-chain.jsonl"]) {
      expect(existsSync(join(dir, f)), `${n.nodeId}(${n.state}) must retain ${f}`).toBe(true);
    }
    if (n.state === "approved" || n.state === "promoted") {
      expect(existsSync(join(dir, "review-decision.json"))).toBe(true);
    }
    if (n.state === "promoted") {
      expect(existsSync(join(dir, "promotion-record.json"))).toBe(true);
    }
    // integrity + no recorded errors survive the crash
    const view = inspectNode(graphId, n.nodeId);
    expect(view.integrity.chainValid).toBe(true);
    expect(view.errors).toEqual([]);
  }
}

/** Recursive content snapshot (sha256 by relative path) for read-only proofs. */
function snapshotDir(root: string, exclude: (rel: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const r = rel === "" ? entry : `${rel}/${entry}`;
      if (exclude(r)) continue;
      if (statSync(abs).isDirectory()) walk(abs, r);
      else out[r] = createHash("sha256").update(readFileSync(abs)).digest("hex");
    }
  };
  if (existsSync(root)) walk(root, "");
  return out;
}

// ==============================================================================

describe("orchestrator readiness: crash-driven scheduler over the public surface", () => {
  it("crash-driven scheduler completes a two-node graph with no duplicates and no lost state", () => {
    const graphId = "orch-main";

    // --- create (then crash: duplicate create must be refused, not re-applied)
    expect(runCli(createArgv(graphId)).code).toBe(EXIT_OK);
    const dupCreate = parseErr(runCli(createArgv(graphId)), EXIT_GRAPH_ALREADY_EXISTS, "GRAPH_ALREADY_EXISTS");
    expect(dupCreate.details["graphId"]).toBe(graphId);
    const g0 = showGraph(graphId);
    expect(g0.status).toBe("draft");
    expect(g0.approvalStatus).toBe("unapproved");
    expect(g0.transitions).toHaveLength(0);

    // --- approve (then crash: duplicate approval transition refused, exit 7)
    expect(runCli(approveGraphArgv(graphId)).code).toBe(EXIT_OK);
    const dupApprove = parseErr(
      runCli(approveGraphArgv(graphId)),
      EXIT_ILLEGAL_STATE_TRANSITION,
      "ILLEGAL_STATE_TRANSITION",
    );
    expect(dupApprove.details["from"]).toBe("approved");
    expect(dupApprove.details["to"]).toBe("approved");
    const g1 = showGraph(graphId);
    expect(g1.status).toBe("approved");
    expect(g1.transitions).toHaveLength(1);

    // --- crash-restart scheduler loop ---------------------------------------
    // At each iteration: re-discover from `graph show` alone, derive ONE
    // action mechanically, execute it, then simulate the crash by re-issuing
    // the SAME command (duplicate delivery) and prove refusal + intact state.
    const executed: string[] = [];
    for (let i = 0; i < 12; i++) {
      // restart: all in-memory knowledge is gone; re-discover
      const g = showGraph(graphId);
      const action = decideNext(g);
      if (action.kind === "done") break;

      const reviewedCommit =
        action.kind === "approve" ? discoverReviewedCommit(graphId, action.nodeId) : undefined;
      const argv = argvFor(graphId, action, reviewedCommit);

      // the one derived step succeeds
      expect(runCli(argv).code, `step ${action.kind} must succeed`).toBe(EXIT_OK);
      executed.push(action.kind === "complete" ? "complete" : `${action.kind}:${action.nodeId}`);

      // snapshot the authoritative graph AFTER the step, BEFORE the duplicate
      const afterStep = showGraph(graphId);

      // crash + duplicate delivery of the exact same command
      const dup = runCli(argv);
      switch (action.kind) {
        case "run": {
          const err = parseErr(dup, EXIT_STATE_CONFLICT, "STATE_CONFLICT");
          expect(err.details["nodeId"]).toBe(action.nodeId);
          expect(err.details["state"]).toBe("awaiting_review"); // not pending anymore
          break;
        }
        case "approve": {
          const err = parseErr(dup, EXIT_REVIEW_BLOCKED, "REVIEW_BLOCKED");
          expect(err.details["check"]).toBe("already-decided");
          expect(err.details["decision"]).toBe("approved");
          expect(err.details["mutation"]).toBe(false);
          break;
        }
        case "promote": {
          const err = parseErr(dup, EXIT_PROMOTION_BLOCKED, "PROMOTION_BLOCKED");
          expect(err.details["check"]).toBe("node-state");
          expect(err.details["state"]).toBe("promoted");
          expect(err.details["mutation"]).toBe(false);
          break;
        }
        case "complete": {
          const err = parseErr(dup, EXIT_ILLEGAL_STATE_TRANSITION, "ILLEGAL_STATE_TRANSITION");
          expect(err.details["from"]).toBe("completed");
          expect(err.details["to"]).toBe("completed");
          break;
        }
        case "done":
          break;
      }

      // the refusal mutated NOTHING: authoritative graph is byte-identical
      const afterDup = showGraph(graphId);
      expect(JSON.stringify(afterDup)).toBe(JSON.stringify(afterStep));

      // no lost state: all evidence records for completed steps still exist,
      // chains verify, no recorded errors
      assertNoLostState(graphId, afterDup);
    }

    // the mechanical scheduler took exactly the canonical path, no repeats
    expect(executed).toEqual([
      "run:n1", "approve:n1", "promote:n1",
      "run:n2", "approve:n2", "promote:n2",
      "complete",
    ]);

    // --- terminal assertions (all re-discovered, nothing remembered) ---------
    const gEnd = showGraph(graphId);
    expect(gEnd.status).toBe("completed");
    expect(gEnd.nodes.map((n) => n.state)).toEqual(["promoted", "promoted"]);

    // both artifacts landed in the consumer repo
    expect(existsSync(join(repo, "docs", "one.md"))).toBe(true);
    expect(existsSync(join(repo, "docs", "two.md"))).toBe(true);

    // promotion records prove parentage: n2's commit sits directly on n1's
    const n1 = inspectNode(graphId, "n1");
    const n2 = inspectNode(graphId, "n2");
    expect(n1.promotionRecord.record).not.toBeNull();
    expect(n2.promotionRecord.record).not.toBeNull();
    expect(n1.integrity.chainValid).toBe(true);
    expect(n2.integrity.chainValid).toBe(true);
    const r1 = n1.promotionRecord.record!.resultCommit;
    const r2 = n2.promotionRecord.record!.resultCommit;
    expect(n2.promotionRecord.record!.baseCommit).toBe(r1); // n2 based on n1's result
    expect(git(["rev-parse", "HEAD"], repo).trim()).toBe(r2);
    expect(git(["rev-parse", "HEAD^"], repo).trim()).toBe(r1);

    // consumer repo clean, no leftover run branches
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
    expect(git(["branch", "--list", "gorp/run/*"], repo).trim()).toBe("");
  }, 120_000);

  it("ineligible node never runs: dependency refusal is structured and side-effect free", () => {
    const graphId = "orch-inelig";
    createAndApprove(graphId);

    // scheduler (wrongly) asks for n2 first: refused with machine-readable why
    const err = parseErr(
      runCli(["run", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n2", "--actor-id", "sched"]),
      EXIT_STATE_CONFLICT,
      "STATE_CONFLICT",
    );
    expect(err.details["nodeId"]).toBe("n2");
    expect(err.details["unmetDependencies"]).toEqual(["n1"]);

    // nothing moved: n2 still pending, only the approval transition exists
    const g = showGraph(graphId);
    expect(g.status).toBe("approved");
    expect(g.nodes.find((n) => n.nodeId === "n2")!.state).toBe("pending");
    expect(g.nodes.find((n) => n.nodeId === "n1")!.state).toBe("pending");
    expect(g.transitions).toHaveLength(1);

    // and no runs directory entry exists for n2 under the documented layout
    expect(existsSync(recordsDir(graphId, "n2"))).toBe(false);
    expect(existsSync(join(stateHome, "projects", PROJECT, "runs", graphId, "n2"))).toBe(false);
  }, 60_000);

  it("every failure leaves a clear next action: machine-readable error taxonomy", () => {
    const graphId = "orch-errors";
    createAndApprove(graphId);

    // unknown node -> INVALID_ARGUMENT(2) with the full node inventory
    const unknown = parseErr(
      runCli(["run", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "ghost", "--actor-id", "sched"]),
      EXIT_INVALID_ARGUMENT,
      "INVALID_ARGUMENT",
    );
    expect(unknown.details["nodeId"]).toBe("ghost");
    expect(unknown.details["knownNodes"]).toEqual(["n1", "n2"]);

    // run n1 succeeds once
    expect(
      runCli(["run", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1", "--actor-id", "sched"]).code,
    ).toBe(EXIT_OK);

    // run-again -> STATE_CONFLICT(8) with the node's actual state
    const runAgain = parseErr(
      runCli(["run", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1", "--actor-id", "sched"]),
      EXIT_STATE_CONFLICT,
      "STATE_CONFLICT",
    );
    expect(runAgain.details["nodeId"]).toBe("n1");
    expect(runAgain.details["state"]).toBe("awaiting_review");

    // promote before any decision -> PROMOTION_BLOCKED(15), check no-review-decision
    const promoteEarly = parseErr(
      runCli(["promote", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1", "--actor-id", "sched"]),
      EXIT_PROMOTION_BLOCKED,
      "PROMOTION_BLOCKED",
    );
    expect(promoteEarly.details["check"]).toBe("no-review-decision");
    expect(promoteEarly.details["mutation"]).toBe(false);

    // approve once (reviewed commit re-discovered from the read-only review)
    const reviewed = discoverReviewedCommit(graphId, "n1");
    const approveArgv = [
      "approve", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1",
      "--actor-id", "reviewer:sched", "--reviewed-commit", reviewed, "--reason", "ok",
    ];
    expect(runCli(approveArgv).code).toBe(EXIT_OK);

    // approve-again -> REVIEW_BLOCKED(17), check already-decided
    const approveAgain = parseErr(runCli(approveArgv), EXIT_REVIEW_BLOCKED, "REVIEW_BLOCKED");
    expect(approveAgain.details["check"]).toBe("already-decided");
    expect(approveAgain.details["decision"]).toBe("approved");

    // promote once
    const promoteArgv = ["promote", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1", "--actor-id", "sched"];
    expect(runCli(promoteArgv).code).toBe(EXIT_OK);

    // promote-after-promote -> PROMOTION_BLOCKED(15), check node-state
    const promoteAgain = parseErr(runCli(promoteArgv), EXIT_PROMOTION_BLOCKED, "PROMOTION_BLOCKED");
    expect(promoteAgain.details["check"]).toBe("node-state");
    expect(promoteAgain.details["state"]).toBe("promoted");

    // every refusal above carried error.code + typed details — a scheduler can
    // branch on (exitCode, error.code, details.check/state/unmetDependencies/
    // knownNodes) without ever parsing prose.
  }, 60_000);

  it("state discovery is sufficient after restart: graph show + read-only review recover the reviewed commit", () => {
    const graphId = "orch-resume";
    createAndApprove(graphId);
    expect(
      runCli(["run", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1", "--actor-id", "sched"]).code,
    ).toBe(EXIT_OK);

    // --- total amnesia: a fresh scheduler knows ONLY projectId + graphId -----
    const g = showGraph(graphId);
    expect(g.status).toBe("running");
    const awaiting = g.nodes.filter((n) => n.state === "awaiting_review");
    expect(awaiting.map((n) => n.nodeId)).toEqual(["n1"]); // found without any memory

    // review is read-only: durable records + graph doc are byte-identical
    // around it (sandbox worktree internals and transient locks excluded —
    // git may refresh its index metadata on read).
    const exclude = (rel: string): boolean => rel.includes("sandbox") || rel.endsWith(".lock");
    const before = snapshotDir(stateHome, exclude);
    const reviewCall = runCli(["review", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1"]);
    const review = parseOk<ReviewView>(reviewCall);
    const after = snapshotDir(stateHome, exclude);
    expect(after).toEqual(before);

    // the review output alone yields the exact commit approve needs
    expect(review.readOnly).toBe(true);
    expect(review.nodeState).toBe("awaiting_review");
    expect(review.gateRecord!.validation.artifactHash).toBe(review.sandbox!.headCommit);
    const reviewedCommit = review.gateRecord!.validation.artifactHash;
    expect(reviewedCommit).toMatch(/^[0-9a-f]{40}$/);

    // and it is sufficient: the recovered commit satisfies approve
    expect(
      runCli([
        "approve", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1",
        "--actor-id", "reviewer:sched", "--reviewed-commit", reviewedCommit, "--reason", "recovered after restart",
      ]).code,
    ).toBe(EXIT_OK);
  }, 60_000);

  it("GAP CLOSED: premature completion is refused while a node is non-terminal; the node stays workable", () => {
    // The all-nodes-terminal guard (invariant fix, 2026-07-16) refuses
    // running -> completed while any node is pending/ready/running/blocked/
    // awaiting_review/approved. See tests/invariants.test.ts for full coverage.
    const graphId = "orch-probe";
    createAndApprove(graphId);

    // drive n1 all the way; n2 stays pending; graph is running
    expect(
      runCli(["run", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1", "--actor-id", "sched"]).code,
    ).toBe(EXIT_OK);
    const reviewed = discoverReviewedCommit(graphId, "n1");
    expect(
      runCli([
        "approve", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1",
        "--actor-id", "reviewer:sched", "--reviewed-commit", reviewed, "--reason", "ok",
      ]).code,
    ).toBe(EXIT_OK);
    expect(
      runCli(["promote", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n1", "--actor-id", "sched"]).code,
    ).toBe(EXIT_OK);
    const mid = showGraph(graphId);
    expect(mid.status).toBe("running");
    expect(mid.nodes.find((n) => n.nodeId === "n2")!.state).toBe("pending");

    // premature completion is REFUSED with a machine-readable why
    const premature = parseErr(
      runCli([
        "graph", "transition", "--project-id", PROJECT, "--graph-id", graphId,
        "--to", "completed", "--actor-type", "orchestrator", "--actor-id", "sched",
        "--reason-code", "PREMATURE_COMPLETE", "--reason", "probe: node n2 is still pending",
      ]),
      EXIT_ILLEGAL_STATE_TRANSITION,
      "ILLEGAL_STATE_TRANSITION",
    );
    expect(premature.details["reason"]).toBe("nodes_not_terminal");
    expect(premature.details["nonTerminalNodes"]).toEqual([{ nodeId: "n2", state: "pending" }]);

    // nothing wedged: the graph is still running and n2 remains fully workable
    const after = showGraph(graphId);
    expect(after.status).toBe("running");
    expect(after.nodes.find((n) => n.nodeId === "n2")!.state).toBe("pending");
    expect(
      runCli(["run", "--project-id", PROJECT, "--graph-id", graphId, "--node-id", "n2", "--actor-id", "sched"]).code,
    ).toBe(EXIT_OK);
  }, 60_000);
});
