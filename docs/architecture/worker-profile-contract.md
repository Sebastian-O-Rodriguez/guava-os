# Worker Profile Contract

> **Authority:** ADR_001 → `guava-os-gorp-contract.md` → this document.
> Status: **IMPLEMENTED, fail-closed** (GUA-123 merge ed1a6ff; GOS-46 /
> GUA-179, 2026-08-13). Persona flows issue → SprintTask.persona → graph
> node.persona → run-record `profile {persona, model, promptHash}`; the omp
> adapter is source-neutral and persona-aware via env (`GORP_OMP_MODEL`,
> `GORP_OMP_SYSTEM_PROMPT_APPEND` → omp `--model` + `--append-system-prompt`).
> A persona is REQUIRED to spawn: a missing or unresolvable profile fails
> closed before any worker process starts — never a weak/default fallback.
> Real persona-aware OMP execution is proven (GOS-35; guava-site live proof
> 2026-08-12).

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
| **Runtime Config** | Model tier, tool allowlist, flags (`--auto-approve --mode json`), process CWD = sandbox (provisioned with deps through symlinks), env. | gorp (assembles), OMP (provides runtime) | `gorp/runtime/control/src/worker/omp.ts` | Persona-aware: model `GORP_OMP_MODEL`, persona body `GORP_OMP_SYSTEM_PROMPT_APPEND` forwarded by the adapter |
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
| Tools | persona `tools` documented in persona file (guava-os-declared minimum); runtime OMP MCP servers (e.g. `supabase-mcpm`) are machine-scoped OMP config, not guava-os tools | allowlist refinement |
| Run record | `profile {persona, model, promptHash}` stamped; visible via `wf review` / `gorp inspect` | same |

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
   layer resolves persona → env from `.guava-os/personas/<name>/persona.md`
   (`src/persona.ts`). If resolution fails, orchestrate errors before gorp
   starts — and the adapter independently fails closed at dispatch.
4. **Multi-persona graphs — RESOLVED.** `wf orchestrate` resolves a profile
   (model + persona body) for EVERY persona in the graph into a bundle and
   passes it to `gorp orchestrate --persona-profiles <bundle>`. The scheduler
   spawns each node's `run` subprocess under THAT node's own persona env
   (per-node `GORP_OMP_MODEL` / `GORP_OMP_SYSTEM_PROMPT_APPEND`). A
   persona-annotated node with no resolved profile fails closed
   (`PROFILE_UNRESOLVED`) before spawn. Mixed-persona launch graphs (e.g.
   frontend + qa + backend) now dispatch each worker under the correct
   persona — no graph-wide single persona, no silent wrong-persona run.

## Fail-closed profile (GOS-46 / GUA-179)

Live incident GUA-155 traced a worker that timed out at 600s after launching
with the weak/default model and no persona body. Root cause: the omp adapter
silently fell back to `GORP_OMP_MODEL ?? "default"` and only appended the
persona body when `GORP_OMP_SYSTEM_PROMPT_APPEND` happened to be set. Both
defaults are removed:

- **A persona is required to spawn.** The omp adapter reads `node.persona`
  and, before spawning any process, verifies the resolved profile is present
  (`GORP_OMP_MODEL` and `GORP_OMP_SYSTEM_PROMPT_APPEND` both non-empty).
  A missing persona, model, or body raises a classified `WORKER_FAILED`
  GorpError — there is no weak/default fallback.
- **Deterministic lifecycle evidence.** The run record stamps the resolved
  profile plus a `promptHash` — `sha256({persona, model, systemPrompt})` —
  so a review decision binds to the exact profile that ran, and any drift in
  the persona body or model tier is detectable.
- **Layered enforcement.** guava-os resolves persona → env at orchestrate
  time (fail closed on a missing persona file or unresolvable model); the
  gorp omp adapter independently re-checks the resolved env at dispatch.

## Approval gate

Approved via the Operational Spine sprint (GUA-123, GUA-111, GUA-137) and
landed on main (merge ed1a6ff, 2026-08-12); proven live on guava-site.
