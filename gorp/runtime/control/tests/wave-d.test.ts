import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  auditChainPath,
  gateRecordPath,
  loadConfig,
  promotionRecordPath,
  reviewDecisionPath,
  workerResultPath,
  type RunRef,
  type RuntimeConfig,
} from "../src/config/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { DEFAULT_RUN_ID, executeRun, type RunOutput } from "../src/run/run.js";
import { executeApprove, executeReject } from "../src/review/decision.js";
import { executePromote } from "../src/promote/promote.js";
import { inspectRun } from "../src/inspect/inspect.js";
import { GorpError } from "../src/errors/index.js";
import type { GraphNode, ReviewDecision } from "../src/contracts/types.js";

const clock: Clock = { now: () => "2026-07-15T10:00:00.000Z" };

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

function approveArgs(graphId: string, reviewedCommit: string) {
  return { projectId: "p1", graphId, nodeId: "node-1", actorId: "reviewer:op", reason: "looks correct", reviewedCommit };
}
function rejectArgs(graphId: string) {
  return { projectId: "p1", graphId, nodeId: "node-1", actorId: "reviewer:op", reason: "not wanted" };
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

/** Recursive content snapshot of a directory (paths + file hashes + sizes). */
function snapshot(dir: string): string {
  const lines: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      const st = statSync(p);
      if (st.isDirectory()) {
        lines.push(`dir ${p}`);
        walk(p);
      } else {
        lines.push(`file ${p} ${createHash("sha256").update(readFileSync(p)).digest("hex")}`);
      }
    }
  };
  walk(dir);
  return lines.join("\n");
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-waved-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = mkdtempSync(join(tmpdir(), "gorp-waved-repo-"));
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

