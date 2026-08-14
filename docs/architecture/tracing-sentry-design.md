# GOS-56 — Observability: OTel Tracing + Sentry Errors (Design)

> **Authority:** `ADR_001.md` → `docs/architecture/guava-os-gorp-contract.md`
> → `docs/architecture/omp-runtime-boundary.md` → this doc.
> Status: **DESIGN** (no code). Defines the opt-in observability plan for
> guava-os/gorp execution; the audit chain is the single source of truth and
> is never modified by this work.

## Purpose

Give the operator a real-time view of governed execution *without changing
the code that executes it*. gorp already writes an append-only, hash-linked
audit chain per run; `gorp inspect` reconstructs the complete run view from
it. This document maps that chain onto:

- **OpenTelemetry traces** — one trace per run, one span per chain event,
  viewed in **Jaeger all-in-one** (accepts OTLP/HTTP on `:4318`, no
  collector), and
- **Sentry error dashboards** — post-hoc alerting on fail-closed outcomes,
  via **`@sentry/node`** in minimal CLI mode (self-hosted or cloud DSN).

The plan is **replay-based**: spans are derived from persisted records by a
read-only exporter, not emitted inline by `gorp run`. The worker dispatch
path stays byte-for-byte untouched.

## Principles

1. **The audit chain is the source of truth.** No new runtime telemetry
   path; spans are a *projection* of records already durably written. If a
   trace is ever lost, it is reconstructable by replaying the chain.
2. **Read-only, opt-in, off by default.** Observability is an operator
   affordance, not a runtime dependency. Nothing emits unless the operator
   enables it; a missing/disabled exporter must never affect execution.
3. **No worker-path changes.** The worker adapter (`worker/omp.ts`) stays
   blind — it receives no tracing config and never emits spans. Observability
   attaches *after* the fact, at the `inspect` layer.
4. **Privacy-first.** Spans carry identity and outcomes only — never secrets,
   never prompt content, never code diffs. Details below.

## Trace & span model

A **trace** is one run (`runId`), reconstructed from the records in a single
run directory. Each **chain event** becomes one span, parented under a root
span for the run. Multi-node graphs are naturally grouped by a shared
resource attribute `graph.id` (each node run is its own `gorp run`
invocation, hence its own trace).

```
RunRecord (root span: gorp.run)
├── WorkerResult          → gorp.node.worker    (outcome, exitCode, files)
├── GateRecord            → gorp.node.gate      (validation + checks)
├── ReviewDecision        → gorp.node.review    (verdict, reviewer)
└── PromotionRecord       → gorp.node.promotion (commits)
```

### Event → span mapping

| Chain event | Span name | Span kind | Start / end (timestamps) | Key attributes |
|---|---|---|---|---|
| `run-record` | `gorp.run` | SERVER | `startedAt` → `endedAt` | `finalStatus`, `workerAdapter`, `profile.*` |
| `worker-result` | `gorp.node.worker` | CLIENT | `startedAt` → `endedAt` | `outcome`, `exitCode`, `changedFiles.count` |
| `gate-record` | `gorp.node.gate` | INTERNAL | run window | `validation.status`, `checks.*`, `review.status` |
| `review-decision` | `gorp.node.review` | INTERNAL | `decidedAt` | `decision`, `reviewer` |
| `promotion-record` | `gorp.node.promotion` | INTERNAL | `promotedAt` | `promotedCommit`, `promotedBy` |

Timestamps that a record does not carry (e.g. `gate-record` has no explicit
time) fall back to the chain entry's injected `at` timestamp from
`ChainEntry` — the audit chain already timestamps every append, so no span is
ever unsortable.

The chain verification is reused as-is: the exporter calls `inspectRun`
(which runs `verifyChain`), so a tampered chain **fails closed and exports
nothing** rather than emitting spans from untrustworthy records.

## Span attributes

All attributes are namespaced `gorp.` to avoid colliding with OTel semantic
conventions. They are copied verbatim from the persisted records; nothing is
synthesized beyond the projection.

### Resource attributes (per trace)

| Attribute | Source |
|---|---|
| `service.name` = `gorp` | constant |
| `gorp.graph.id` | `RunRecord.graphId` |
| `gorp.project.id` | `RunRecord.projectId` |
| `gorp.node.id` | `RunRecord.nodeId` |
| `gorp.base.commit` | `RunRecord.baseCommit` |
| `gorp.governance.version` | `RunRecord.governanceVersion` |
| `gorp.worker.adapter` | `RunRecord.workerAdapter` |

### Run/span attributes

