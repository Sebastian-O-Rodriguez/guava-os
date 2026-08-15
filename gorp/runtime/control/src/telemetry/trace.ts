/**
 * GOS-59: replay-based OTel trace exporter (GOS-56 design).
 *
 * Builds one root span (gorp.run) + child spans (gorp.node.worker,
 * gorp.node.gate, gorp.node.review, gorp.node.promotion) from persisted
 * run records. The audit chain is the single source of truth; this is a
 * read-only projection that never modifies the chain.
 *
 * Principles:
 * - Opt-in, off by default (GORP_OTEL_ENABLED env var gate).
 * - Fail-open: missing/disabled exporter never affects execution.
 * - Privacy-first: no prompts, secrets, diffs; changedFiles = count only.
 *   Free text (summary, reviewerNotes, reason, blocker.detail) redacted
 *   by default; exported only when GORP_TRACE_REDACT=false.
 * - Tampered chain → export nothing (verifyChain, fail-closed).
 */

import { existsSync } from "node:fs";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

import {
  auditChainPath,
  gateRecordPath,
  promotionRecordPath,
  reviewDecisionPath,
  runDir,
  runRecordPath,
  workerResultPath,
  type RunRef,
  type RuntimeConfig,
} from "../config/index.js";
import { verifyChain } from "../audit/chain.js";
import { readValidatedRecord } from "../run/records.js";
import type {
  GateRecord,
  PromotionRecord,
  ReviewDecision,
  RunFinalStatus,
  RunRecord,
  WorkerResult,
} from "../contracts/types.js";

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type TraceExportStatus =
  | "no-op" // env not set, nothing to do
  | "exported" // spans built + export initiated
  | "errored"; // enabled but something threw

