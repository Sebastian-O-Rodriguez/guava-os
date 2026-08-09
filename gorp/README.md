Gorp is the **execution engine** for GOS: it owns the execution contracts,
the persisted execution state, and the mechanics that gate, review, promote,
and audit work. Gorp executes governed engineering work by running the
plan → orchestrate → gate → review → promote → audit pipeline, dispatching
workers via the adapter seam. Engineering runtimes (OMP is the primary;
others are optional) are **composed** behind that seam, never rebuilt inside
Gorp.

**guava-os** is the control plane above Gorp. The operator iterates and plans
in guava-os; approved plans are delegated down to Gorp for governed execution.
guava-os also consumes Gorp's output — promoted changes compound back into
guava-os itself, closing the improvement loop.

## Source of truth — read in this order

1. **`../ADR_001.md`** — architectural boundaries and ownership. When code or
   documentation conflicts with ADR_001, ADR_001 wins.
2. **`VISION.md`** — product intent: composition over replacement; projects,
   global capabilities, the governed compounding loop.
3. **`SYSTEM-MODEL.md`** — ownership and canonical flow: Operator →
   Operator Interface → Gorp → OMP → Project.
4. **`CURRENT-STATE.md`** — what is implemented, partial, missing, deferred.
   The single canonical status document.
5. **`ARCHITECTURAL-INVARIANTS.md`** — the non-negotiable rules.
6. **`../docs/architecture/guava-os-gorp-contract.md`** — the guava-os ↔ gorp
   seam (ownership table, inputs/outputs, forbidden responsibilities).
7. `runtime/control/README.md` + `specs/runtime/` — the runtime docs and
   enforced contracts (with the tests, the second authority tier).
8. `reference/history/` — point-in-time records. Historical only.

Gorp is **source-neutral**: it names no worker runtime, provider, or model in
its contracts (enforced by test). Worker runtimes reach it only through the
worker-adapter seam.

> **2026-07-27 cleanup.** The pre-control-plane stack (shell/Ruby context
> loader, AGENTS.md generator, doctrine/personas/playbooks layers, gorp-kit
> templates, dispatch scripts, and the empty memory/improvements/capability
> scaffolds) was removed. Historical documents under `reference/history/`
> reference those deleted paths as a matter of record.


## What is here

| Path | Role |
|---|---|
| `runtime/control/` | The TypeScript execution engine: CLI (`graph`, `compile-graph`, `run`, `review`, `approve`/`reject`/`retry`, `promote`, `inspect`, `orchestrate`, `orchestrate-status`), scheduler, sandbox, gates, review, promotion, audit chain, worker adapters (`fixture`, `omp`). See `runtime/control/README.md`. |
| `specs/runtime/` | The seven canonical JSON Schemas (2020-12): `execution-graph`, `worker-result`, `gate-record`, `run-record`, `review-decision`, `promotion-record`, `sprint`. All enforced in code via Ajv at every read/write boundary. |
| _Project registry_ | Owned by guava-os at `.guava-os/registry/projects.yml`; gorp receives the path via `GORP_PROJECT_REGISTRY`. |
| `reference/history/architecture.md` | LEGACY — superseded control-plane prose (ownership and flow live in `SYSTEM-MODEL.md`; mechanics in `runtime/control/README.md`). |
| `reference/history/` | Point-in-time records (audits, completion reports, migration notes). Not current guidance. |
| `gorp.manifest.yml` | Kernel identity + governance version (stamped into every run record). |

## The execution model

```
sprint doc ── gorp compile-graph ──▶ draft graph ── operator approval ──▶ gorp orchestrate
   └─ per node: worktree sandbox → worker adapter → fail-closed gate
      → human review (hash-bound) → fail-closed cherry-pick promotion
      → hash-chained audit records
```

Authoritative state lives under a machine-local state root
(`~/.local/state/gorp`, override `GORP_STATE_HOME`) — never in consumer
repositories.

## Governance boundaries (enforced)

- Workers are not actors: they cannot transition graph state (transition table).
- LLM worker output can never be machine-approved (review policy stops for a human).
- Review decisions bind to the exact sandbox commit hash; promotion verifies it
  and re-runs the full gate live.
- Everything fails closed; every stop is recorded (`orchestrate-status`).
- The audit chain is integrity evidence against accidental edits, **not** a
  security boundary — there is no external anchor.

## Operator Interface

The **Operator Interface** is the primary way humans work with GOS. It lives
in the guava-os control plane. Herdr (planned) will manage multiple OMP
sessions for operator visibility.

## Consumers

Registered in `registry/projects.yml`. A consumer needs only its registry entry;
project repositories own their source, tests, and docs. Governed changes enter a
consumer exclusively through Gorp promotion.
