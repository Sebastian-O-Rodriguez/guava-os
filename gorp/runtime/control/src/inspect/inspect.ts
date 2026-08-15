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
import { exportTraceFromRun, type TraceExportResult } from "../telemetry/index.js";
import type { SchemaName } from "../contracts/validator.js";

/** A single ordered trace event in the deterministic audit timeline. */
export interface TraceEvent {
  readonly step: number;
  readonly at: string;
  readonly event: string;
  readonly details?: Record<string, unknown>;
}

/** Optional usage annotation (GOS-55) — read gracefully when present. */
interface RunUsage {
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly tokensTotal?: number;
  readonly costUsd?: number;
  readonly durationMs?: number;
}

/**
 * Canonical lifecycle-phase ordering. Used as a secondary sort key when
 * timestamps collide (equal-at test clock), so the trace stays deterministic
 * and human-readable.
 */
const EVENT_PHASE: Readonly<Record<string, number>> = {
  "graph-approved": 0,
  "run-started": 10,
  "node-ready": 20,
  "worker-dispatched": 30,
  "start-run": 35,
  "create-sandbox": 40,
  "worker-profile": 45,
  "worker-invoked": 50,
  "worker-returned": 60,
  "persist-worker-result": 70,
  "persist-gate-record": 80,
  "gate-passed": 90,
  "await-review": 100,
  "review-approved": 110,
  "review-rejected": 110,
  "retry-requested": 110,
  "promoted": 120,
  "usage": 130,
  "fail-run": 200,
  "node-failed": 210,
  "graph-failed": 220,
  "graph-cancelled": 230,
  "destroy-sandbox": 240,
};

/** Map a transition record to a canonical event name. */
function transitionEventName(t: TransitionRecord): string {
  if (t.entityType === "node") {
    switch (t.reasonCode) {
      case "NODE_ELIGIBLE": return "node-ready";
      case "WORKER_START": return "worker-dispatched";
      case "GATE_PASSED": return "gate-passed";
      case "REVIEW_APPROVED": return "review-approved";
      case "REVIEW_REJECTED": return "review-rejected";
      case "RETRY_REQUESTED": return "retry-requested";
      case "PROMOTED": return "promoted";
      default:
        return t.toState === "failed" ? "node-failed" : `node-${t.toState}`;
    }
  }
  // graph transitions
  switch (t.reasonCode) {
    case "OPERATOR_APPROVAL": return "graph-approved";
    case "RUN_START": return "run-started";
    case "REVIEW_REJECTED": return "graph-cancelled";
    default:
      return t.toState === "failed" ? "graph-failed" : `graph-${t.toState}`;
  }
}

function phaseRank(event: string): number {
  return EVENT_PHASE[event] ?? 1000; // unknown events sink to the end
}

interface TraceItem {
  at: string;
  event: string;
  details?: Record<string, unknown>;
  rank: number;
  seq: number;
}

/**
 * Build the deterministic, read-only event trace from persisted audit sources.
 * Pure — never re-runs or mutates.
 */
export function buildTrace(input: {
  readonly nodeId: string;
  readonly transitions: readonly TransitionRecord[];
  readonly runRecord: RunRecord | null;
  readonly workerResult: WorkerResult | null;
}): TraceEvent[] {
  const items: TraceItem[] = [];
  let seq = 0;

  // 1. Transitions — this node's + all graph-level
  for (const t of input.transitions) {
    if (t.entityType === "node" && t.entityId !== input.nodeId) continue;
    const event = transitionEventName(t);
    items.push({
      at: t.timestamp,
      event,
      details: {
        from: t.fromState,
        to: t.toState,
        actor: t.actorId,
        reason: t.reasonText,
      },
      rank: phaseRank(event),
      seq: seq++,
    });
  }

  // 2. Control decisions
  const decisions = input.runRecord?.controlDecisions ?? [];
  const runStartedAt = input.runRecord?.startedAt ?? "";
  for (const d of decisions) {
    const at = d.at ?? runStartedAt;
    items.push({
      at,
      event: d.decision, // canonical decision name: "start-run", "create-sandbox", etc.
      details: {
        reasonCode: d.reasonCode,
        ...(d.reasonText !== undefined ? { reasonText: d.reasonText } : {}),
      },
      rank: phaseRank(d.decision),
      seq: seq++,
    });
  }

  // 3. Worker profile (GOS-46)
  const profile = input.runRecord?.profile;
  if (profile) {
    items.push({
      at: runStartedAt,
      event: "worker-profile",
      details: profile as unknown as Record<string, unknown>,
      rank: phaseRank("worker-profile"),
      seq: seq++,
    });
  }

  // 4. Worker invocation / return (actual execution window, from record timestamps)
  if (input.workerResult?.startedAt) {
    items.push({
      at: input.workerResult.startedAt,
      event: "worker-invoked",
      rank: phaseRank("worker-invoked"),
      seq: seq++,
    });
  }
  if (input.workerResult?.endedAt) {
    items.push({
      at: input.workerResult.endedAt,
      event: "worker-returned",
      details: { outcome: input.workerResult.outcome },
      rank: phaseRank("worker-returned"),
      seq: seq++,
    });
  }

  // 5. Usage (GOS-55, optional — read gracefully)
  const usage = input.runRecord ? (input.runRecord as RunRecord & { usage?: RunUsage }).usage : undefined;
  if (usage) {
    items.push({
      at: input.runRecord?.endedAt ?? runStartedAt,
      event: "usage",
      details: usage as unknown as Record<string, unknown>,
      rank: phaseRank("usage"),
      seq: seq++,
    });
  }

  // Sort: timestamp primary (lexicographic = chronological for ISO 8601),
  // then lifecycle-phase rank, then insertion sequence.
  items.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.seq - b.seq;
  });

  return items.map((it, i) => ({
    step: i,
    at: it.at,
    event: it.event,
    ...(it.details !== undefined ? { details: it.details } : {}),
  }));
}

export interface InspectInput {
  readonly projectId: string;
  readonly graphId: string;
  /** Explicit node to inspect. Required — no fallback to the first node. */
  readonly nodeId: string;
  readonly runId?: string;
  /** Include the full sandbox diff (can be large). */
  readonly includeDiff?: boolean;
  /** Export an OTel trace of the run (GOS-59). Opt-in via GORP_OTEL_ENABLED. */
  readonly includeTrace?: boolean;
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
  /**
   * Deterministic, ordered event timeline (GOS-54) — derived only from
   * persisted audit state (transitions, control decisions, record timestamps).
   * Read-only: never re-runs the node. Empty when there is no run evidence.
   */
  readonly trace: readonly TraceEvent[];
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
  /** OTel trace export result (GOS-59); null when trace export not requested. */
  readonly traceExport: TraceExportResult | null;
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
    trace: buildTrace({
      nodeId: node.nodeId,
      transitions: graph.transitions,
      runRecord: runRecord.record,
      workerResult: workerResult.record,
    }),
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
    traceExport: input.includeTrace === true ? safeTraceExport(cfg, input, ref) : null,
  };
}

/** Export the OTel trace best-effort; a telemetry failure never fails inspect. */
function safeTraceExport(cfg: RuntimeConfig, input: InspectInput, ref: RunRef): TraceExportResult {
  try {
    return exportTraceFromRun(cfg, input.projectId, ref);
  } catch (e) {
    return { status: "errored", error: e instanceof Error ? e.message : String(e) };
  }
}
