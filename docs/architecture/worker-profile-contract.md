# Worker Profile Contract

> **Authority:** ADR_001 → `guava-os-gorp-contract.md` → this document.
> Status: **IMPLEMENTED** (GUA-123, merge ed1a6ff, 2026-08-12). Persona flows
> issue → SprintTask.persona → graph node.persona → run-record `profile
> {persona, model}`; the omp adapter is source-neutral and persona-aware via
> env (`GORP_OMP_MODEL`, `GORP_OMP_SYSTEM_PROMPT_APPEND` → omp `--model` +
> `--append-system-prompt`). Real persona-aware OMP execution is proven
> (GOS-35; guava-site live proof 2026-08-12).

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
| **Persona** | Execution policy: scope, patterns, anti-patterns; frontmatter `maps_to` / `model` / `tools`. | guava-os (defines), guava-os (chooses via issue label) | `.guava-os/personas/<name>/persona.md` | Read at dispatch (GUA-123): label → task.persona → node.persona |
| **Playbook** | The execution loop the worker operates inside: gates, audit, return-shape expectations. | gorp | `gorp/PLAYBOOK.md` | Implemented (doc) |
| **OMP Role** | Runtime agent role (`scout` / `designer` / `reviewer` / `librarian` / `task` / `sonic`). | OMP (runtime config); persona `maps_to` selects it | OMP bundled agents | `maps_to` carried in the run-record profile (GUA-123) |
| **Worker Skills** | Execution behaviors loaded by OMP (backend, frontend, QA, review, docs, migration). | Execution layer (ADR_001 skill taxonomy §3) | `.omp/skills/` (target), persona bodies (today) | Delivered via `--append-system-prompt` (persona body; GUA-123) |
| **Runtime Config** | Model tier, tool allowlist, flags (`--auto-approve --mode json`), sandbox cwd, env. | gorp (assembles), OMP (provides runtime) | `gorp/runtime/control/src/worker/omp.ts` | Persona-aware: model `GORP_OMP_MODEL`, persona body `GORP_OMP_SYSTEM_PROMPT_APPEND` forwarded by the adapter |
| **Worker** | The OMP agent process executing one graph node in a sandbox worktree. | OMP (lifecycle), gorp (dispatch) | spawned by `worker/omp.ts` | Implemented, persona-aware |

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

## Current (implemented) vs target

| Concern | Current (GUA-123, landed) | Target (unchanged) |
|---|---|---|
| Prompt | node fields + persona body appended via `--append-system-prompt` (env `GORP_OMP_SYSTEM_PROMPT_APPEND`) | same |
| Model | persona `model` tier via `GORP_OMP_MODEL`; env override stays | same |
| Role | persona `maps_to` carried in run-record profile | surfaced in inspect |
| Tools | persona `tools` documented in persona file; env-driven | allowlist refinement |
| Run record | `profile {persona, model}` stamped; visible via `wf review` / `gorp inspect` | same |

## Boundaries (resolved by GUA-123, merge ed1a6ff)

1. **Persona flow into the graph — RESOLVED.** Optional `persona` added to
   `sprint.schema.json` (task), `execution-graph.schema.json` (node), and
   `run-record.schema.json` (`profile`). Additive-optional: old documents and
   records remain schema-valid. Compiler carries task.persona → node.persona;
   run.ts stamps the profile.
2. **Worker-skill delivery — RESOLVED.** Prompt injection: the persona body
   is delivered to the omp invocation via `--append-system-prompt`
   (`GORP_OMP_SYSTEM_PROMPT_APPEND` env read by the adapter). No file copying
   into sandboxes.
3. **Adapter stays source-neutral — RESOLVED.** The adapter never reads
   guava-os paths. It consumes `node.persona` as data and the
   `GORP_OMP_MODEL` / `GORP_OMP_SYSTEM_PROMPT_APPEND` env. The guava-os `wf`
   layer is responsible for resolving persona → env (follow-up: automate
   per-graph env resolution from `.guava-os/personas/`).

## Approval gate

Approved via the Operational Spine sprint (GUA-123, GUA-111, GUA-137) and
landed on main (merge ed1a6ff, 2026-08-12); proven live on guava-site.