describe("Wave D decisions: approve / reject split from promote", () => {
  it("approve only records the decision: no promotion, no target change, sandbox kept, gate untouched", async () => {
    const run = await reviewedRun("g-approve");
    const targetHead = git(["rev-parse", "HEAD"], repo).trim();
    const gateBytes = readFileSync(run.records.gateRecord, "utf8");

    const out = executeApprove(cfg, approveArgs("g-approve", run.sandbox!.headCommit), clock);

    expect(out.decision.decision).toBe("approved");
    expect(out.decision.reviewedArtifactHash).toBe(run.sandbox!.headCommit);
    expect(out.decision.gateRecordSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(out.decision.decidedAt).toBe(clock.now());
    expect(out.nodeState).toBe("approved");
    expect(out.graphStatus).toBe("running");
    expect(out.sandboxDestroyed).toBe(false);

    // nothing else happened
    expect(git(["rev-parse", "HEAD"], repo).trim()).toBe(targetHead);
    expect(existsSync(promotionRecordPath(cfg, "p1", nodeRef("g-approve")))).toBe(false);
    expect(existsSync(run.sandbox!.dir)).toBe(true);
    expect(readFileSync(run.records.gateRecord, "utf8")).toBe(gateBytes);
  });

  it("reject path: decision recorded, node rejected, graph cancelled (terminal), sandbox destroyed, promote blocked forever", async () => {
    const run = await reviewedRun("g-reject");
    const out = executeReject(cfg, rejectArgs("g-reject"), clock);

    expect(out.decision.decision).toBe("rejected");
    expect(out.nodeState).toBe("rejected");
    // no "running after reject": rejection closes the graph in a terminal state
    expect(out.graphStatus).toBe("cancelled");
    const g = new GraphStore(cfg).load("p1", "g-reject");
    expect(g.status).toBe("cancelled");
    const last = g.transitions[g.transitions.length - 1]!;
    expect(last.entityType).toBe("graph");
    expect(last.toState).toBe("cancelled");
    expect(last.actorType).toBe("operator");
    expect(last.reasonCode).toBe("REVIEW_REJECTED");
    expect(out.sandboxDestroyed).toBe(true);
    expect(existsSync(run.sandbox!.dir)).toBe(false);
    expect(git(["branch", "--list", "gorp/run/*"], repo).trim()).toBe("");
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");

    // reject blocks promote
    expectCode(
      () => executePromote(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-reject", actorId: "op" }, clock),
      "PROMOTION_BLOCKED",
      "review-rejected",
    );
    // the decision record is the immutable evidence
    const d = JSON.parse(readFileSync(reviewDecisionPath(cfg, "p1", nodeRef("g-reject")), "utf8")) as ReviewDecision;
    expect(d.decision).toBe("rejected");
    expect(d.reason).toBe("not wanted");
  });

  it("double approve fails: one terminal decision per run", async () => {
    const run = await reviewedRun("g-double");
    executeApprove(cfg, approveArgs("g-double", run.sandbox!.headCommit), clock);
    expectCode(() => executeApprove(cfg, approveArgs("g-double", run.sandbox!.headCommit), clock), "REVIEW_BLOCKED", "already-decided");
  });

  it("approve after reject fails: decisions are terminal", async () => {
    const run = await reviewedRun("g-flip");
    executeReject(cfg, rejectArgs("g-flip"), clock);
    expectCode(() => executeApprove(cfg, approveArgs("g-flip", run.sandbox!.headCommit), clock), "REVIEW_BLOCKED", "already-decided");
  });

  it("promote without approval fails", async () => {
    await reviewedRun("g-noapproval");
    expectCode(
      () => executePromote(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-noapproval", actorId: "op" }, clock),
      "PROMOTION_BLOCKED",
      "no-review-decision",
    );
  });

  it("approve requires the exact reviewed commit", async () => {
    await reviewedRun("g-wrongsha");
    const bogus = git(["rev-parse", "HEAD"], repo).trim();
    expectCode(() => executeApprove(cfg, approveArgs("g-wrongsha", bogus), clock), "REVIEW_BLOCKED", "reviewed-commit");
  });
});

describe("Wave D inspect: complete read-only audit", () => {
  it("assembles everything after a full loop and verifies the hash chain", async () => {
    const run = await reviewedRun("g-inspect");
    executeApprove(cfg, approveArgs("g-inspect", run.sandbox!.headCommit), clock);
    const promoted = executePromote(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-inspect", actorId: "op" }, clock);

    const out = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-inspect" });
    expect(out.readOnly).toBe(true);
    expect(out.graph.status).toBe("running"); // promote does not complete the graph
    expect(out.graph.node.state).toBe("promoted");
    expect(out.workerResult.record!.outcome).toBe("succeeded");
    expect(out.gateRecord.record!.validation.status).toBe("passed");
    expect(out.reviewDecision.record!.decision).toBe("approved");
    expect(out.promotionRecord.record!.resultCommit).toBe(promoted.resultCommit);
    expect(out.sandbox).toBeNull(); // cleaned after promotion
    expect((out.decisions ?? []).length).toBeGreaterThan(0);
    expect(out.history).toHaveLength(7); // no graph-completion transition
    expect(out.errors).toEqual([]);
    expect(out.timestamps["reviewDecidedAt"]).toBe(clock.now());
    expect(out.timestamps["promotedAt"]).toBe(clock.now());

    // audit chain complete: every record chained in order, chain valid
    expect(out.integrity.chainValid).toBe(true);
    expect(out.integrity.chain.map((e) => e.event)).toEqual([
      "worker-result",
      "gate-record",
      "run-record",
      "review-decision",
      "promotion-record",
    ]);
    // hash-linked: prev of each entry is the entryHash of the one before
    for (let i = 1; i < out.integrity.chain.length; i++) {
      expect(out.integrity.chain[i]!.prev).toBe(out.integrity.chain[i - 1]!.entryHash);
    }
  });

  it("inspect never mutates: state root is byte-identical before and after", async () => {
    const run = await reviewedRun("g-ro");
    executeApprove(cfg, approveArgs("g-ro", run.sandbox!.headCommit), clock);
    const before = snapshot(stateHome);
    inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-ro", includeDiff: true });
    inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-ro" });
    expect(snapshot(stateHome)).toBe(before);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
  });

  it("tampered record is detected: edited gate record breaks the chain and blocks decisions", async () => {
    const run = await reviewedRun("g-tamper");
    const gatePath = gateRecordPath(cfg, "p1", nodeRef("g-tamper"));
    const gate = JSON.parse(readFileSync(gatePath, "utf8")) as { validation: { status: string } };
    gate.validation.status = "failed";
    writeFileSync(gatePath, JSON.stringify(gate, null, 2));

    // inspect reports it (read-only, does not throw)
    const out = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-tamper" });
    expect(out.integrity.chainValid).toBe(false);
    expect(out.integrity.problems.some((p) => p.kind === "file-hash" && p.detail.includes("gate-record"))).toBe(true);
    expect(out.errors.some((e) => e.includes("edited after it was chained"))).toBe(true);

    // and every mutating command fails closed on it
    expectCode(() => executeApprove(cfg, approveArgs("g-tamper", run.sandbox!.headCommit), clock), "AUDIT_TAMPERED");
    expectCode(() => executePromote(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-tamper", actorId: "op" }, clock), "AUDIT_TAMPERED");
  });

  it("tampered decision record is detected after approval", async () => {
    const run = await reviewedRun("g-tamper-decision");
    executeApprove(cfg, approveArgs("g-tamper-decision", run.sandbox!.headCommit), clock);
    const dPath = reviewDecisionPath(cfg, "p1", nodeRef("g-tamper-decision"));
    const d = JSON.parse(readFileSync(dPath, "utf8")) as { reviewer: string };
    d.reviewer = "someone-else";
    writeFileSync(dPath, JSON.stringify(d, null, 2));

    expectCode(() => executePromote(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-tamper-decision", actorId: "op" }, clock), "AUDIT_TAMPERED");
    const out = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-tamper-decision" });
    expect(out.integrity.chainValid).toBe(false);
  });

  it("edited chain line is detected (entry hash + prev link)", async () => {
    const run = await reviewedRun("g-chainline");
    const chainPath = auditChainPath(cfg, "p1", nodeRef("g-chainline"));
    const lines = readFileSync(chainPath, "utf8").trim().split("\n");
    const first = JSON.parse(lines[0]!) as { event: string; sha256: string };
    first.sha256 = "0".repeat(64); // forge the recorded file hash
    lines[0] = JSON.stringify(first);
    writeFileSync(chainPath, lines.join("\n") + "\n");

    const out = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-chainline" });
    expect(out.integrity.chainValid).toBe(false);
    expect(out.integrity.problems.some((p) => p.kind === "entry-hash")).toBe(true);
  });

  it("deleted record is detected", async () => {
    const run = await reviewedRun("g-missing");
    rmSync(workerResultPath(cfg, "p1", nodeRef("g-missing")));
    const out = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-missing" });
    expect(out.integrity.chainValid).toBe(false);
    expect(out.integrity.problems.some((p) => p.kind === "file-missing")).toBe(true);
    expect(out.workerResult.present).toBe(false);
  });

  it("inspect shows the failure evidence for a failed run (errors, history, chain intact)", async () => {
    let failed: GorpError | null = null;
    try {
      await reviewedRun("g-fail-ins", makeNode({ expectedArtifacts: ["src/evil.ts"] }));
    } catch (e) {
      failed = e as GorpError;
    }
    expect(failed).not.toBeNull();
    expect(failed!.code).toBe("GATE_FAILED");

    const out = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-fail-ins" });
    expect(out.graph.status).toBe("failed");
    expect(out.graph.node.state).toBe("failed");
    expect(out.sandbox).toBeNull(); // destroyed on failure
    expect(out.runRecord.record!.finalStatus).toBe("failed");
    // nothing hidden: the gate failure and failed transitions are surfaced
    expect(out.errors.some((e) => e.includes("changed-files-in-allowed-scope"))).toBe(true);
    expect(out.errors.some((e) => e.includes("-> failed"))).toBe(true);
    // the failure evidence itself is chain-protected and intact
    expect(out.integrity.chainValid).toBe(true);
    expect(out.integrity.chain.map((e) => e.event)).toEqual(["worker-result", "gate-record", "run-record"]);
  });
});

describe("Wave D inspect: deterministic trace (GOS-54)", () => {
  it("completed run exposes an ordered trace from persisted audit state", async () => {
    const run = await reviewedRun("g-trace");
    executeApprove(cfg, approveArgs("g-trace", run.sandbox!.headCommit), clock);
    executePromote(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-trace", actorId: "op" }, clock);

    const out = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-trace" });
    expect(out.readOnly).toBe(true);
    expect(out.trace.length).toBeGreaterThan(0);

    // steps sequential
    out.trace.forEach((e, i) => expect(e.step).toBe(i));
    // every event carries a timestamp
    out.trace.forEach((e) => expect(e.at).toBe(clock.now()));

    const names = out.trace.map((e) => e.event);
    const idx = (name: string) => names.indexOf(name);

    // full chronology: run -> dispatch -> invoke -> return -> gate -> review -> promote
    expect(idx("run-started")).toBeGreaterThanOrEqual(0);
    expect(idx("worker-dispatched")).toBeGreaterThan(idx("run-started"));
    expect(idx("worker-invoked")).toBeGreaterThan(idx("worker-dispatched"));
    expect(idx("worker-returned")).toBeGreaterThan(idx("worker-invoked"));
    expect(idx("gate-passed")).toBeGreaterThan(idx("worker-returned"));
    expect(idx("review-approved")).toBeGreaterThan(idx("gate-passed"));
    expect(idx("promoted")).toBeGreaterThan(idx("review-approved"));

    // sandbox-prepared decision present (control decisions derived)
    expect(names).toContain("create-sandbox");
    // fixture node carries no persona → no profile event; no usage written
    expect(names).not.toContain("worker-profile");
    expect(names).not.toContain("usage");
  });

  it("failed run trace stops at failure — no review/promote", async () => {
    let failed: GorpError | null = null;
    try {
      await reviewedRun("g-trace-fail", makeNode({ expectedArtifacts: ["src/evil.ts"] }));
    } catch (e) {
      failed = e as GorpError;
    }
    expect(failed).not.toBeNull();
    expect(failed!.code).toBe("GATE_FAILED");

    const out = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-trace-fail" });
    const names = out.trace.map((e) => e.event);
    expect(names).toContain("fail-run");
    expect(names).toContain("node-failed");
    expect(names).toContain("graph-failed");
    expect(names).toContain("destroy-sandbox");
    expect(names).not.toContain("review-approved");
    expect(names).not.toContain("promoted");

    // where it stopped: gate evidence precedes failure
    const idx = (name: string) => names.indexOf(name);
    expect(idx("persist-gate-record")).toBeGreaterThan(-1);
    expect(idx("fail-run")).toBeGreaterThan(idx("persist-gate-record"));
    expect(idx("node-failed")).toBeGreaterThan(idx("fail-run"));
  });

  it("trace is deterministic and read-only (identical across calls, no mutation)", async () => {
    const run = await reviewedRun("g-trace-ro");
    executeApprove(cfg, approveArgs("g-trace-ro", run.sandbox!.headCommit), clock);

    const before = snapshot(stateHome);
    const a = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-trace-ro" });
    const b = inspectRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-trace-ro" });

    expect(a.trace).toEqual(b.trace);
    expect(snapshot(stateHome)).toBe(before);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
  });
});
