# gorp Playbook

The execution-engine operating loop. gorp compiles operator-approved requests
into execution graphs, dispatches workers, enforces gates, records audit, and
returns results. Deterministic; no planning, no Linear (ADR_001).

Authority: `ADR_001.md` → `docs/architecture/guava-os-gorp-contract.md` →
this playbook → skills (`.omp/skills/`) → runtime (`gorp/runtime/control/`) →
contracts (`gorp/specs/runtime/`).

## Loop

1. **Receive approved request** — an operator-approved sprint document
   (`gorp/specs/runtime/sprint.schema.json`). Project identity only; the repo
   path resolves from the guava-os-owned registry.
2. **Compile graph** — sprint → draft execution graph, deterministically;
   rejects cycles, unknown adapters, illegal review postures. The operator
   approves the draft before anything runs. Skill: `execution`.
3. **Build worker profile** — persona + OMP role + worker skills + runtime
   config → one worker invocation. Contract:
   `docs/architecture/worker-profile-contract.md`. Adapter wiring pending —
   today the adapter dispatches blind (persona/model not read). Skill:
   `execution`.
4. **Dispatch** — run graph nodes via the worker adapter seam (fixture | omp)
   inside isolated sandbox worktrees. Skill: `execution`.
5. **QA / gates** — scope gate, command gate, review policy; fail closed.
   Every non-fixture worker stops for human review. Skill: `execution`.
6. **Audit** — every run appends hash-chained records; full reconstruction
   via inspect. Skill: `execution`.
7. **Return results** — structured worker results and records to guava-os.
   Review/promotion decisions are guava-os's; gorp enforces them.

## Ownership

- gorp owns: graph mechanics, dispatch, worktree isolation, retries, gates,
  audit trail, execution artifacts.
- gorp must not: read/write Linear, plan, prioritize, make governance
  decisions, depend on a specific engineering runtime.
- guava-os-owned decisions currently hosted in the gorp CLI (orchestrate /
  review / approve / reject / retry / promote) remain guava-os decisions per
  the contract command inventory (GOS-10).

## Worker skills

Execution behaviors (backend, frontend, architecture, QA, review, docs,
migration) are loaded by OMP at dispatch. Documented only; current embodiment
is `.guava-os/personas/<name>/persona.md`. Workers have no Linear access and
make no project-management decisions.

## Skills

| Skill | Owns |
|---|---|
| `execution` | compile → profile → dispatch → gates → audit → results |
