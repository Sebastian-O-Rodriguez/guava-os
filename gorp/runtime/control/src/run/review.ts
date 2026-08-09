/**
 * `gorp review` (Wave B, per-node since Sprint 2A): READ-ONLY presentation of
 * one node run for the operator. Requires an explicit nodeId (no fallback).
 *
 * Shows graph/node state, the persisted worker result, gate record, and any
 * review decision, the changed files, and the sandbox diff against the
 * PER-NODE-RUN base recorded in the run record. Records no decision, approves
 * nothing, merges nothing, mutates nothing.
 */

import { existsSync } from "node:fs";
import { GorpError } from "../errors/index.js";
import {
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
import type { GateRecord, ReviewDecision, RunRecord, WorkerResult } from "../contracts/types.js";
import { sandboxChangedFiles, sandboxDiff, sandboxHead, type Sandbox } from "../sandbox/worktree.js";
import { currentRunId, sandboxBranchFor } from "./run.js";
import { resolveProjectRepoPath } from "../registry/projects.js";
import { selectNode } from "./policy.js";
import { readValidatedRecord } from "./records.js";

export interface ReviewInput {
  readonly projectId: string;
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId?: string;
}

export interface ReviewOutput {
  readonly readOnly: true;
  readonly runId: string;
  readonly nodeId: string;
  readonly graphStatus: string;
  readonly nodeState: string;
  readonly runRecord: RunRecord;
  readonly workerResult: WorkerResult | null;
  readonly gateRecord: GateRecord | null;
  readonly reviewDecision: ReviewDecision | null;
  readonly sandbox:
    | {
        readonly dir: string;
        readonly branch: string;
        readonly headCommit: string;
        readonly changedFiles: readonly string[];
        readonly diff: string;
      }
    | null;
  readonly note: string;
}

export function reviewRun(cfg: RuntimeConfig, input: ReviewInput): ReviewOutput {
  const store = new GraphStore(cfg);
  const graph = store.load(input.projectId, input.graphId);
  const node = selectNode(graph, input.nodeId);
  const ref: RunRef = { graphId: input.graphId, nodeId: node.nodeId, runId: input.runId ?? currentRunId(node) };

  const rDir = runDir(cfg, input.projectId, ref);
  if (!existsSync(rDir)) {
    throw new GorpError("RUN_NOT_FOUND", "no run exists for this node", { ...ref, runDir: rDir });
  }
  const runRecord = readValidatedRecord<RunRecord>("run-record", runRecordPath(cfg, input.projectId, ref));
  const wrPath = workerResultPath(cfg, input.projectId, ref);
  const grPath = gateRecordPath(cfg, input.projectId, ref);
  const rdPath = reviewDecisionPath(cfg, input.projectId, ref);
  const workerResult = existsSync(wrPath) ? readValidatedRecord<WorkerResult>("worker-result", wrPath) : null;
  const gateRecord = existsSync(grPath) ? readValidatedRecord<GateRecord>("gate-record", grPath) : null;
  const reviewDecision = existsSync(rdPath) ? readValidatedRecord<ReviewDecision>("review-decision", rdPath) : null;

  const sbDir = sandboxDir(cfg, input.projectId, ref);
  let sandboxView: ReviewOutput["sandbox"] = null;
  if (existsSync(sbDir)) {
    const sandbox: Sandbox = {
      dir: sbDir,
      branch: runRecord.sandboxIdentity ?? sandboxBranchFor(ref),
      repositoryPath: resolveProjectRepoPath(graph.project.projectId),
      baseCommit: runRecord.baseCommit, // per-node-run base
    };
    sandboxView = {
      dir: sbDir,
      branch: sandbox.branch,
      headCommit: sandboxHead(sandbox),
      changedFiles: sandboxChangedFiles(sandbox),
      diff: sandboxDiff(sandbox),
    };
  }

  return {
    readOnly: true,
    runId: ref.runId,
    nodeId: node.nodeId,
    graphStatus: graph.status,
    nodeState: node.state,
    runRecord,
    workerResult,
    gateRecord,
    reviewDecision,
    sandbox: sandboxView,
    note:
      sandboxView === null
        ? "sandbox no longer exists (failed, rejected, or promoted run); records above are the retained evidence."
        : "Review presentation is read-only. Record a decision with `gorp approve` / `gorp reject`; then `gorp promote` if approved.",
  };
}
