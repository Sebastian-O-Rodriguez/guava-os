/**
 * `gorp promote` (Waves C+D, per-node since Sprint 2A): move ONE approved,
 * reviewed sandbox commit into the target branch. Requires an explicit
 * nodeId — no fallback to the first node.
 *
 *   run -> review pending -> approve OR reject -> promote only if approved
 *
 * Fail closed. NO rebase, NO merge, NO conflict resolution, NO retry.
 * NO mutation of any kind before every check passes. Promote writes exactly
 * one new immutable record (promotion-record.json, hashed into the audit
 * chain); it never edits the gate record, the review decision, or the run
 * record — those are append-only history.
 *
 * Sprint 2A semantics:
 *  - the base verified against the target HEAD is the PER-NODE-RUN base
 *    recorded in the run record (so node 2 can base on the HEAD produced by
 *    promoting node 1); graph.baseCommit is creation-time provenance only;
 *  - promotion marks the node `promoted` but DOES NOT complete the graph —
 *    graph completion belongs to the orchestrator (later); the graph stays
 *    `running` after a promotion.
 */

import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { GorpError } from "../errors/index.js";
import {
  auditChainPath,
  gateRecordPath,
  promotionRecordPath,
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
import type {
  ExecutionGraph,
  GateRecord,
  PromotionRecord,
  ReviewDecision,
  RunRecord,
  WorkerResult,
} from "../contracts/types.js";
import { applyNodeTransition, systemClock, type Clock } from "../graph/graph.js";
import { destroySandbox, git, sandboxChangedFiles, sandboxHead, sandboxIsClean, type Sandbox } from "../sandbox/worktree.js";
import { buildGateRecord, scopeChecks } from "../gate/scope.js";
import { runCommandChecks } from "../gate/commands.js";
import { currentRunId, sandboxBranchFor } from "../run/run.js";
import { resolveProjectRepoPath } from "../registry/projects.js";
import { selectNode } from "../run/policy.js";
import { readValidatedRecord } from "../run/records.js";
import { appendChainEntry, assertChainIntact, fileSha256 } from "../audit/chain.js";

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const PROMOTE_NAME = "gorp-promote";
const PROMOTE_EMAIL = "promote@gorp.local";

function blocked(check: string, message: string, details: Record<string, unknown> = {}): never {
  throw new GorpError("PROMOTION_BLOCKED", `promotion blocked (${check}): ${message}`, {
    check,
    ...details,
    mutation: false, // nothing was mutated: all checks run before any write
  });
}

/**
 * Apply exactly one commit onto the target repository via cherry-pick.
 * On conflict: abort, restore a pristine tree, fail closed. Exported for
 * direct testing (the full promote flow makes a conflict unreachable by
 * construction because target HEAD must equal the reviewed commit's parent).
 */
export function cherryPickCommit(repositoryPath: string, sha: string, clock: Clock): string {
  try {
    git(
      ["-c", `user.name=${PROMOTE_NAME}`, "-c", `user.email=${PROMOTE_EMAIL}`, "cherry-pick", sha],
      repositoryPath,
      { GIT_COMMITTER_DATE: clock.now() },
    );
  } catch (e) {
    // NO conflict resolution, NO retry: abort and fail closed.
    try {
      git(["cherry-pick", "--abort"], repositoryPath);
    } catch {
      /* nothing in progress */
    }
    const status = git(["status", "--porcelain"], repositoryPath).stdout.trim();
    throw new GorpError("PROMOTION_CONFLICT", "cherry-pick failed; aborted with no partial application", {
      sha,
      repositoryPath,
      restoredClean: status === "",
      cause: e instanceof GorpError ? e.details : String(e),
    });
  }
  return git(["rev-parse", "HEAD"], repositoryPath).stdout.trim();
}

export interface PromoteInput {
  readonly projectId: string;
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId?: string;
  /** Operator performing the promotion; recorded in the promotion record. */
  readonly actorId: string;
}

export interface PromoteOutput {
  readonly runId: string;
  readonly nodeId: string;
  readonly promotedCommit: string; // reviewed sandbox commit (artifactHash)
  readonly resultCommit: string; // resulting commit on the target branch
  readonly graphStatus: string; // stays "running": orchestrator owns completion
  readonly nodeState: string;
  readonly reviewDecision: ReviewDecision;
  readonly promotionRecord: PromotionRecord;
  readonly sandboxCleaned: boolean;
  readonly records: {
    readonly runRecord: string;
    readonly gateRecord: string;
    readonly workerResult: string;
    readonly reviewDecision: string;
    readonly promotionRecord: string;
  };
}

export function executePromote(cfg: RuntimeConfig, input: PromoteInput, clock: Clock = systemClock): PromoteOutput {
  const store = new GraphStore(cfg);

  // --- load everything (read-only) ------------------------------------------
  const graph: ExecutionGraph = store.load(input.projectId, input.graphId);
  const node = selectNode(graph, input.nodeId);
  const repositoryPath = resolveProjectRepoPath(graph.project.projectId);
  const ref: RunRef = { graphId: input.graphId, nodeId: node.nodeId, runId: input.runId ?? currentRunId(node) };
  const rDir = runDir(cfg, input.projectId, ref);
  if (!existsSync(rDir)) {
    throw new GorpError("RUN_NOT_FOUND", "no run exists for this node", { ...ref, runDir: rDir });
  }
  const paths = {
    runRecord: runRecordPath(cfg, input.projectId, ref),
    gateRecord: gateRecordPath(cfg, input.projectId, ref),
    workerResult: workerResultPath(cfg, input.projectId, ref),
    reviewDecision: reviewDecisionPath(cfg, input.projectId, ref),
    promotionRecord: promotionRecordPath(cfg, input.projectId, ref),
  };
  const chainPath = auditChainPath(cfg, input.projectId, ref);
  const resolveRef = (fileRef: string): string => `${rDir}/${fileRef}`;

  // --- verification chain: NO mutation until every check passes -------------
  // detect naive edits/deletions of chained records: verify the chain first
  // (integrity evidence only — no external anchor; see audit/chain.ts)
  assertChainIntact(chainPath, resolveRef);

  const runRecord = readValidatedRecord<RunRecord>("run-record", paths.runRecord);
  const gateRecord = readValidatedRecord<GateRecord>("gate-record", paths.gateRecord);
  const workerResult = readValidatedRecord<WorkerResult>("worker-result", paths.workerResult);

  // promote requires an approval: the separate, immutable review decision
  if (!existsSync(paths.reviewDecision)) {
    blocked("no-review-decision", "no review decision exists; run `gorp approve` or `gorp reject` first", {});
  }
  const decision = readValidatedRecord<ReviewDecision>("review-decision", paths.reviewDecision);
  if (decision.decision === "rejected") {
    blocked("review-rejected", "the review decision is rejected; rejected work can never be promoted", {
      decidedAt: decision.decidedAt,
      reviewer: decision.reviewer,
    });
  }
  if (decision.decision === "retry") {
    blocked("review-retry", "the review decision is retry; only a NEW run's approval can promote this node", {
      decidedAt: decision.decidedAt,
      reviewer: decision.reviewer,
    });
  }
  if (decision.runId !== ref.runId || decision.graphId !== graph.graphId || decision.nodeId !== node.nodeId) {
    blocked("decision-identity", "review decision does not reference this node run", {
      decision: { runId: decision.runId, graphId: decision.graphId, nodeId: decision.nodeId },
    });
  }
  if (runRecord.nodeId !== node.nodeId || runRecord.graphId !== graph.graphId) {
    blocked("record-identity", "run record does not reference this node", {
      record: { graphId: runRecord.graphId, nodeId: runRecord.nodeId },
    });
  }
  // the decision must still be bound to the exact gate it judged
  if (decision.gateRecordSha256 !== fileSha256(paths.gateRecord)) {
    blocked("decision-gate-binding", "review decision is not bound to the current gate record", {});
  }

  if (graph.status !== "running") {
    blocked("graph-status", "graph is not in a promotable run", { status: graph.status });
  }
  if (node.state !== "approved") {
    blocked("node-state", "node is not approved for promotion", { nodeId: node.nodeId, state: node.state });
  }
  if (runRecord.finalStatus !== "succeeded") {
    blocked("run-final-status", "run did not succeed", { finalStatus: runRecord.finalStatus });
  }
  if (workerResult.outcome !== "succeeded") {
    blocked("worker-outcome", "worker result is not succeeded", { outcome: workerResult.outcome });
  }
  if (gateRecord.validation.status !== "passed") {
    blocked("gate-validation", "persisted gate validation did not pass", {
      checks: gateRecord.validation.checks.filter((c) => c.status === "failed"),
    });
  }

  // verify the reviewed artifact identity
  const artifactHash = gateRecord.validation.artifactHash ?? "";
  if (!COMMIT_SHA.test(artifactHash)) {
    blocked("artifact-hash", "gate artifactHash is not a full commit SHA", { artifactHash });
  }
  if (decision.reviewedArtifactHash !== artifactHash) {
    blocked("reviewed-commit", "approved decision does not bind to the gate artifactHash", {
      reviewedArtifactHash: decision.reviewedArtifactHash,
      artifactHash,
    });
  }

  // verify sandbox: exists, inside the state root, HEAD == artifactHash, clean
  const sbDir = sandboxDir(cfg, input.projectId, ref);
  const sbRel = relative(resolve(cfg.stateHome), resolve(sbDir));
  if (sbRel.startsWith("..") || isAbsolute(sbRel)) {
    blocked("sandbox-path", "sandbox path escapes GORP_STATE_HOME", { sandbox: sbDir });
  }
  if (!existsSync(sbDir)) {
    blocked("sandbox-missing", "sandbox no longer exists; a destroyed run cannot be promoted", { sandbox: sbDir });
  }
  // per-node-run base: recorded at run start, NOT the graph's creation base
  const nodeRunBase = runRecord.baseCommit;
  const sandbox: Sandbox = {
    dir: sbDir,
    branch: runRecord.sandboxIdentity ?? sandboxBranchFor(ref),
    repositoryPath,
    baseCommit: nodeRunBase,
  };
  const head = sandboxHead(sandbox);
  if (head !== artifactHash) {
    blocked("sandbox-head", "sandbox HEAD does not equal the reviewed artifactHash", {
      sandboxHead: head,
      artifactHash,
    });
  }
  if (!sandboxIsClean(sandbox)) {
    blocked("sandbox-dirty", "sandbox has uncommitted changes", { sandbox: sbDir });
  }
  const objectType = git(["cat-file", "-t", artifactHash], sandbox.dir).stdout.trim();
  if (objectType !== "commit") {
    blocked("artifact-object", "artifactHash does not name a commit object", { artifactHash, objectType });
  }
  // the reviewed commit must sit DIRECTLY on the node-run base (one commit, no history games)
  const parent = git(["rev-parse", `${artifactHash}^`], sandbox.dir).stdout.trim();
  if (parent !== nodeRunBase) {
    blocked("artifact-parent", "reviewed commit is not a direct child of the recorded node-run base", {
      parent,
      nodeRunBase,
    });
  }

  // verify base commit: the target must not have moved since this node's run
  const targetHead = git(["rev-parse", "HEAD"], repositoryPath).stdout.trim();
  if (targetHead !== nodeRunBase) {
    blocked("base-commit", "target HEAD no longer matches this node run's recorded base commit", {
      targetHead,
      nodeRunBase,
    });
  }
  const targetStatus = git(["status", "--porcelain"], repositoryPath).stdout.trim();
  if (targetStatus !== "") {
    blocked("target-dirty", "target working tree is not clean", {});
  }

  // rerun the FULL gate live against the reviewed commit — scope checks AND
  // every project command (Sprint 3D: no stale gate; the persisted verdict is
  // never trusted alone). Any failure stops promotion before the cherry-pick
  // with the failing checks as evidence; sandbox and records are kept.
  const rerunInput = {
    graphId: graph.graphId,
    node,
    runId: ref.runId,
    changedFiles: sandboxChangedFiles(sandbox),
    sandboxClean: true,
    artifactHash,
  };
  const rerunScope = scopeChecks(rerunInput);
  if (rerunScope.some((c) => c.status === "failed")) {
    blocked("scope-rerun", "scope gate rerun failed", {
      checks: rerunScope.filter((c) => c.status === "failed"),
    });
  }
  const rerunCommands = runCommandChecks(node, sandbox.dir, clock);
  const rerun = buildGateRecord(rerunInput, [...rerunScope, ...rerunCommands]);
  if (rerun.validation.status !== "passed") {
    blocked("gate-rerun", "project command rerun failed against the reviewed commit", {
      checks: rerun.validation.checks.filter((c) => c.status === "failed"),
    });
  }

  // --- all checks passed: mutation begins ------------------------------------
  // 1. apply exactly the reviewed commit (conflict -> abort, fail closed)
  const resultCommit = cherryPickCommit(repositoryPath, artifactHash, clock);

  // 2. write the single immutable promotion record and chain it
  const promotionRecord: PromotionRecord = {
    schemaVersion: 1,
    graphId: graph.graphId,
    nodeId: node.nodeId,
    runId: ref.runId,
    baseCommit: nodeRunBase,
    promotedCommit: artifactHash,
    resultCommit,
    reviewDecisionSha256: fileSha256(paths.reviewDecision), // links promotion -> approval
    promotedBy: input.actorId,
    promotedAt: clock.now(),
  };
  const check = validateAgainst("promotion-record", promotionRecord);
  if (!check.valid) {
    throw new GorpError("SCHEMA_VALIDATION_FAILED", "promotion-record failed schema validation before persist", {
      issues: check.issues,
    });
  }
  atomicWriteJson(paths.promotionRecord, promotionRecord);
  appendChainEntry(chainPath, rDir, "promotion-record", "promotion-record.json", paths.promotionRecord, clock);

  // 3. graph owns state: approved -> promoted. The graph is NOT completed
  //    here — completion over all nodes belongs to the orchestrator (later).
  const next = applyNodeTransition(
    graph,
    { nodeId: node.nodeId, to: "promoted", actorType: "orchestrator", actorId: input.actorId, reasonCode: "PROMOTED", reasonText: `cherry-picked as ${resultCommit}` },
    clock,
  );
  store.update(next);

  // 4. cleanup sandbox (worktree + branch)
  destroySandbox(sandbox);

  const promotedNode = next.nodes.find((n) => n.nodeId === node.nodeId)!;
  return {
    runId: ref.runId,
    nodeId: node.nodeId,
    promotedCommit: artifactHash,
    resultCommit,
    graphStatus: next.status,
    nodeState: promotedNode.state,
    reviewDecision: decision,
    promotionRecord,
    sandboxCleaned: !existsSync(sbDir),
    records: paths,
  };
}
