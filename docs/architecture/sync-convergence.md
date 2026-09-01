# Consumer Sync & Convergence

> Authority: `ADR_001.md` → `docs/architecture/guava-os-operating-contract.md`
> → this doc. Defines how a consumer repo converges to the canonical guava-os
> contract (config schema, skill symlinks, Linear labels).

## Purpose

guava-os tooling is single-sourced in the guava-os checkout; each governed repo
carries only its `.guava-os/config.json`, its `.omp/skills/` symlinks, and a
registry entry. When the canonical contract changes (new config schema, new
labels, new skills), every consumer must be converged to it. `sync` is that
convergence.

## Three entry cases

| Case | Trigger | Invocation |
|---|---|---|
| Rollout | gos contract changes | `gos sync --all` |
| New project | `gos register` | register converges at birth |
| Migrate / repair | drifted, corrupted, or rolled-back repo | `gos sync <repo>` |

## The contract

`sync` is **report-first** — mandatory visibility before any write:

1. **Report** (`sync [repo]`, the default) — print a SyncPlan grouped by
   config / labels / symlinks, naming what will change, be added, or be
   flagged. Write nothing. Exit `0` when clean, `1` when drift is detected.
2. **Fix** (`sync --fix [repo]`) — print the plan, then prompt
   `[A]ccept / [C]ancel`. On accept, apply (config migration, label creation,
   symlink fixes). On cancel, exit clean with no writes.
3. **Force** (`sync --fix --force [repo]`) — print the plan, then apply with no
   prompt. For scripts and batch.
4. **Batch** (`sync --all`, with optional `--fix` / `--fix --force`) — run over
   every active registry project; aggregate exit code.

## What sync reconciles

- **Config** (`.guava-os/config.json`) — migrates the legacy shape (`roles`,
  `max_todo_per_role`, `dev/{role}`) to the new schema (`domains`,
  `domainAgents`, `types`, `readiness`, `max_todo_per_domain`, `dev/{domain}`).
  Idempotent. Seeds `domains`/`domainAgents` from a repo hint and **flags for
  owner confirmation** — never silently invents a wrong domain mapping.
- **Linear labels** — creates missing domain/type/readiness labels; **flags but
  never deletes** stray labels (e.g. legacy `architect`). Deletion is an owner
  decision.
- **Skills symlinks** (`.omp/skills/*`) — adds missing links to
  `~/.agents/skills/*`; flags broken/dangling links.

## Fail-fast

`loadConfig` validates the config against the new schema and throws
`ConfigStaleError` naming the missing/legacy keys. The message names
`gos sync <repo>` as the remediation, so a stale consumer fails with an
actionable error instead of crashing deep inside a caller.
