# guava-os ↔ gorp Contract

> **Authority:** ratified by ADR_001 (amendment 2026-07-30). When code or
> documentation conflicts with this contract or ADR_001, ADR_001 wins.

## Purpose

Fix the exact ownership seam between the control plane (guava-os) and the
execution engine (gorp). One owner per concern; no shared ownership.

## Ownership table

| Concern | Owner |
|---|---|
| Operating model, governance model, capability model, promotion model, architectural principles | GOS (ADR_001) |
| Planning, task decomposition | guava-os |
| Orchestration (deciding what happens next) | guava-os |
| Governance workflow (review, promotion decisions — operator-facing) | guava-os |
| Project registry | guava-os |
| Linear integration (project management via Linear) | guava-os |
| Cross-project awareness | guava-os |
| Execution graph (persisted, mechanics) | gorp |
| Dependency graph (execution-time) | gorp |
| Worker dispatch (adapter seam) | gorp |
| Worktree isolation | gorp |
| Execution state | gorp |
| Retries, recovery | gorp |
| Audit trail, execution artifacts | gorp |
| Promotion gates (fail-closed enforcement) | gorp |
| Scope gates, command gates | gorp |
| Engineering runtime (OMP) | OMP (composed, not owned by gorp) |
| Operator session management | Herdr (planned) |

## Decision vs enforcement

**guava-os owns decisions** — what happens next, operator-facing:

- planning and task decomposition
- orchestration (which node runs, in what order, for which project)
- governance workflow: review decisions (approve/reject/retry), promotion
  decisions, operator approval of plans
- project registry ownership
- Linear project management

**gorp owns enforcement** — deterministic mechanics that cannot be bypassed:

- fail-closed gates (scope, command, review-policy)
- hash binding (review decisions bind to the exact sandbox commit hash)
- audit chain (integrity evidence; no external anchor)
- worktree sandbox isolation
- worker dispatch through the source-neutral adapter seam
- execution-state transitions (enforced by the transition table)

The decision/enforcement split means: guava-os decides; gorp enforces that the
decision was made correctly and records it. Neither layer does the other's job.

### Governance command inventory (GOS-17)

Every governance command across both CLIs, classified decision (guava-os) or
enforcement (gorp). One owner per command; no shared ownership.

| Command | CLI | Owner | Classification | Rationale |
|---|---|---|---|---|
| `graph create` | gorp | gorp | enforcement | mechanically persists a graph document per schema |
| `graph validate` | gorp | gorp | enforcement | schema/contract validation — deterministic |
| `graph show` | gorp | gorp | enforcement | read persisted state — no decision |
| `graph transition` | gorp | gorp | enforcement | enforces the transition table; rejects illegal transitions |
| `compile-graph` | gorp | gorp | enforcement | compiles an approved execution request → draft graph (mechanics) |
| `run` | gorp | gorp | enforcement | executes one node: sandbox → worker → gate → stop at review |
| `review` | gorp | gorp | enforcement | read-only inspection of a run — no decision |
| `approve` | gorp | **→ guava-os (GOS-10)** | decision | operator review decision — guava-os workflow |
| `reject` | gorp | **→ guava-os (GOS-10)** | decision | operator review decision — guava-os workflow |
| `retry` | gorp | **→ guava-os (GOS-10)** | decision | operator review decision — guava-os workflow |
| `promote` | gorp | **→ guava-os (GOS-10)** | decision | operator promotion decision — guava-os workflow |
| `inspect` | gorp | gorp | enforcement | audit-trail reconstruction — read-only, no decision |
| `orchestrate` | gorp | **→ guava-os (GOS-10)** | decision | decides what runs next — guava-os orchestration |
| `orchestrate-status` | gorp | **→ guava-os (GOS-10)** | decision | surfaces orchestration state for operator decision |
| `doctor` | guava-os | guava-os | decision | repo-setup validation — operator-facing |
| `status` | guava-os | guava-os | decision | queue state — operator decides what to run |
| `validate` | guava-os | guava-os | decision | protocol violations — operator fixes Linear |
| `next` | guava-os | guava-os | decision | generates launch directives — operator-facing |
| `pm *` | guava-os | guava-os | decision | project management via Linear — operator/agent-facing |

**Rule:** commands marked "→ guava-os" are currently hosted in gorp but
owned by guava-os per ADR_001. GOS-5 moves `plan`; GOS-10 moves
orchestrate/review/promote. Until those moves land, the commands stay in
gorp as hosted mechanics — the ownership boundary is this table, not the
code location.

## Inputs

**To gorp:**
- An approved, schema-versioned execution graph (conforming to
  `gorp/specs/runtime/execution-graph.schema.json`).
- The project registry path (explicit input — `--registry` / `GORP_REGISTRY`;
  gorp has no internal default).
