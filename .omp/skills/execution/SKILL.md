---
name: execution
description: gorp execution flow — compile graph, build worker profile, dispatch, QA/gates, audit, return results. guava-os decides; gorp enforces.
---

## Execution

Flow: `wf plan` (approved sprint → gorp `compile-graph` → draft graph) →
operator approval transition → `wf orchestrate` (scheduler drives run → gate
→ review per node) → `wf review` → approve / reject / retry → `wf promote` →
`inspect` (audit reconstruction).

Every step fails closed: Ajv schemas (`additionalProperties: false`), the
transition table, hash-bound decisions, the hash-chained audit trail.

> **Parallel scope.** Independent (zero-indegree) nodes are simultaneously
> eligible and dispatched independently, but that is DAG eligibility — not a
> claim of proven concurrent OMP-worker execution. Concurrent/parallel worker
> execution is a separate, unbuilt capability (GOS reconcile).

## Sandbox provisioning (GOS-61)

The sandbox worktree is provisioned with symlinks to gitignored dependency
directories (e.g. node_modules/) from the registered repo root after creation.
The worker runs with CWD = sandbox and has everything it needs — deps,
configs, tools — all available through symlinks. No tracked files are ever
overwritten.

## Observability (GOS-59, opt-in)

The audit chain stays the single source of truth; OTel/Sentry are exported
projections, never runtime dependencies.

- `gorp inspect --export-trace` (and `wf inspect`) replays a run's persisted
  records into OTel spans (Jaeger via OTLP/HTTP) and is a **no-op** unless
  `GORP_OTEL_ENABLED=1` (endpoint: `GORP_OTEL_ENDPOINT`, default
  `http://localhost:4318`; redaction default `GORP_TRACE_REDACT=true`).
- Fail-closed outcomes fire Sentry events when `GORP_SENTRY_DSN` is set
  (worker failure / gate failure / review rejection, structured fingerprints).
- Neither set → zero overhead; telemetry errors never block execution.

## Worker profile (GUA-123, landed)

Dispatch composes a worker profile: persona (`.guava-os/personas/<name>/persona.md`)
→ OMP role (`maps_to`) → worker skills → runtime config (model, tools).
The persona label flows issue → SprintTask.persona → graph node.persona →
run-record `profile {persona, model}` (visible via `wf review`/`gorp inspect`).
The omp adapter stays source-neutral: it reads `node.persona` as data and the
env vars `GORP_OMP_MODEL` (model tier) and `GORP_OMP_SYSTEM_PROMPT_APPEND`
(persona body) and forwards them to the omp invocation
(`--model`, `--append-system-prompt`). Real persona-aware OMP execution is
PROVEN (GOS-35, guava-site proof 2026-08-12). Contract:
`docs/architecture/worker-profile-contract.md`.

## Worker skills

Execution behaviors (backend, frontend, architecture, QA, review, docs,
migration) are loaded by OMP at dispatch via the persona body. Workers never
touch Linear and never make governance decisions.

## Uses

- `wf plan`, `wf orchestrate`, `wf orchestrate-status`, `wf review`,
  `wf promote` — guava-os wrappers over the gorp CLI
- `wf reconcile` — drift report + explicit gated adopt/regenerate (GOS-43)
- `wf inspect --export-trace` — replay OTel trace from persisted run records (GOS-59)
- gorp CLI: `compile-graph`, `graph create|validate|show|transition`, `run`,
  `review`, `approve|reject|retry`, `promote` [`--override-baseline` (GUA-242)],
  `inspect` [`--export-trace`], `reconcile`, `orchestrate`
- Contracts: `gorp/specs/runtime/*.schema.json`
- Registry input: `GORP_PROJECT_REGISTRY` — guava-os-owned file; gorp has no
  internal default