| Attribute | Source | Notes |
|---|---|---|
| `gorp.run.id` | `RunRecord.runId` | also the trace name |
| `gorp.final.status` | `RunRecord.finalStatus` | drives error tagging (§Error tagging) |
| `gorp.profile.persona` | `profile.persona` | present only when a persona ran |
| `gorp.profile.model` | `profile.model` | present only when a persona ran |
| `gorp.profile.role` | `profile.role` | present only when a persona ran |
| `gorp.profile.prompt_hash` | `profile.promptHash` | sha256; see privacy model |
| `gorp.worker.outcome` | `WorkerResult.outcome` | succeeded / failed / blocked |
| `gorp.worker.exit_code` | `WorkerResult.exitCode` | when present |
| `gorp.changed_files.count` | `WorkerResult.changedFiles` | count only, never paths |
| `gorp.gate.validation.status` | `GateRecord.validation.status` | passed / failed |
| `gorp.gate.review.status` | `GateRecord.review.status` | pending / approved / … |
| `gorp.review.decision` | `ReviewDecision.decision` | approved / rejected / retry |
| `gorp.promotion.commit` | `PromotionRecord.promotedCommit` | when present |

### Usage attributes (GOS-55, optional)

When `RunRecord.usage` is present (GOS-55 may add an additive-optional
`usage?: { tokensIn?, tokensOut?, tokensTotal?, costUsd?, durationMs? }`),
each field is projected onto the root `gorp.run` span:

| Attribute | Source |
|---|---|
| `gorp.usage.tokens_in` | `usage.tokensIn` |
| `gorp.usage.tokens_out` | `usage.tokensOut` |
| `gorp.usage.tokens_total` | `usage.tokensTotal` |
| `gorp.usage.cost_usd` | `usage.costUsd` |
| `gorp.usage.duration_ms` | `usage.durationMs` |

Absence is graceful: old records without `usage` simply emit no usage
attributes — the exporter must not require them.

## Error tagging (fail-closed outcomes)

A span's OTel status is derived from `finalStatus` and the embedded
sub-record outcomes. Sentry error events are generated **only** for these
fail-closed outcomes; a clean run produces traces and no Sentry events.

### Status mapping

| `finalStatus` | OTel span status | Sentry level | Rationale |
|---|---|---|---|
| `succeeded` | UNSET (ok) | none | normal execution |
| `failed` | ERROR | `error` | worker or gate fail-closed |
| `blocked` | ERROR | `error` | irreducible blocker / dependency |
| `rejected` | UNSET | `warning` | review verdict, not a system fault |
| `cancelled` | UNSET | `info` | operator action |

### Classification (Sentry fingerprint)

The error fingerprint is built from the structured codes — never from human
message text — so identical failures group into one issue:

- **Worker failure** — `WorkerResult.outcome ∈ {failed, blocked}`. Fingerprint
  `{gorp, worker-failed, blocker.code ?? exit_code}`. The `blocker {code,
  detail, irreducible}` is attached as structured context (`irreducible`
  becomes a tag, `detail` is redacted unless explicitly opted in).
- **Gate failure** — `GateRecord.validation.status = failed`. Fingerprint
  `{gorp, gate-failed, <failed check names>}`. Each `checks[]` entry with
  `status = failed` is attached as a Sentry breadcrumb/context.
- **Control/error codes** — `RunRecord.controlDecisions[]` entries with a
  `reasonCode` in the error set (e.g. `PROFILE_UNRESOLVED`, `WORKER_FAILED`,
  `GATE_FAILED`) map to the corresponding `GorpErrorCode` and its documented
  `EXIT_CODES` value, attached as `gorp.error.code` and `gorp.error.exit_code`
  tags.

All fail-closed events carry the shared tags `gorp.project.id`,
`gorp.graph.id`, `gorp.node.id`, `gorp.run.id`, and (when present)
`gorp.profile.persona` + `gorp.profile.model`, so the operator can filter the
dashboard by project, node, or persona.

## Sentry integration

`@sentry/node` is used in **minimal CLI mode** — a standalone exporter
process, not a runtime SDK inside gorp:

- **DSN or self-hosted URL** from config/env (`GORP_SENTRY_DSN` /
  `GORP_SENTRY_URL`). Cloud DSN or a self-hosted Sentry instance both work;
  the code path is identical (`Sentry.init({ dsn })`).
- **Error events only.** `Sentry.captureException(new GorpError(...))` /
  `captureEvent` for the fail-closed outcomes above, with `fingerprint`,
  `level`, `tags`, and structured `contexts` set. The `promptHash` is included
  as a tag so a Sentry issue can be correlated to the exact profile that ran.