- Worker adapter selection (which adapter to use for dispatch).

**To guava-os:**
- Operator intent (plans, approvals, review decisions).
- Linear backlog (the canonical project-management source).

## Outputs

**From gorp:**
- Execution artifacts (worker results, changed files, sandbox diffs).
- Persisted records (run records, gate records, review decisions, promotion
  records).
- The hash-chained audit trail (reconstructable via `gorp inspect`).

**From guava-os:**
- Approved plans / execution graphs (handed to gorp for execution).
- Review and promotion decisions (handed to gorp for enforcement).
- Linear updates (status moves, issue creation, dependency links — all through
  guava-os tooling).

## Forbidden responsibilities

**gorp must not:**
- Read or write Linear.
- Own or produce plans (planning is guava-os).
- Own the backlog or prioritize work.
- Make governance decisions (approve/reject/promote — that is guava-os).
- Carry business context or portfolio management.
- Depend on any specific engineering runtime (OMP or otherwise).

**guava-os must not:**
- Own execution-graph mechanics (state transitions, persistence).
- Manage worker lifecycle or worktrees.
- Own retries or execution recovery.
- Act as the execution runtime.
- Bypass gorp's gates or audit.

## Registry interface

The project registry file is owned by guava-os (`guava-os` lives at
`.guava-os/registry/projects.yml` per GOS-4). gorp receives the registry path
as explicit input and resolves project identities from it; gorp never owns the
file and has no gorp-internal default path.

## Personas

Personas are defined in guava-os (`.guava-os/personas/<name>/persona.md`) and
map to OMP roles. They flow issue → SprintTask.persona → graph node.persona →
run-record `profile {persona, model}` (GUA-123, implemented). The omp adapter
is persona-aware via `GORP_OMP_MODEL` + `GORP_OMP_SYSTEM_PROMPT_APPEND`.
Personas do not own governance, approval, or promotion — those are
operator-only.
## Project management (Linear)

**guava-os owns project management via Linear.** Linear is the provider;
guava-os owns the interface; agents never depend on Linear directly.

```
Agent → guava-os Skills → guava-os Tooling → Linear (provider)
```

Never `Agent → Linear MCP → Linear`. Linear network access lives only in the
guava-os tooling layer (GOS-19). Agent workflows route through guava-os skills
(GOS-20). Conventions are defined in GOS-21. Linear-only implementation — no
generic provider abstraction is built; swap cost is contained at the tooling
layer by interface isolation.

### Touchpoint audit

| Touchpoint | Owner | Disposition |
|---|---|---|
| guava-os CLI stdin contract (`linear.ts`, `doctor`/`status`/`validate`/`next`) | guava-os | Keep — classifier over provider data. |
| Agent/operator Linear fetches via MCP | was: agents (uncontrolled) | **Remove.** Agents must not call Linear MCP directly. Replaced by guava-os skills (GOS-20) over guava-os tooling (GOS-19). |
| Retired ROADMAP §5 gorp-owned Linear adapter row | was: gorp (ADR violation) | Dies with ROADMAP retirement (GOS-14). |
| gorp runtime | gorp | Verify zero Linear domain references (source-neutrality enforced by test). |
| Workers (OMP agents) | OMP | Workers never fetch Linear — codified in the OMP boundary (GOS-8) and persona docs. |
| This sprint (GUA-44 + children) | guava-os | Canonical-backlog instantiation: the Linear project `guava-os` is the single project-management surface. |

### Provider interface (nine operations)

The guava-os-owned Linear interface. Versioned; no Linear-specific types leak
above the tooling layer.

| Operation | Description |
|---|---|
| get project | Fetch project metadata by name/id. |
| get sprint | Fetch the active sprint / parent issue + children. |
| get issue | Fetch a single issue by id. |
| search issues | Query issues by project, status, label, assignee. |
| create issue | Create an issue (title, description, parent, labels, project). |
| update issue | Update an issue (description, priority, assignee, labels). |
| link dependencies | Set blocks/blocked-by relations between issues. |
| move status | Transition an issue's Status. |
| assign issue | Set an issue's Assignee. |

Extended capabilities (GOS-19 scope): comments, links, assignments.

### Tooling boundary

Linear network access lives in exactly one place: the guava-os tooling layer.
Skills call tooling; agents call skills. No component below or beside the
guava-os plane touches the provider. The interface is versioned; replacing
Linear with another provider would touch only the tooling layer — but no
generic provider abstraction is built (Linear only).

## Amendment

This contract ratifies the operator decisions of 2026-07-30:
- guava-os owns decisions; gorp owns enforcement.
- guava-os owns project management via Linear (Linear-only, no generic provider).
- Personas defined in guava-os, loaded by OMP at dispatch.
- Registry as external input to gorp, never a gorp asset.
