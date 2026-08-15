# OMP Runtime Boundary (GOS-8)

> **Authority:** `ADR_001.md` > `docs/architecture/guava-os-gorp-contract.md`
> > this doc. Defines the execution engine ↔ engineering runtime seam.

## Purpose

ADR_001 names OMP as the engineering runtime. This document defines the
contract for how gorp dispatches OMP agents as workers through the adapter
seam. The OMP adapter (GOS-11) implements exactly this contract — definition
first, no implementation here.

## Invocation

**Mechanism:** `omp -p --auto-approve --mode json --model <model> "prompt"`

- `-p` / `--print`: non-interactive mode — process the prompt and exit.
- `--auto-approve`: skip tool-approval prompts (the worker runs autonomously
  inside the sandbox; gorp's gates enforce boundaries, not OMP's approval).
- `--mode json`: structured output for machine parsing.
- `--model`: the model tier resolved from the persona's `model` field.
- `--skills`: optional comma-separated glob to load specific skills.
- `--system-prompt` / `--append-system-prompt`: persona content injected here.

**Binary:** `/opt/homebrew/bin/omp` (v17.1.8+). The adapter spawns `omp` with
the process CWD = the registered repo root (per GOS-60 — so npm/pnpm/git
commands resolve against the real repo with full deps); the worker WRITES
exclusively to the sandbox worktree, whose path is given in the prompt.

**Working directory:** the registered repo root (the real checkout with deps).
The worker edits only the sandbox worktree at `{sandbox.dir}` (pinned by the
prompt); gorp stages and commits there.

## Inputs

The adapter receives a `WorkerInvocation` (from `worker/adapter.ts`):

| Field | Source | Description |
|---|---|---|
| `sandbox` | gorp | Worktree handle (path, git config, base commit). |
| `graphId` | gorp | Execution graph identity (echoed in result). |
| `runId` | gorp | Run identity (echoed in result). |
| `node` | gorp | The node spec: objective, expected artifacts, scope, required commands. |
| `clock` | gorp | Deterministic clock for timestamps. |

The adapter translates these into the OMP prompt:

- **Objective** → the prompt body (what the worker must accomplish).
- **Persona** → `--append-system-prompt` with the persona definition from
  `.guava-os/personas/<name>/persona.md` (guava-os-owned, passed through the
  seam).
- **Model tier** → `--model` from the persona's `model` field
  (`smol` / `default` / `slow`).
- **Tool allowlist** → OMP tool restrictions from the persona's `tools` field.
- **Scope** → the prompt includes the node's scope (allowed/forbidden paths);
  gorp's scope gate enforces this independently.

## Tool surface

- The persona's `tools` field is the **guava-os-declared minimum** for that
  persona (`read, edit, write, bash, grep, glob`).
- OMP workers may ALSO be given **runtime-provided MCP servers**, configured
  machine-scoped in OMP config (`~/.omp/agent/mcp.json`) — e.g. project data
  tools like Supabase via MCPM (`supabase-mcpm` stdio server). These are OMP
  runtime capabilities, NOT guava-os skills/persona tools, and are not listed
  in this repo (another machine may not have them). Secrets for such servers
  live in user-level OMP/MCPM config, never in a tracked repo.
- Regardless of the runtime tool surface, workers never fetch Linear (GOS-18)
  and never approve or promote (operator-only).

## Outputs

The adapter returns a `WorkerResult` conforming to
`gorp/specs/runtime/worker-result.schema.json`:

| Field | Description |
|---|---|
| `graphId` / `nodeId` / `runId` / `workerAdapter` | Identity echo — must match the invocation exactly (enforced by `invokeAdapter`). |
| `success` | Whether the worker believes it completed the objective. |
| `summary` | Human-readable summary of what the worker did. |
| `artifacts` | Files created/modified (paths relative to sandbox). |
| `error` | Failure details if `success` is false. |

The adapter parses OMP's JSON output and maps it to the `WorkerResult` schema.
OMP-specific output shapes stay inside the adapter; gorp never sees them.

## Personas

Personas are defined in guava-os (`.guava-os/personas/<name>/persona.md`) and
passed through the adapter seam. The persona content is injected as the OMP
system prompt. The persona's `maps_to` field selects the OMP bundled agent
role (scout, designer, reviewer, librarian, task, sonic); the `model` field
selects the model tier.

**Workers never approve or promote** — that is operator-only, hash-bound.
**Workers never fetch Linear** — codified in GOS-18; the persona prompt
includes this prohibition.

## Artifacts

The worker writes code/docs/tests inside the sandbox worktree. The adapter:

1. Runs `omp -p` in the sandbox directory.
2. After OMP exits, collects the git diff (changed files) from the sandbox.
3. Maps changed files to the `artifacts` array in `WorkerResult`.
4. Records a sandbox commit (the fixture worker does this; the OMP adapter
   follows the same pattern — the worker's changes are committed before the
   gate runs).

## Failure/retry semantics

- OMP exits non-zero → `success: false`, `error` captures stderr.
- OMP exits zero but no artifacts → `success: false` (no work done).
- OMP exits zero with artifacts → `success: true`; gorp's gate validates
  scope/commands independently.
- Worker failure surfaces to gorp's retry mechanism (GOS-10 owns the retry
  decision; gorp enforces the retry transition).

## Source-neutrality

The contract (inputs/outputs/schema) names no runtime. The OMP adapter is the
named integration — it implements `WorkerAdapter` and passes the same contract
checks as the fixture adapter. Replacing OMP with another runtime means
implementing a new adapter; the contract, scheduler, and gates do not change.

## Observability (tracing & errors)

gorp execution is observable via a replay-based exporter that derives
OpenTelemetry traces and Sentry error events from the persisted audit chain —
the worker path is never instrumented, and the adapter remains blind. The
design is in `docs/architecture/tracing-sentry-design.md` (GOS-56). Opt-in,
off by default, privacy-first: no prompts, no secrets, no diffs without
explicit operator opt-in.

## Enforcement points (preserved from `worker/adapter.ts`)

1. **Blind invocation** — the adapter receives only `WorkerInvocation`; no
   runtime config, no store, no state-home path.
2. **Identity echo** — the result must echo `graphId`/`nodeId`/`runId`/
   `workerAdapter` exactly.
3. **No worker approval** — `worker` is not an authorized actor type; workers
   cannot transition graph state.
4. **Schema validation** — the result validates against
   `worker-result.schema.json` at the boundary.
