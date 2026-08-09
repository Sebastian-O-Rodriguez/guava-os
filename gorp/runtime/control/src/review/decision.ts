/**
 * `gorp approve` / `gorp reject` / `gorp retry` (Wave D; retry Sprint 5A):
 * the human review decision, split out of promotion. Requires an explicit
 * nodeId — no fallback to the first node.
 *
 * Exactly ONE decision per node run, written once as an immutable
 * review-decision record, hashed into the append-only audit chain, and bound
 * to the exact gate the reviewer saw (gateRecordSha256) and the exact
 * artifact they judged (reviewedArtifactHash). No decision can be changed,
 * repeated, or reversed for a run: double decisions fail.
 *
 * approve ONLY records the decision (plus the node's awaiting_review ->
 * approved transition). It does not promote, merge, or touch the target.
 * reject records the decision, moves the node to rejected, closes the graph
 * as cancelled (terminal — never "running after reject"; this also ends the
 * other nodes' eligibility, conservative fail-closed policy), and destroys
 * the sandbox — rejected work can never be promoted.
 * retry records the decision, returns the node to pending for a FRESH
 * attempt (new runId, new records — this run's records and chain are kept
 * unchanged), keeps the graph running, and destroys the sandbox — a retried
 * run can never be promoted; only a new run's approval can.
 */

import { existsSync } from "node:fs";
import { GorpError } from "../errors/index.js";
import {
  auditChainPath,
  gateRecordPath,
  reviewDecisionPath,
  runDir,
  runRecordPath,
  sandboxDir,
  workerResultPath,
  type RunRef,
  type RuntimeConfig,
} from "../config/index.js";
import { GraphStore } from "../storage/graph-store.js";
import { atomicWriteJson } from "../storage/atomic.js";
import { validateAgainst } from "../contracts/validator.js";
import type { GateRecord, ReviewDecision, RunRecord } from "../contracts/types.js";
import { applyGraphTransition, applyNodeTransition, systemClock, type Clock } from "../graph/graph.js";
import { destroySandbox, sandboxHead, type Sandbox } from "../sandbox/worktree.js";
import { appendChainEntry, assertChainIntact, fileSha256 } from "../audit/chain.js";
import { currentRunId, sandboxBranchFor } from "../run/run.js";
import { resolveProjectRepoPath } from "../registry/projects.js";
import { selectNode } from "../run/policy.js";
import { readValidatedRecord } from "../run/records.js";

const COMMIT_SHA = /^[0-9a-f]{40}$/;

function reviewBlocked(check: string, message: string, details: Record<string, unknown> = {}): never {
  throw new GorpError("REVIEW_BLOCKED", `review blocked (${check}): ${message}`, {
    check,
    ...details,
    mutation: false,
  });
}

export interface DecisionInput {
  readonly projectId: string;
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId?: string;
  readonly actorId: string;
  readonly reason: string;
  /** approve only: the exact commit the operator reviewed. */
  readonly reviewedCommit?: string;
}

export interface DecisionOutput {
  readonly runId: string;
  readonly nodeId: string;
  readonly decision: ReviewDecision;
  readonly nodeState: string;
  readonly graphStatus: string;
  readonly sandboxDestroyed: boolean;
  readonly decisionPath: string;
}

