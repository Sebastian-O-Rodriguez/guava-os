# Gorp Architecture (control-plane mechanics)

> **Authority:** product intent, ownership, status, and rules live in the four
> source-of-truth docs — `../VISION.md`, `../SYSTEM-MODEL.md`,
> `../CURRENT-STATE.md`, `../ARCHITECTURAL-INVARIANTS.md`. This file only
> details how the control plane executes; if it ever conflicts with them, they
> win.

How Gorp is structured and how work actually executes, as of the 2026-07-27
cleanup. For direction see `ADR_001.md` and `docs/architecture/guava-os-gorp-contract.md`;
for the execution engine runtime in depth see `../runtime/control/README.md`.

> Source-neutral by design. Contracts name no worker runtime, provider, or
> model (enforced by a terminology test). Engineering runtimes — OMP and
> others — integrate only as **worker adapters**, never the core. No runtime
> is required.

---

## The model

Gorp is the **executor** and **governance-of-execution** for GOS: it owns the
runtime contracts (`specs/runtime/`), the persisted execution state
(machine-local state root), the project registry (`registry/projects.yml`),
and the control plane that drives the plan → orchestrate → gate → review →
promote → audit loop — dispatching OMP-agent workers via the adapter seam. A
graph is schema-validated and atomically written; workers can never transition
graph state or change topology — only the control plane does, and the operator
owns every approval.

**guava-os** is the control plane above Gorp. The operator iterates and plans in
guava-os; approved plans are delegated down to Gorp for governed execution.
guava-os also consumes Gorp's output — promoted changes compound back into
guava-os itself, closing the improvement loop.

Everything runtime-specific is confined to a **worker adapter** behind one
seam (`runtime/control/src/worker/adapter.ts`). Operator surfaces (browser
Shell, terminal client, Hermes console) live in `~/dev/guava-hermes` and speak
to Gorp exclusively through the CLI's JSON envelopes.

## Repository layout

- **`specs/runtime/`** — the seven canonical JSON Schemas: `execution-graph`,
  `worker-result`, `gate-record`, `run-record`, `review-decision`,
  `promotion-record`, `sprint`. Enforced at every boundary via Ajv.
- **`runtime/control/`** — the TypeScript control plane (below).
- **`registry/projects.yml`** — projectId → repository path. The only
  governance artifact the runtime reads besides the manifest version.
- **`reference/`** — this document plus `history/` (point-in-time records:
  audits, completion reports, migration notes — kept for the record, not
  current guidance).
- **`gorp.manifest.yml`** — kernel identity and the governance `version`
  stamped into every run record.

## The control-plane runtime (`runtime/control/`)

The runtime owns the persisted execution graph, its state transitions, and the
full pipeline:

```
sprint  →  plan  →  approve  →  orchestrate  →  review / promote  →  inspect
```

- **`gorp plan`** — deterministically maps an operator-approved sprint document
  to a *draft* graph (tasks, dependencies, scope, gates, worker, review posture).
  It executes nothing and approves nothing; cycles and capability lies are
  rejected, never repaired.
- **operator approval** — a draft graph runs nothing until the operator
  transitions it to `approved`. Workers are not an actor type and can never
  approve or transition state.
- **`gorp orchestrate`** — a single-process, single-graph scheduler that
  re-discovers all state each step (every step is a crash/restart boundary) and
  derives exactly one action: run a ready node, approve via a pluggable review
  policy, or promote. There is no auto-approve for non-deterministic workers.
  Every invocation appends `started`/`ended` events to a per-graph log;
  `gorp orchestrate-status` folds them (running / completed / stopped + reason
  + evidence / presumed-crashed by pid liveness), so detached runs are never
  silent.
- **per-node execution** — an approved node runs in an isolated **git-worktree
  sandbox** under a machine-local state root, never in the consumer working
  tree. A worker is invoked through the **adapter seam** and is blind (it gets a
  sandbox + node spec, never the store). Changed files are computed from git,
  never trusted from the worker.
- **gate** — scope checks (sandbox clean, every change inside `allowedPaths`,
  none in `forbiddenPaths`) then the node's required project commands, spawned
  with no shell and a timeout. Any failure fails the gate closed.
- **review / promote** — a single immutable review decision
  (`approve`/`reject`/`retry`) bound to the exact gate and artifact hashes,
  then a fail-closed `promote` that re-runs the full gate live and cherry-picks
  only the approved commit (no rebase, merge, or conflict resolution).
- **`gorp inspect`** — one read-only command showing the complete audit: records,
  history, decisions, timestamps, errors, and the hash-chain integrity verdict.

Runtime state is machine-local (default `~/.local/state/gorp`, override
`GORP_STATE_HOME`); **no runtime state is ever written into a consumer working
tree.** The append-only audit chain is integrity evidence against accidental
corruption and naive edits — not a security boundary (it has no external anchor).

## Worker adapters

An adapter implements `invoke(WorkerInvocation): WorkerResult` and passes the
contract boundary the deterministic fixture worker passes: schema-valid result,
exact identity echo, adapter-name match, non-empty summary. Two adapters are
implemented today (see `CURRENT-STATE.md`): `fixture` (deterministic) and
`hermes` — an optional integration whose adapter spawns `GORP_HERMES_CMD` (the
wrapper script in guava-hermes), owns the single sandbox commit itself, and
fails closed on timeouts, bad output, git-touching workers, or
success-with-no-changes. An OMP adapter (the primary engineering runtime in
the vision) does not exist yet. LLM output always stops at the human review
boundary.

## How a consumer uses Gorp

A consumer is a repository registered in `registry/projects.yml`. That is the
whole integration: governed changes are planned from sprint documents, executed
in sandboxes keyed under the state root, and enter the consumer only through
promotion. Consumer repositories own their source, tests, docs, and any
project-local Claude/agent configuration; they carry no Gorp runtime state and
no copied governance.

## Retired (2026-07-27)

The earlier context-distribution stack — shell/Ruby context loader, AGENTS.md
generator, `doctrine/`, `personas/`, `playbooks/` (including the deprecated
`dispatch.sh`), gorp-kit `templates/`, declarative `runtime/policies/scope.yml`,
the `runtime/adapters/` shell contract, and the empty `memory/`,
`improvements/`, `tools.yml`/`mcps.yml` scaffolds — was removed. History lives
in git and in `reference/history/`. The control plane's in-code gate is the
single scope authority.
