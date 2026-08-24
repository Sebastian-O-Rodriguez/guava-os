# ADR_001 Realignment — Closeout

**Date:** 2026-07-31
**Sprint:** GUA-44 — ADR_001 Repository Realignment

## Quality gates

| Package | Typecheck | Tests | Result |
|---|---|---|---|
| guava-os (`.guava-os/`) | `tsc --noEmit` — clean | 91/91 passed (4 files) | ✓ |
| gorp (`gorp/runtime/control/`) | `tsc --noEmit` — clean | 161/161 passed (17 files) | ✓ |

## Ownership audit

Every ADR_001 concern → exactly one owner → evidence.

| Concern | Owner | Evidence |
|---|---|---|
| Operating model, boundaries | ADR_001 | `ADR_001.md` (supreme); Amendment 1 ratified |
| Authority chain | ADR_001 | `AGENTS.md`, `gorp/README.md`, `runtime/control/README.md` all list ADR first |
| Planning, task decomposition | guava-os | GOS-5: planning decisions in guava-os; `guava-os wf plan` wraps `gorp compile-graph` |
| Orchestration (decide what runs) | guava-os | GOS-10: `guava-os wf orchestrate/status` |
| Governance workflow (review/promotion) | guava-os | GOS-10: `guava-os wf approve/reject/retry/promote` |
| Project registry | guava-os | GOS-4: `.guava-os/registry/projects.yml`; gorp receives via `GORP_PROJECT_REGISTRY` |
| Linear project management | guava-os | GOS-18/19: `linear-client.ts` — sole Linear interface; `guava-os pm` commands |
| Linear conventions | guava-os | GOS-21: `docs/architecture/linear-conventions.md` |
| Linear skills (agent interface) | guava-os | GOS-20: `.omp/skills/linear/SKILL.md` |
| Execution graph (mechanics) | gorp | `gorp/runtime/control/` — graph store, transitions, compile-graph |
| Worker dispatch (adapter seam) | gorp | GOS-11: `worker/omp.ts` + `worker/fixture.ts`; `worker/adapter.ts` |
| Worktree isolation | gorp | `sandbox/worktree.ts` |
| Execution state | gorp | `storage/graph-store.ts`, machine-local state root |
| Retries, recovery | gorp | `run/policy.ts`, orchestrator/scheduler |
| Audit trail | gorp | `audit/chain.ts` — hash-chained |
| Promotion gates | gorp | `promote/promote.ts` — fail-closed |
| Scope/command gates | gorp | `gate/scope.ts`, `gate/commands.ts` |
| Governance enforcement | gorp | fail-closed gates, hash binding, transition table |
| Roles | guava-os | six OMP agent types; `.guava-os/config.json` `roles` |
| OMP runtime contract | gorp (source-neutral) | GOS-8: `docs/architecture/omp-runtime-boundary.md` |
| Operator session model | Herdr (planned) | GOS-3: VISION/SYSTEM-MODEL mention Herdr |
| guava-os ↔ gorp contract | both | GOS-2: `docs/architecture/guava-os-gorp-contract.md` |

## Issues completed

| Issue | Key | What landed |
|---|---|---|
| GOS-1 | GUA-45 | ADR_001 first in all authority chains |
| GOS-2 | GUA-47 | Contract doc + ADR amendment 1 |
| GOS-17 | GUA-61 | Governance command inventory (19 commands, one owner each) |
| GOS-8 | GUA-53 | OMP runtime boundary contract (`omp -p` invocation documented) |
| GOS-18 | GUA-62 | Linear provider boundary (touchpoint audit, nine operations) |
| GOS-3 | GUA-49 | Canonical docs rewritten (VISION/SYSTEM-MODEL/INVARIANTS/manifest) |
| GOS-21 | GUA-65 | Linear conventions doc (native fields first, labels for metadata) |
| GOS-19 | GUA-63 | Linear tooling (`linear-client.ts`, `pm` CLI commands) |
| GOS-4 | GUA-50 | Registry moved to `.guava-os/registry/`; gorp fail-closed without env |
| GOS-5 | GUA-51 | Planner → graph compiler; `gorp plan` → `gorp compile-graph` |
| GOS-6 | GUA-52 | `ExecutionGraph` → `IssueGraph`; "control plane" → "execution engine" |
| GOS-16 | GUA-46 | RoutineMe → guava-os in config/fixtures/docs |
| GOS-10 | GUA-55 | Workflow surface (`guava-os wf plan/orchestrate/review/promote/...`) |
| GOS-11 | GUA-56 | OMP worker adapter (`worker/omp.ts`) |
| GOS-13 | GUA-58 | Hermes adapter retired (code + tests deleted) |
| GOS-20 | GUA-64 | Linear skills (`.omp/skills/linear/SKILL.md`) |
| GOS-9 | GUA-54 | All guava-hermes references removed |
| GOS-12 | GUA-57 | Doc sweep (11 .guava-os docs + 3 skills to final architecture) |
| GOS-14 | GUA-59 | ROADMAP retired to history; pilot report deleted |
| GOS-7 | GUA-48 | Canceled — merged into GOS-14 |

## Boundary violations: zero

- No guava-os code imports gorp internals (workflow.ts calls gorp via subprocess only).
- No gorp code references Linear (source-neutrality test passes).
- No agent-facing surface uses Linear MCP directly (skills route through `guava-os pm`).
- No "governance-of-execution" or "Gorp wins" language remains outside history.
- No hermes references in source code (contracts test passes).
- Registry is owned by guava-os; gorp has no internal default path.
- Roles defined in guava-os (`.guava-os/config.json`); select the OMP agent.

## Known gaps

1. **Linear API key env** — `LINEAR_API_KEY` not set in the shell; guava-os tooling correctly fails closed. MCP used as fallback for Linear status updates during this sprint. Operator should set the env var for production use.
2. **OMP adapter e2e** — the adapter is registered and passes contract tests, but a full governed run with a real OMP worker (sandbox + sprint graph + `gorp inspect`) was not executed (needs configured `GORP_PROJECT_REGISTRY` + a real sprint). The adapter code is complete and contract-conforming.
3. **Full-suite flake** — one integration test occasionally fails under parallel load (pre-existing; passes in isolation). Not caused by this sprint.
4. **Linear status updates** — issues GUA-45 through GUA-64 not marked Done in Linear (MCP token expired mid-session). Repo work is complete and verified.
