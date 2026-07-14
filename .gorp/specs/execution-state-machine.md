# Execution State Machine

> **`DUPLICATE` — DEPRECATED (Reconciliation, 2026-07-14).** Drifted copy of
> `~/dev/gorp/specs/execution-state-machine.md`; Linear-derived states are
> legacy. Not authoritative. See `DOCUMENTATION-AUTHORITY-MAP.md`.

Defines canonical execution states for the Guava OS runtime.

## Design Principle

Guava OS has its own canonical execution states. These are **derived from multiple inputs**, not a 1:1 mirror of any single system.

Inputs to state derivation:
- Linear issue status (primary signal)
- Parent/sub-issue graph relationships
- Persona label validity
- Dependency/blocking relations (when available)
- Claim lease status (when available)
- Queue capacity

A sub-issue with Linear status "Todo" may not be in the Guava OS `EXECUTABLE` state if its parent is inactive, its persona label is missing, or a blocker is unresolved.

## Canonical States

| State | Derived From | Meaning |
|-------|-------------|---------|
| `NOT_PROMOTED` | Linear status is Backlog | Created, not promoted. Not executable. Awaiting Robo promotion. |
| `EXECUTABLE` | Linear status is Todo AND parent active AND persona valid AND (no unresolved blockers OR dependency data unavailable) | Eligible for agent claim. In persona queue. |
| `BLOCKED` | Linear status is Todo AND parent active AND persona valid AND dependency unresolved | Would be executable but for unresolved blocker. Requires `dependencyRelationsLoaded`. |
| `CLAIMED` | Linear status is In Progress | Actively owned and being worked by an agent. |
| `IN_REVIEW` | Linear status is In Review | Work complete, awaiting QA validation. |
| `INVALID` | Structural violation detected | Violates protocol — see violation codes. Not executable. |
| `DONE` | Linear status is Done | QA passed, merged, deployed. Terminal. |
| `CANCELED` | Linear status is Canceled/Duplicate | Abandoned. Terminal. |

## State Derivation vs Linear Status

| Linear Status | Possible Guava OS States | Deciding Factors |
|---------------|-------------------------|------------------|
| Backlog | NOT_PROMOTED | Always — no further evaluation needed |
| Todo | EXECUTABLE, BLOCKED, INVALID | Parent active? Persona valid? Blockers resolved? |
| In Progress | CLAIMED, INVALID | Valid claim? (parent exists, persona match) |
| In Review | IN_REVIEW | Always — no further evaluation in current phase |
| Done | DONE | Always — terminal |
| Canceled/Duplicate | CANCELED | Always — terminal |

## Legal Transitions

| From | To | Who | Condition |
|------|----|-----|-----------|
| NOT_PROMOTED | EXECUTABLE | Robo | Parent active, persona label present, queue < MAX_TODO_PER_PERSONA, blockers resolved |
| EXECUTABLE | CLAIMED | Builder | All 5 eligibility conditions pass |
| CLAIMED | IN_REVIEW | Builder | Work complete, submission protocol followed |
| IN_REVIEW | DONE | QA | All quality gates pass (tsc, vitest, build) |
| IN_REVIEW | CLAIMED | QA | QA block — rework needed (max 2 cycles) |
| CLAIMED | EXECUTABLE | Robo | Stale claim reclamation (lease expired, within RECLAIM_LIMIT) |
| EXECUTABLE | NOT_PROMOTED | Human | Deprioritized |
| BLOCKED | EXECUTABLE | Robo | Blocking dependency resolved |
| Any non-terminal | CANCELED | Human | Scope removed |

## Illegal Transitions

| Transition | Why | Violation Code |
|-----------|-----|---------------|
| NOT_PROMOTED → CLAIMED | Must be promoted to EXECUTABLE first | V101 |
| EXECUTABLE → DONE | Must go through CLAIMED + IN_REVIEW | V203 |
| CLAIMED → DONE | Must go through IN_REVIEW (QA gate) | V203 |
| DONE → Any | Terminal state, no rollback | V200 |
| CANCELED → Any | Terminal state | V200 |
| Builder sets DONE | Only QA sets DONE | V202 |
| Builder sets EXECUTABLE | Only Robo/Human manages queue state | V201 |
| Builder claims parent issue | Parents are containers | V100 |

## Parent Issue Lifecycle

Parents have derived states, not independently managed states:

| Trigger | Parent Transition | Who |
|---------|------------------|-----|
| First subtask enters CLAIMED | Parent: Todo → In Progress | Robo (autonomous action B) |
| All subtasks reach DONE | Parent: In Progress → Done | Robo (autonomous action C) |
| Subtask returned to EXECUTABLE | No parent change | — |
| All subtasks CANCELED | Parent: → CANCELED | Human decision |

Parents are containers — never directly claimed by builders.

**Partial completion**: If some subtasks are DONE and others are CANCELED, the parent remains In Progress until a human decides whether to close it or create replacement subtasks.

## Capability Dependencies

| Input | Available | Effect When Missing |
|-------|-----------|---------------------|
| Linear status | Always | Required — derivation cannot proceed without it |
| Parent/sub-issue graph | Always | Required — from parentId field in issue data |
| Persona labels | Always | Required — from issue labels matched against config |
| Dependency relations | **Phase 2** | BLOCKED state cannot be derived. Sub-issues that would be BLOCKED are classified as EXECUTABLE. Runtime declares `dependencyRelationsLoaded: false`. |
| Claim lease data | **Phase 2** | Stale detection unavailable. All In Progress issues are CLAIMED regardless of age. |

The runtime declares which capabilities are loaded via `GraphCapabilities`. Consumers MUST check capabilities before treating BLOCKED as authoritative.

## Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| IN_REVIEW → EXECUTABLE legal? | **No.** IN_REVIEW → CLAIMED (rework). | Rework goes back to the same agent who submitted. Skipping to EXECUTABLE would lose assignment context. |
| CANCELED reversible? | **No.** Human creates a new issue instead. | Reopening canceled work creates confusing history. Fresh issue is cleaner. |
| Partial parent completion? | **Human decides.** Parent stays In Progress. | Automated closure with canceled subtasks risks premature completion. |
| Reclassify EXECUTABLE → BLOCKED retroactively? | **Yes, when dependency data becomes available.** | EXECUTABLE without dependency data is provisional. The runtime upgrades classification precision as capabilities are added. |
