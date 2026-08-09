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

## Worker profile

Dispatch assembles a worker profile: persona
(`.guava-os/personas/<name>/persona.md`) → OMP role (`maps_to`) → worker
skills → runtime config (model, tools). Contract:
`docs/architecture/worker-profile-contract.md`. Adapter wiring is pending —
today the omp adapter dispatches blind (model from
`GORP_OMP_MODEL ?? "default"`; persona files are not read).

## Worker skills

Execution behaviors (backend, frontend, architecture, QA, review, docs,
migration) are loaded by OMP at dispatch. Documented only; current embodiment
is the persona files. Workers never touch Linear and never make governance
decisions.

## Uses

- `wf plan`, `wf orchestrate`, `wf orchestrate-status`, `wf review`,
  `wf promote` — guava-os wrappers over the gorp CLI
- gorp CLI: `compile-graph`, `graph create|validate|show|transition`, `run`,
  `review`, `approve|reject|retry`, `promote`, `inspect`, `orchestrate`
- Contracts: `gorp/specs/runtime/*.schema.json`
- Registry input: `GORP_PROJECT_REGISTRY` — guava-os-owned file; gorp has no
  internal default
