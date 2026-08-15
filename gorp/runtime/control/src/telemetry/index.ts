/**
 * GOS-59: observability entry point (GOS-56 design).
 *
 * Read-only, opt-in, off by default. `maybeInitTelemetry` is the single
 * entry point for wiring both OTel tracing (replay exporter, called at
 * inspect time) and Sentry error alerts (inline fail-closed capture).
 */

export { exportTraceFromRun, type TraceExportResult, type TraceExportStatus } from "./trace.js";
export { captureFailClosed, initSentry, reportFailClosed } from "./sentry.js";
import { initSentry } from "./sentry.js";

/** Initialize observability from env. Both backends are independently
 *  opt-in: OTel via GORP_OTEL_ENABLED (read by the replay exporter), Sentry
 *  via GORP_SENTRY_DSN / GORP_SENTRY_URL. No-op when neither is set. */
export function maybeInitTelemetry(): void {
  initSentry();
}