export interface TraceExportResult {
  readonly status: TraceExportStatus;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO-8601 / epoch → nanoseconds for OTel span timestamps. */
function toEpochNs(iso: string | undefined): number {
  if (!iso) return Date.now() * 1_000_000;
  return new Date(iso).getTime() * 1_000_000;
}

/** Run-scoped span attributes, per design doc event→span mapping table. */
function setRunAttributes(span: Span, record: RunRecord): void {
  span.setAttribute("gorp.run.id", record.runId);
  span.setAttribute("gorp.final.status", record.finalStatus);
  if (record.profile?.persona !== undefined) span.setAttribute("gorp.profile.persona", record.profile.persona);
  if (record.profile?.model !== undefined) span.setAttribute("gorp.profile.model", record.profile.model);
  if (record.profile?.role !== undefined) span.setAttribute("gorp.profile.role", record.profile.role);
  if (record.profile?.promptHash !== undefined) span.setAttribute("gorp.profile.prompt_hash", record.profile.promptHash);
  // GOS-55: usage attributes (graceful absence — old records without usage just omit them)
  if (record.usage !== undefined) {
    if (record.usage.tokensIn !== undefined) span.setAttribute("gorp.usage.tokens_in", record.usage.tokensIn);
    if (record.usage.tokensOut !== undefined) span.setAttribute("gorp.usage.tokens_out", record.usage.tokensOut);
    if (record.usage.tokensTotal !== undefined) span.setAttribute("gorp.usage.tokens_total", record.usage.tokensTotal);
    if (record.usage.costUsd !== undefined) span.setAttribute("gorp.usage.cost_usd", record.usage.costUsd);
    if (record.usage.durationMs !== undefined) span.setAttribute("gorp.usage.duration_ms", record.usage.durationMs);
  }
}

/** Map finalStatus to OTel span status (design doc status table). */
function otSpanStatus(finalStatus: RunFinalStatus): { code: SpanStatusCode; message?: string } {
  switch (finalStatus) {
    case "failed":
    case "blocked":
      return { code: SpanStatusCode.ERROR, message: `run ${finalStatus}` };
    default:
      return { code: SpanStatusCode.UNSET };
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportTraceFromRun(
  cfg: RuntimeConfig,
  projectId: string,
  ref: RunRef,
): TraceExportResult {
  const otelEnabled = process.env["GORP_OTEL_ENABLED"];
  if (otelEnabled !== "1" && otelEnabled !== "true") return { status: "no-op" };

  const otelEndpoint = process.env["GORP_OTEL_ENDPOINT"] ?? "http://localhost:4318";
  const redact = (process.env["GORP_TRACE_REDACT"] ?? "true") !== "false";
  const rDir = runDir(cfg, projectId, ref);

  // ---- verify audit chain: tampered chain → export nothing (fail-closed) ----
  const chainPath = auditChainPath(cfg, projectId, ref);
  if (existsSync(chainPath)) {
    const integrity = verifyChain(chainPath, (chainRef) => `${rDir}/${chainRef}`);
    if (!integrity.valid) {
      return {
        status: "errored",
        error: `audit chain verification failed: ${integrity.problems.length} problem(s)`,
      };
    }
  }

  // ---- read persisted records (best-effort per record, no run-record → no-op) ----
  let runRecord: RunRecord | null = null;
  let workerResult: WorkerResult | null = null;
  let gateRecord: GateRecord | null = null;
  let reviewDecision: ReviewDecision | null = null;
  let promotionRecord: PromotionRecord | null = null;

  const rrPath = runRecordPath(cfg, projectId, ref);
  const wrPath = workerResultPath(cfg, projectId, ref);
  const grPath = gateRecordPath(cfg, projectId, ref);
  const rdPath = reviewDecisionPath(cfg, projectId, ref);
  const prPath = promotionRecordPath(cfg, projectId, ref);

  try {
    if (existsSync(rrPath)) runRecord = readValidatedRecord<RunRecord>("run-record", rrPath);
  } catch { /* best-effort */ }
  try {
    if (existsSync(wrPath)) workerResult = readValidatedRecord<WorkerResult>("worker-result", wrPath);
  } catch { /* best-effort */ }
  try {
    if (existsSync(grPath)) gateRecord = readValidatedRecord<GateRecord>("gate-record", grPath);
  } catch { /* best-effort */ }
  try {
    if (existsSync(rdPath))
      reviewDecision = readValidatedRecord<ReviewDecision>("review-decision", rdPath);
  } catch { /* best-effort */ }
  try {
    if (existsSync(prPath))
      promotionRecord = readValidatedRecord<PromotionRecord>("promotion-record", prPath);
  } catch { /* best-effort */ }

  if (!runRecord) return { status: "no-op" };

  // ---- build resource (design doc resource table) ----
  const resourceAttrs: Record<string, string> = {
    [SEMRESATTRS_SERVICE_NAME]: "gorp",
    "gorp.graph.id": runRecord.graphId,
    "gorp.project.id": runRecord.projectId,
    "gorp.node.id": runRecord.nodeId,
    "gorp.base.commit": runRecord.baseCommit,
    "gorp.governance.version": runRecord.governanceVersion,
    "gorp.worker.adapter": runRecord.workerAdapter,
  };

  // ---- one-shot OTel setup ----
  let provider: BasicTracerProvider | undefined;
  try {
    const exporter = new OTLPTraceExporter({ url: otelEndpoint });
    provider = new BasicTracerProvider({
      resource: resourceFromAttributes(resourceAttrs),
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    const tracer = provider.getTracer("gorp");

    // ---- root span: gorp.run (SERVER) ----
    const rootSpan = tracer.startSpan("gorp.run", {
      kind: SpanKind.SERVER,
      startTime: toEpochNs(runRecord.startedAt),
    });
    setRunAttributes(rootSpan, runRecord);
    rootSpan.setStatus(otSpanStatus(runRecord.finalStatus));

    // ---- child: gorp.node.worker (CLIENT) ----
    if (workerResult) {
      const workerSpan = tracer.startSpan("gorp.node.worker", {
        kind: SpanKind.CLIENT,
        startTime: toEpochNs(workerResult.startedAt),
      });
      workerSpan.setAttribute("gorp.worker.outcome", workerResult.outcome);
      if (workerResult.exitCode !== undefined) {
        workerSpan.setAttribute("gorp.worker.exit_code", workerResult.exitCode);
      }
      workerSpan.setAttribute("gorp.changed_files.count", workerResult.changedFiles?.length ?? 0);
      // privacy: free text redacted by default
      if (!redact) {
        if (workerResult.summary !== undefined)
          workerSpan.setAttribute("gorp.worker.summary", workerResult.summary);
        if (workerResult.reviewerNotes !== undefined)
          workerSpan.setAttribute("gorp.worker.reviewer_notes", workerResult.reviewerNotes);
        if (workerResult.blocker?.detail !== undefined)
          workerSpan.setAttribute("gorp.worker.blocker_detail", workerResult.blocker.detail);
      }
      if (workerResult.outcome === "failed" || workerResult.outcome === "blocked") {
        workerSpan.setStatus({ code: SpanStatusCode.ERROR, message: `worker ${workerResult.outcome}` });
      }
      workerSpan.end(toEpochNs(workerResult.endedAt));
    }

    // ---- child: gorp.node.gate (INTERNAL) ----
    if (gateRecord) {
      const gateSpan = tracer.startSpan("gorp.node.gate", {
        kind: SpanKind.INTERNAL,
        startTime: toEpochNs(runRecord.startedAt),
      });
      gateSpan.setAttribute("gorp.gate.validation.status", gateRecord.validation.status);
      gateSpan.setAttribute("gorp.gate.review.status", gateRecord.review.status);
      for (const check of gateRecord.validation.checks) {
        gateSpan.setAttribute(`gorp.gate.check.${check.name}.status`, check.status);
      }
      if (gateRecord.validation.status === "failed") {
        gateSpan.setStatus({ code: SpanStatusCode.ERROR, message: "gate validation failed" });
      }
      gateSpan.end(toEpochNs(runRecord.endedAt));
    }

    // ---- child: gorp.node.review (INTERNAL) ----
    if (reviewDecision) {
      const reviewSpan = tracer.startSpan("gorp.node.review", {
        kind: SpanKind.INTERNAL,
        startTime: toEpochNs(reviewDecision.decidedAt),
      });
      reviewSpan.setAttribute("gorp.review.decision", reviewDecision.decision);
      if (!redact && reviewDecision.reason !== undefined) {
        reviewSpan.setAttribute("gorp.review.reason", reviewDecision.reason);
      }
      reviewSpan.end(toEpochNs(reviewDecision.decidedAt));
    }

    // ---- child: gorp.node.promotion (INTERNAL) ----
    if (promotionRecord) {
      const promoSpan = tracer.startSpan("gorp.node.promotion", {
        kind: SpanKind.INTERNAL,
        startTime: toEpochNs(promotionRecord.promotedAt),
      });
      promoSpan.setAttribute("gorp.promotion.commit", promotionRecord.promotedCommit);
      promoSpan.end(toEpochNs(promotionRecord.promotedAt));
    }

    rootSpan.end(toEpochNs(runRecord.endedAt));

    // ---- flush + shutdown (fire-and-forget, best-effort) ----
    provider
      .forceFlush()
      .then(() => provider?.shutdown())
      .catch(() => provider?.shutdown());
  } catch (e) {
    // fail-open: try to shut down the provider
    if (provider) {
      provider.shutdown().catch(() => {});
    }
    return { status: "errored", error: e instanceof Error ? e.message : String(e) };
  }

  return { status: "exported" };
}