function executeDecision(
  cfg: RuntimeConfig,
  input: DecisionInput,
  verdict: "approved" | "rejected" | "retry",
  clock: Clock,
): DecisionOutput {
  const store = new GraphStore(cfg);
  const graph = store.load(input.projectId, input.graphId);
  const node = selectNode(graph, input.nodeId);
  const ref: RunRef = { graphId: input.graphId, nodeId: node.nodeId, runId: input.runId ?? currentRunId(node) };
  const rDir = runDir(cfg, input.projectId, ref);
  if (!existsSync(rDir)) {
    throw new GorpError("RUN_NOT_FOUND", "no run exists for this node", { ...ref, runDir: rDir });
  }
  const chainPath = auditChainPath(cfg, input.projectId, ref);
  const resolveRef = (fileRef: string): string => `${rDir}/${fileRef}`;

  // Fail closed on any tampered/edited record before reading anything else.
  assertChainIntact(chainPath, resolveRef);

  const decisionPath = reviewDecisionPath(cfg, input.projectId, ref);
  if (existsSync(decisionPath)) {
    const existing = readValidatedRecord<ReviewDecision>("review-decision", decisionPath);
    reviewBlocked("already-decided", "a terminal review decision already exists for this run", {
      decision: existing.decision,
      decidedAt: existing.decidedAt,
    });
  }
  if (node.state !== "awaiting_review") {
    reviewBlocked("node-state", "node is not awaiting review", { nodeId: node.nodeId, state: node.state });
  }
  if (graph.status !== "running") {
    reviewBlocked("graph-status", "graph is not in a reviewable run", { status: graph.status });
  }
  const gatePath = gateRecordPath(cfg, input.projectId, ref);
  const gate = readValidatedRecord<GateRecord>("gate-record", gatePath);
  const runRecord = readValidatedRecord<RunRecord>("run-record", runRecordPath(cfg, input.projectId, ref));
  readValidatedRecord("worker-result", workerResultPath(cfg, input.projectId, ref));
  if (runRecord.nodeId !== node.nodeId || runRecord.graphId !== graph.graphId) {
    reviewBlocked("record-identity", "run record does not reference this node", {
      record: { graphId: runRecord.graphId, nodeId: runRecord.nodeId },
    });
  }
  if (runRecord.finalStatus !== "succeeded") {
    reviewBlocked("run-final-status", "run did not succeed", { finalStatus: runRecord.finalStatus });
  }
  if (gate.validation.status !== "passed") {
    reviewBlocked("gate-validation", "gate validation did not pass; there is nothing reviewable", {});
  }
  const artifactHash = gate.validation.artifactHash ?? "";
  if (!COMMIT_SHA.test(artifactHash)) {
    reviewBlocked("artifact-hash", "gate artifactHash is not a full commit SHA", { artifactHash });
  }

  const sbDir = sandboxDir(cfg, input.projectId, ref);
  if (!existsSync(sbDir)) {
    reviewBlocked("sandbox-missing", "sandbox no longer exists; nothing to review", { sandbox: sbDir });
  }
  const sandbox: Sandbox = {
    dir: sbDir,
    branch: runRecord.sandboxIdentity ?? sandboxBranchFor(ref),
    repositoryPath: resolveProjectRepoPath(graph.project.projectId),
    baseCommit: runRecord.baseCommit, // per-node-run base
  };
  const head = sandboxHead(sandbox);
  if (head !== artifactHash) {
    reviewBlocked("sandbox-head", "sandbox HEAD does not equal the gate artifactHash", {
      sandboxHead: head,
      artifactHash,
    });
  }
  if (verdict === "approved") {
    if (!input.reviewedCommit) {
      reviewBlocked("reviewed-commit", "approve requires --reviewed-commit (the exact commit you reviewed)", {});
    }
    if (input.reviewedCommit !== artifactHash) {
      reviewBlocked("reviewed-commit", "operator-stated reviewed commit does not match the gate artifactHash", {
        reviewedCommit: input.reviewedCommit,
        artifactHash,
      });
    }
  }

  // --- all checks passed: record the single immutable decision ---------------
  const decision: ReviewDecision = {
    schemaVersion: 1,
    graphId: graph.graphId,
    nodeId: node.nodeId,
    runId: ref.runId,
    decision: verdict,
    reviewer: input.actorId,
    reason: input.reason,
    reviewedArtifactHash: artifactHash,
    gateRecordSha256: fileSha256(gatePath), // binds decision to the exact gate reviewed
    decidedAt: clock.now(),
  };
  const check = validateAgainst("review-decision", decision);
  if (!check.valid) {
    throw new GorpError("SCHEMA_VALIDATION_FAILED", "review-decision failed schema validation before persist", {
      issues: check.issues,
    });
  }
  atomicWriteJson(decisionPath, decision);
  appendChainEntry(chainPath, rDir, "review-decision", "review-decision.json", decisionPath, clock);

  // graph owns state: the operator's decision is a node transition.
  // approve -> approved; reject -> rejected; retry -> pending (fresh attempt).
  const toState = verdict === "approved" ? "approved" : verdict === "rejected" ? "rejected" : "pending";
  const reasonCode =
    verdict === "approved" ? "REVIEW_APPROVED" : verdict === "rejected" ? "REVIEW_REJECTED" : "RETRY_REQUESTED";
  let next = applyNodeTransition(
    graph,
    {
      nodeId: node.nodeId,
      to: toState,
      actorType: "operator",
      actorId: input.actorId,
      reasonCode,
      reasonText: input.reason,
    },
    clock,
  );
  if (verdict === "rejected") {
    // A rejected run is terminal: the operator's rejection also closes the
    // graph (running -> cancelled). No graph is ever left `running` with a
    // rejected node.
    next = applyGraphTransition(
      next,
      {
        to: "cancelled",
        actorType: "operator",
        actorId: input.actorId,
        reasonCode: "REVIEW_REJECTED",
        reasonText: input.reason,
      },
      clock,
    );
  }
  store.update(next);

  // rejected work can never be promoted, and a retried run's sandbox must not
  // linger (only a NEW run's approval can promote): remove the sandbox.
  let sandboxDestroyed = false;
  if (verdict === "rejected" || verdict === "retry") {
    destroySandbox(sandbox);
    sandboxDestroyed = true;
  }

  return {
    runId: ref.runId,
    nodeId: node.nodeId,
    decision,
    nodeState: next.nodes.find((n) => n.nodeId === node.nodeId)!.state,
    graphStatus: next.status,
    sandboxDestroyed,
    decisionPath,
  };
}

export function executeApprove(cfg: RuntimeConfig, input: DecisionInput, clock: Clock = systemClock): DecisionOutput {
  return executeDecision(cfg, input, "approved", clock);
}

export function executeReject(cfg: RuntimeConfig, input: DecisionInput, clock: Clock = systemClock): DecisionOutput {
  return executeDecision(cfg, input, "rejected", clock);
}

/** Retry verdict (Sprint 5A): immutable decision; node returns to pending for a fresh attempt. */
export function executeRetry(cfg: RuntimeConfig, input: DecisionInput, clock: Clock = systemClock): DecisionOutput {
  return executeDecision(cfg, input, "retry", clock);
}
