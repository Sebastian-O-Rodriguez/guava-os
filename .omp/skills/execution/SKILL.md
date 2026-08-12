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
- gorp CLI: `compile-graph`, `graph create|validate|show|transition`, `run`,
  `review`, `approve|reject|retry`, `promote`, `inspect`, `orchestrate`
- Contracts: `gorp/specs/runtime/*.schema.json`
- Registry input: `GORP_PROJECT_REGISTRY` — guava-os-owned file; gorp has no
  internal default
