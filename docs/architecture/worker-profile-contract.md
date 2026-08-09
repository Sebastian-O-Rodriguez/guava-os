# Worker Profile Contract

> **Authority:** ADR_001 → `guava-os-gorp-contract.md` → this document.
> Status: **contract only — no implementation yet** (Phase 5A). The gorp omp
> adapter currently dispatches blind; this document defines what "wired"
> means. Approval required before any schema or adapter change.

## Purpose

Define the visible contract for what a worker *is* at dispatch time. One
composition, one owner per layer, no ambiguity about where each piece comes
from.

## The composition

```
Issue
  ↓
Persona
  ↓
Playbook
  ↓
OMP Role
  ↓
Worker Skills
  ↓
Runtime Config
  ↓
Worker
```

| Layer | What it is | Owner | Where it lives | Status |
|---|---|---|---|---|
| **Issue** | The unit of work: intent, scope, acceptance criteria, one persona label. | guava-os | Linear | Implemented |
| **Persona** | Execution policy: scope, patterns, anti-patterns; frontmatter `maps_to` / `model` / `tools`. | guava-os (defines), guava-os (chooses via issue label) | `.guava-os/personas/<name>/persona.md` | Files exist; **never read at dispatch** |
| **Playbook** | The execution loop the worker operates inside: gates, audit, return-shape expectations. | gorp | `gorp/PLAYBOOK.md` | Implemented (doc) |
| **OMP Role** | Runtime agent role (`scout` / `designer` / `reviewer` / `librarian` / `task` / `sonic`). | OMP (runtime config); persona `maps_to` selects it | OMP bundled agents | Documented; **not passed at dispatch** |
| **Worker Skills** | Execution behaviors loaded by OMP (backend, frontend, QA, review, docs, migration). | Execution layer (ADR_001 skill taxonomy §3) | `.omp/skills/` (target), persona bodies (today) | Documented only; **no delivery mechanism** |
| **Runtime Config** | Model tier, tool allowlist, flags (`--auto-approve --mode json`), sandbox cwd, env. | gorp (assembles), OMP (provides runtime) | `gorp/runtime/control/src/worker/omp.ts` | Partial: model from `GORP_OMP_MODEL` only; tools/flags not persona-aware |
| **Worker** | The OMP agent process executing one graph node in a sandbox worktree. | OMP (lifecycle), gorp (dispatch) | spawned by `worker/omp.ts` | Implemented (blind) |

## Rules

1. **Linear stores the GOS persona only** (one label per issue). Everything
   downstream is derived, never re-entered.
2. **guava-os chooses the requested persona** — at planning time, via the
   issue's persona label.
3. **gorp assembles the worker profile** at dispatch: persona → OMP role →
   worker skills → runtime config → one invocation.
4. **OMP role remains runtime configuration.** Persona specializes a role;
   it does not replace the role, and the role does not replace the persona.
5. **The profile is recorded.** The assembled profile (persona, role, model,
   tools, skills) is stamped into the run record and visible via
   `gorp inspect`. A review decision binds to the exact profile that ran.
6. **Workers never govern.** No Linear access, no approval/promotion, no
   project-management decisions (ADR_001).

## Current vs target

| Concern | Current (blind adapter) | Target |
|---|---|---|
| Prompt | built from node fields only | node fields + persona body + worker skills (e.g. `--append-system-prompt`) |
| Model | `GORP_OMP_MODEL ?? "default"` | persona `model` → resolved tier; env override stays |
| Role | omp default | persona `maps_to` |
| Tools | omp default allowlist | persona `tools` |
| Run record | no profile fields | profile stamped; `gorp inspect` surfaces it |

## Open boundaries (must be settled before implementation)

1. **Persona flow into the graph.** The sprint doc carries tasks; the graph
   carries nodes; neither has a persona field today, and all schemas are
   `additionalProperties: false`. Proposal: sprint task gains optional
   `persona` (guava-os sets it at compile input); compiler carries it to the
   node; run record stamps the assembled profile. This is a **schema
   amendment** to `sprint.schema.json`, `execution-graph.schema.json`, and
   `run-record.schema.json`.
2. **Worker-skill delivery.** Workers run with cwd = sandbox checkout of the
   target repo, so guava-os's `.omp/skills/` is not on their discovery path.
   Recommendation: prompt injection (persona body + skill content appended
   via `--append-system-prompt`) — no file copying into sandboxes.
3. **Adapter stays source-neutral.** Persona resolution reads
   `.guava-os/personas/` — a guava-os path. The adapter must receive the
   *resolved profile* (or a persona document path) as explicit invocation
   input, never hardcode guava-os layout (ADR_001: gorp must not depend on
   consumer specifics). guava-os `wf` layer resolves persona id → persona
   file; gorp consumes it as data.

## Approval gate

This contract is submitted for operator approval. No schema, adapter, or
inspection changes until approved.