- **Not the trace viewer.** Jaeger remains the default trace UI; Sentry is
  the *error dashboard and alerting* surface (alert rules on
  `gorp.final.status = failed|blocked`, or on `gorp.error.code`). If the
  deployment uses Sentry's OTLP trace ingest, the same exporter can also push
  traces there — but that is optional, not the default.

## Opt-in gating

Observability is **off by default** and enabled only by explicit operator
configuration. The exporter is a distinct, read-only command (design name
`gorp trace`; alternatively `gorp inspect --export-trace`) — it never runs
during `gorp run`, `review`, or `promote`.

| Mechanism | Setting | Default |
|---|---|---|
| Enable | `GORP_OTEL_ENABLED` / `--trace` flag | off |
| Trace endpoint | `GORP_OTEL_ENDPOINT` (OTLP/HTTP) | `http://localhost:4318` (Jaeger) |
| Trace headers | `GORP_OTEL_HEADERS` (JSON) | none |
| Sentry DSN/URL | `GORP_SENTRY_DSN` / `GORP_SENTRY_URL` | none (Sentry off) |
| Redaction override | `GORP_TRACE_REDACT` (default `true`) | `true` |

Enforcement mirrors the existing pattern: the worker adapter is constructed
*blind* (per `omp-runtime-boundary.md`), so no `GORP_OTEL_*` / `GORP_SENTRY_*`
value ever reaches a worker process. Observability config is read only by the
exporter command, at inspect time.

## Privacy model

The exporter emits **no secrets and no content**:

- **No prompts.** The persona body / system prompt / node objective are never
  exported. Only `profile.promptHash` — a sha256 of `{persona, model,
  systemPrompt}` — is emitted, which is a non-reversible, deterministic
  binding label, not prompt text. There is no flag to export prompt content.
- **No secrets.** Environment variables, MCP config, sandbox identity, and
  registry paths are never read or emitted. The exporter consumes only the
  persisted run records.
- **No code/diffs.** Sandbox `diff` and changed-file *contents* are never
  exported. `changedFiles` is reduced to a count; file paths and the diff are
  excluded unless a future review explicitly authorizes a redacted variant.
- **Free text redacted by default.** `WorkerResult.summary`,
  `WorkerResult.reviewerNotes`, `ReviewDecision.reason`, and `blocker.detail`
  are *not* exported. `GORP_TRACE_REDACT=false` (opt-in) exports them; the
  default is `true`.

This keeps the trace/error stream safe to ship to a third-party SaaS Sentry
account (no prompts, no code, no secrets) while still giving the operator
full execution visibility.

## Components & implementation notes (design only)

Implementation is the follow-up (GOS-57). The design pins these boundaries so
the implementation is mechanical:

1. **Trace exporter (gorp-owned, read-only).** A command in
   `gorp/runtime/control` that calls `inspectRun`, walks `InspectOutput`
   (`runRecord`, `workerResult`, `gateRecord`, `reviewDecision`,
   `promotionRecord`, `integrity`), and builds spans per the mapping tables.
   It adds `@opentelemetry/sdk-node` +
   `@opentelemetry/exporter-trace-otlp-http` as dependencies of the exporter
   command only — **not** of the `run`/worker path.
2. **Sentry reporter (gorp-owned, read-only).** Same command, or a sibling,
   that consumes the classification table and calls `@sentry/node`
   `captureException`/`captureEvent` for fail-closed outcomes.
3. **No schema changes.** The exporter projects existing fields. The only
   additive field it *may* consume is `RunRecord.usage` (GOS-55), which it
   reads if present and ignores otherwise — no new `additionalProperties`
   are required for this plan.
4. **No worker/runtime changes.** `worker/omp.ts`, `run.ts`, and the gate
   path are untouched; the audit chain is the sole telemetry source.

## Ownership boundary

| Concern | Owner |
|---|---|
| Audit chain (source of truth) | gorp |
| Trace/span projection, error classification | gorp (read-only exporter) |
| Trace viewer (Jaeger) / error dashboard (Sentry) deployment | operator |
| Enabling/configuring observability | operator |
| Review/promotion decisions | guava-os (unchanged) |

Observability is **enforcement-adjacent**: it reads the chain and never makes
a decision. It does not move any decision from guava-os, and it does not grant
the exporter any transition authority.

## Open questions (for GOS-57)

- Confirm `GORP_OTEL_HEADERS` shape (JSON vs. `key=value` pairs) for
  bearer-token OTLP endpoints.
- Whether a single exporter process should batch multiple runs (one trace
  each) into one export for a graph-wide Jaeger view, or one trace per
  invocation.
- Whether `gorp trace` is a standalone command or an `inspect --export-trace`
  flag (CLI surface decision, guava-os can weigh in — no ownership change).
