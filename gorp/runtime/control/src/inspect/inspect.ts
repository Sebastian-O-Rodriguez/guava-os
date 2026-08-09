/**
 * `gorp inspect` (Wave D): the complete, READ-ONLY audit view of one run.
 * One command; the human sees everything; nothing hidden; nothing mutated.
 *
 * Assembles: graph + node state and full transition history, worker result,
 * sandbox (if still present: HEAD, changed files, diff), gate record, review
 * decision, promotion record, control decisions, all timestamps, all recorded
 * errors, and the audit-chain integrity verdict (hash chain + per-file
 * content hashes), including exactly where verification broke.
 */

import { existsSync, readFileSync } from "node:fs";
import { GorpError } from "../errors/index.js";
import {
  auditChainPath,
  gateRecordPath,
  graphPath,
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
import type {
  ExecutionGraph,
  GateRecord,
  PromotionRecord,
  ReviewDecision,
  RunRecord,
  TransitionRecord,
  WorkerResult,
} from "../contracts/types.js";
import { sandboxChangedFiles, sandboxDiff, sandboxHead, type Sandbox } from "../sandbox/worktree.js";
import { currentRunId, sandboxBranchFor } from "../run/run.js";
import { resolveProjectRepoPath } from "../registry/projects.js";
import { selectNode } from "../run/policy.js";
import { readValidatedRecord } from "../run/records.js";
import { verifyChain, type ChainEntry, type ChainProblem } from "../audit/chain.js";
import type { SchemaName } from "../contracts/validator.js";

export interface InspectInput {
  readonly projectId: string;
  readonly graphId: string;
  /** Explicit node to inspect. Required — no fallback to the first node. */
  readonly nodeId: string;
  readonly runId?: string;
  /** Include the full sandbox diff (can be large). */
  readonly includeDiff?: boolean;
}

interface RecordView<T> {
  readonly present: boolean;
  readonly valid: boolean;
  readonly error?: string;
  readonly record: T | null;
}

export interface InspectOutput {
  readonly readOnly: true;
  readonly runId: string;
  readonly nodeId: string;
  readonly graph: {
    readonly graphId: string;
    readonly projectId: string;
    /** Resolved from the project registry at inspect time; null when unresolvable. */
    readonly repositoryPath: string | null;
    readonly baseCommit: string;
    readonly status: string;
    readonly approvalStatus: string;
    readonly createdAt: string;
    readonly node: {
      readonly nodeId: string;
      readonly state: string;
      readonly objective: string;
      readonly workerAdapter: string;
      readonly allowedPaths: readonly string[];
      readonly forbiddenPaths: readonly string[];
      readonly attempt: number;
    };
  };
  readonly history: readonly TransitionRecord[];
  readonly workerResult: RecordView<WorkerResult>;
  readonly gateRecord: RecordView<GateRecord>;
  readonly reviewDecision: RecordView<ReviewDecision>;
  readonly promotionRecord: RecordView<PromotionRecord>;
  readonly runRecord: RecordView<RunRecord>;
  readonly sandbox:
    | {
        readonly dir: string;
        readonly branch: string;
        readonly headCommit: string;
        readonly changedFiles: readonly string[];
        readonly diff: string | null;
      }
    | null;
  readonly decisions: RunRecord["controlDecisions"];
  readonly timestamps: Readonly<Record<string, string | null>>;
  readonly errors: readonly string[];
  readonly integrity: {
    readonly chainValid: boolean;
    readonly chainLength: number;
    readonly chain: readonly ChainEntry[];
    readonly problems: readonly ChainProblem[];
  };
  /**
   * Machine-readable recovery assessment (mid-run crash rule). A node in an
   * in-flight state (`ready`/`running`) between commands means `gorp run` was
   * interrupted: the runtime never leaves a node in-flight at rest. There is
   * NO auto-retry; the operator must act.
   */
  readonly recovery: {
    readonly state: "none" | "interrupted-run";
    readonly nodeState: string;
    readonly missingRecords: readonly string[];
    readonly autoRetry: false;
    readonly requiredAction: string | null;
  };
  readonly paths: Readonly<Record<string, string>>;
}

/** Node states that only ever exist WHILE `gorp run` is executing. */
const IN_FLIGHT_NODE_STATES = ["ready", "running"];

function view<T>(name: SchemaName, path: string): RecordView<T> {
  if (!existsSync(path)) return { present: false, valid: false, record: null };
  try {
    return { present: true, valid: true, record: readValidatedRecord<T>(name, path) };
  } catch (e) {
    // Show the broken record's problem instead of hiding it: raw parse if possible.
    let raw: T | null = null;
    try {
      raw = JSON.parse(readFileSync(path, "utf8")) as T;
    } catch {
      raw = null;
    }
    return {
      present: true,
      valid: false,
      error: e instanceof GorpError ? `${e.code}: ${e.message}` : String(e),
      record: raw,
    };
  }
}

export function inspectRun(cfg: RuntimeConfig, input: InspectInput): InspectOutput {
  const store = new GraphStore(cfg);
  const graph: ExecutionGraph = store.load(input.projectId, input.graphId);
  const node = selectNode(graph, input.nodeId);
  const ref: RunRef = { graphId: input.graphId, nodeId: node.nodeId, runId: input.runId ?? currentRunId(node) };
  // Forensic tool: resolve the repository path leniently — an unregistered or
  // moved project must not make the audit trail unreadable.
  let resolvedRepositoryPath: string | null = null;
  try {
    resolvedRepositoryPath = resolveProjectRepoPath(graph.project.projectId);
  } catch {
    resolvedRepositoryPath = null;
  }
  const rDir = runDir(cfg, input.projectId, ref);
  const interrupted = IN_FLIGHT_NODE_STATES.includes(node.state);
  if (!existsSync(rDir) && !interrupted) {
    // No run and the node is not in-flight: genuinely nothing to inspect.
    throw new GorpError("RUN_NOT_FOUND", "no run exists for this node", { ...ref, runDir: rDir });
  }
  // An in-flight node with a missing run dir is inspectable: it is EVIDENCE of
  // an interrupted run, and the recovery section below explains it.

  const paths = {
    graph: graphPath(cfg, input.projectId, input.graphId),
    runRecord: runRecordPath(cfg, input.projectId, ref),
    workerResult: workerResultPath(cfg, input.projectId, ref),
    gateRecord: gateRecordPath(cfg, input.projectId, ref),
    reviewDecision: reviewDecisionPath(cfg, input.projectId, ref),
    promotionRecord: promotionRecordPath(cfg, input.projectId, ref),
    auditChain: auditChainPath(cfg, input.projectId, ref),
    sandbox: sandboxDir(cfg, input.projectId, ref),
  };

  const workerResult = view<WorkerResult>("worker-result", paths.workerResult);
  const gateRecord = view<GateRecord>("gate-record", paths.gateRecord);
  const reviewDecision = view<ReviewDecision>("review-decision", paths.reviewDecision);
  const promotionRecord = view<PromotionRecord>("promotion-record", paths.promotionRecord);
  const runRecord = view<RunRecord>("run-record", paths.runRecord);

  let sandboxView: InspectOutput["sandbox"] = null;
  if (existsSync(paths.sandbox) && resolvedRepositoryPath !== null) {
    const sandbox: Sandbox = {
      dir: paths.sandbox,
      branch: runRecord.record?.sandboxIdentity ?? sandboxBranchFor(ref),
      repositoryPath: resolvedRepositoryPath,
      // per-node-run base (falls back to graph provenance if the record is broken)
      baseCommit: runRecord.record?.baseCommit ?? graph.baseCommit,
    };
    sandboxView = {
      dir: paths.sandbox,
      branch: sandbox.branch,
      headCommit: sandboxHead(sandbox),
      changedFiles: sandboxChangedFiles(sandbox),
      diff: input.includeDiff ? sandboxDiff(sandbox) : null,
    };
  }

  const integrity = verifyChain(paths.auditChain, (ref) => `${rDir}/${ref}`);

  // --- mid-run crash rule -----------------------------------------------------
  // Between commands a node is never at rest in ready/running; if it is, the
  // run was interrupted. Report which evidence records are missing. No
  // auto-retry exists (one attempt per node) — the operator must close it out.
  const requiredEvidence: Array<[string, boolean]> = [
    ["run-record.json", runRecord.present],
    ["worker-result.json", workerResult.present],
    ["gate-record.json", gateRecord.present],
  ];
  const missingRecords = requiredEvidence.filter(([, present]) => !present).map(([name]) => name);
  const recovery: InspectOutput["recovery"] = interrupted
    ? {
        state: "interrupted-run",
        nodeState: node.state,
        missingRecords,
        autoRetry: false,
        requiredAction:
          "operator action required: `gorp run` was interrupted mid-command. " +
          "No auto-retry exists (one attempt per node). Close the graph out with " +
          "`graph transition --to failed --actor-type system` (or `--to cancelled --actor-type operator`), " +
          "then manually remove the run directory and any leftover sandbox worktree/branch before re-authoring work.",
      }
    : {
        state: "none",
        nodeState: node.state,
        missingRecords: [],
        autoRetry: false,
        requiredAction: null,
      };

  const errors: string[] = [];
  if (recovery.state === "interrupted-run") {
    errors.push(
      `interrupted-run: node is '${node.state}' at rest with ${
        missingRecords.length > 0 ? `missing records (${missingRecords.join(", ")})` : "incomplete evidence"
      } — see recovery.requiredAction`,
    );
  }
  for (const [label, v] of Object.entries({ workerResult, gateRecord, reviewDecision, promotionRecord, runRecord })) {
    if (v.present && !v.valid && v.error) errors.push(`${label}: ${v.error}`);
  }
  for (const p of integrity.problems) errors.push(`audit-chain: ${p.detail}`);
  for (const t of graph.transitions) {
    if (t.toState === "failed") errors.push(`transition: ${t.entityType} ${t.fromState} -> failed (${t.reasonCode}: ${t.reasonText})`);
  }
  if (workerResult.record?.blocker) {
    errors.push(`worker blocker: ${workerResult.record.blocker.code}: ${workerResult.record.blocker.detail}`);
  }
  for (const c of gateRecord.record?.validation.checks ?? []) {
    if (c.status === "failed") errors.push(`gate check ${c.name}: ${c.detail ?? "failed"}`);
  }

  return {
    readOnly: true,
    runId: ref.runId,
    nodeId: node.nodeId,
    graph: {
      graphId: graph.graphId,
      projectId: graph.project.projectId,
      repositoryPath: resolvedRepositoryPath,
      baseCommit: graph.baseCommit,
      status: graph.status,
      approvalStatus: graph.approvalStatus,
      createdAt: graph.provenance.createdAt,
      node: {
        nodeId: node.nodeId,
        state: node.state,
        objective: node.objective,
        workerAdapter: node.workerAdapter,
        allowedPaths: node.allowedPaths,
        forbiddenPaths: node.forbiddenPaths,
        attempt: node.attempt,
      },
    },
    history: graph.transitions,
    workerResult,
    gateRecord,
    reviewDecision,
    promotionRecord,
    runRecord,
    sandbox: sandboxView,
    decisions: runRecord.record?.controlDecisions ?? [],
    timestamps: {
      graphCreatedAt: graph.provenance.createdAt,
      runStartedAt: runRecord.record?.startedAt ?? null,
      runEndedAt: runRecord.record?.endedAt ?? null,
      workerStartedAt: workerResult.record?.startedAt ?? null,
      workerEndedAt: workerResult.record?.endedAt ?? null,
      reviewDecidedAt: reviewDecision.record?.decidedAt ?? null,
      promotedAt: promotionRecord.record?.promotedAt ?? null,
    },
    errors,
    integrity: {
      chainValid: integrity.valid,
      chainLength: integrity.entries.length,
      chain: integrity.entries,
      problems: integrity.problems,
    },
    recovery,
    paths,
  };
}
