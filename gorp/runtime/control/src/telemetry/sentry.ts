/**
 * GOS-59: Sentry error reporter for fail-closed outcomes (GOS-56 design).
 *
 * Minimal CLI mode: initializes `@sentry/node` ONLY when a DSN is set, and
 * captures one event per fail-closed outcome with a structured fingerprint
 * (never derived from human message text), shared tags, and structured
 * contexts. Privacy-first: no prompts, secrets, diffs, or free text —
 * `blocker.detail` and `reason` are never sent.
 *
 * Principles:
 * - Opt-in (GORP_SENTRY_DSN / GORP_SENTRY_URL); no DSN → every function no-ops.
 * - Fail-open: a Sentry failure never affects execution.
 */

import * as Sentry from "@sentry/node";
import type { Event, SeverityLevel } from "@sentry/node";
import { existsSync } from "node:fs";

import { EXIT_CODES, type GorpErrorCode } from "../errors/index.js";
import { readValidatedRecord } from "../run/records.js";
import {
  gateRecordPath,
  reviewDecisionPath,
  runRecordPath,
  workerResultPath,
  type RunRef,
  type RuntimeConfig,
} from "../config/index.js";
import type {
  GateRecord,
  ReviewDecision,
  RunRecord,
  WorkerResult,
} from "../contracts/types.js";

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initSentry(): void {
  if (Sentry.isInitialized()) return;
  const dsn = process.env["GORP_SENTRY_DSN"] ?? process.env["GORP_SENTRY_URL"];
  if (!dsn) return;
  // Minimal CLI mode: no default integrations (which would install global
  // uncaught-exception / unhandled-rejection handlers that change CLI
  // behavior). captureEvent still works — integrations are additive.
  Sentry.initWithoutDefaultIntegrations({ dsn });
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

interface Classification {
  readonly fingerprint: readonly string[];
  readonly level: SeverityLevel;
  readonly message: string;
  readonly errorCode?: GorpErrorCode;
  readonly context: Readonly<Record<string, unknown>>;
}

/**
 * Classify a fail-closed outcome (design doc classification table). Returns
 * null for outcomes that do not produce an event (succeeded / cancelled).
 * Priority: worker failure > gate failure > review reject > bare final status.
 */
function classifyFailClosed(
  runRecord: RunRecord,
  workerResult: WorkerResult | undefined,
  gateRecord: GateRecord | undefined,
  reviewDecision: ReviewDecision | undefined,
): Classification | null {
  // Worker failure — outcome failed/blocked. Fingerprint keyed on structured
  // code (blocker.code ?? exit_code), never message text.
  if (workerResult && (workerResult.outcome === "failed" || workerResult.outcome === "blocked")) {
    const code = workerResult.blocker?.code ?? (workerResult.exitCode !== undefined ? String(workerResult.exitCode) : "unknown");
    return {
      fingerprint: ["gorp", "worker-failed", code],
      level: "error",
      message: `gorp worker failed (${code})`,
      errorCode: "WORKER_FAILED",
      context: {
        worker_outcome: workerResult.outcome,
        ...(workerResult.exitCode !== undefined ? { exit_code: workerResult.exitCode } : {}),
        ...(workerResult.blocker
          ? { blocker: { code: workerResult.blocker.code, irreducible: workerResult.blocker.irreducible ?? false } }
          : {}),
      },
    };
  }

  // Gate failure — validation failed. Fingerprint keyed on failed check names.
  if (gateRecord && gateRecord.validation.status === "failed") {
    const failedChecks = gateRecord.validation.checks
      .filter((c) => c.status === "failed")
      .map((c) => c.name);
    return {
      fingerprint: ["gorp", "gate-failed", ...failedChecks],
      level: "error",
      message: `gorp gate failed (${failedChecks.length > 0 ? failedChecks.join(", ") : "no checks"})`,
      errorCode: "GATE_FAILED",
      context: { failed_checks: failedChecks },
    };
  }

  // Review reject — a verdict, not a system fault → warning.
  if (reviewDecision?.decision === "rejected") {
    return {
      fingerprint: ["gorp", "review-rejected"],
      level: "warning",
      message: "gorp review rejected",
      context: { decision: reviewDecision.decision },
    };
  }

  // Bare fail-closed final status (no explanatory sub-record).
  if (runRecord.finalStatus === "failed" || runRecord.finalStatus === "blocked") {
    return {
      fingerprint: ["gorp", `run-${runRecord.finalStatus}`],
      level: "error",
      message: `gorp run ${runRecord.finalStatus}`,
      context: {},
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export function captureFailClosed(
  runRecord: RunRecord,
  workerResult?: WorkerResult,
  gateRecord?: GateRecord,
  reviewDecision?: ReviewDecision,
): void {
  if (!Sentry.isInitialized()) return;

  const classification = classifyFailClosed(runRecord, workerResult, gateRecord, reviewDecision);
  if (!classification) return;

  const tags: Record<string, string> = {
    "gorp.project.id": runRecord.projectId,
    "gorp.graph.id": runRecord.graphId,
    "gorp.node.id": runRecord.nodeId,
    "gorp.run.id": runRecord.runId,
    "gorp.final.status": runRecord.finalStatus,
  };
  if (runRecord.profile?.persona !== undefined) tags["gorp.profile.persona"] = runRecord.profile.persona;
  if (runRecord.profile?.model !== undefined) tags["gorp.profile.model"] = runRecord.profile.model;
  if (runRecord.profile?.promptHash !== undefined) tags["gorp.profile.prompt_hash"] = runRecord.profile.promptHash;
  if (workerResult?.blocker?.irreducible === true) tags["gorp.blocker.irreducible"] = "true";
  if (classification.errorCode !== undefined) {
    tags["gorp.error.code"] = classification.errorCode;
    tags["gorp.error.exit_code"] = String(EXIT_CODES[classification.errorCode]);
  }

  const event: Event = {
    message: classification.message,
    level: classification.level,
    fingerprint: [...classification.fingerprint],
    tags,
    contexts: {
      gorp: {
        run_id: runRecord.runId,
        graph_id: runRecord.graphId,
        node_id: runRecord.nodeId,
        project_id: runRecord.projectId,
        final_status: runRecord.finalStatus,
        ...classification.context,
      },
    },
  };
  Sentry.captureEvent(event);
}

// ---------------------------------------------------------------------------
// Inline hook
// ---------------------------------------------------------------------------

export function reportFailClosed(
  cfg: RuntimeConfig,
  projectId: string,
  ref: RunRef,
): void {
  try {
    initSentry();
    if (!Sentry.isInitialized()) return;

    const rrPath = runRecordPath(cfg, projectId, ref);
    if (!existsSync(rrPath)) return;
    const runRecord = readValidatedRecord<RunRecord>("run-record", rrPath);

    let workerResult: WorkerResult | undefined;
    let gateRecord: GateRecord | undefined;
    let reviewDecision: ReviewDecision | undefined;
    try {
      const p = workerResultPath(cfg, projectId, ref);
      if (existsSync(p)) workerResult = readValidatedRecord<WorkerResult>("worker-result", p);
    } catch { /* best-effort */ }
    try {
      const p = gateRecordPath(cfg, projectId, ref);
      if (existsSync(p)) gateRecord = readValidatedRecord<GateRecord>("gate-record", p);
    } catch { /* best-effort */ }
    try {
      const p = reviewDecisionPath(cfg, projectId, ref);
      if (existsSync(p)) reviewDecision = readValidatedRecord<ReviewDecision>("review-decision", p);
    } catch { /* best-effort */ }

    captureFailClosed(runRecord, workerResult, gateRecord, reviewDecision);
  } catch {
    // fail-open: telemetry must never affect execution.
  }
}