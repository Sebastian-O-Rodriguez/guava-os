# Violation Codes

> **`DUPLICATE` — DEPRECATED (Reconciliation, 2026-07-14).** Drifted copy of
> `~/dev/gorp/specs/violation-codes.md`. Not authoritative. See
> `~/dev/gorp/reference/history/DOCUMENTATION-AUTHORITY-MAP.md`.

Canonical identifiers for protocol violations detected by the Guava OS runtime.

## Code Format

`V{NNN}` — three-digit numeric code, grouped by category.

Codes are **stable** — once assigned, a code always means the same thing. Deprecated codes are marked as such, never reassigned.

## Violation Registry

### V1xx — Claim Violations

| Code | Name | Severity | Description | Detectable Now |
|------|------|----------|-------------|----------------|
| V100 | `parent_claimed` | error | Builder claimed a parent issue (has sub-issues) | Phase 2 |
| V101 | `backlog_claimed` | error | Issue claimed (In Progress) while in Backlog status | Phase 2 |
| V102 | `persona_mismatch` | error | Claiming agent's persona does not match issue's persona label | Phase 2 |

### V2xx — Status Transition Violations

| Code | Name | Severity | Description | Detectable Now |
|------|------|----------|-------------|----------------|
| V200 | `illegal_transition` | error | Status transition not in legal transition table | Phase 2 |
| V201 | `unauthorized_promotion` | error | Non-robo agent promoted Backlog → Todo | Phase 2 |
| V202 | `unauthorized_done` | error | Non-QA agent set status to Done | Phase 2 |
| V203 | `skip_review` | error | Issue moved to Done without passing through In Review | Phase 2 |

### V3xx — Graph Structure Violations

| Code | Name | Severity | Description | Detectable Now |
|------|------|----------|-------------|----------------|
| V300 | `dependency_cycle` | error | Circular blocking relationship detected | Phase 2 (needs relation data) |
| V301 | `unresolved_blocker` | error | Issue claimed but has unresolved blocking dependency | Phase 2 (needs relation data) |
| V302 | `orphan_sub_issue` | warning | Sub-issue references parent not found in project dataset | **Yes** |
| V303 | `parent_not_active` | error | Sub-issue in Todo but parent status not in active set | **Yes** |
| V304 | `empty_parent` | warning | Parent issue in Todo/In Progress with zero sub-issues | **Yes** |

### V4xx — Label/Persona Violations

| Code | Name | Severity | Description | Detectable Now |
|------|------|----------|-------------|----------------|
| V400 | `missing_persona_label` | error | Sub-issue has no persona label — not routable to any agent. Promoted from warning: unlabeled sub-issues are never executable. | **Yes** |
| V401 | `multiple_persona_labels` | error | Sub-issue has more than one persona label — ambiguous routing | **Yes** |
| V402 | `unknown_persona_label` | warning | Label present but not in configured persona list | **Yes** (not yet emitted) |

### V5xx — Queue / Capacity Violations

| Code | Name | Severity | Description | Detectable Now |
|------|------|----------|-------------|----------------|
| V500 | `queue_overflow` | warning | More than MAX_TODO_PER_PERSONA sub-issues in Todo for one persona | **Yes** (not yet emitted) |
| V501 | `stale_claim` | warning | In Progress longer than STALE_HOURS with no activity | Phase 2 (needs activity data) |
| V502 | `repeated_reclamation` | error | Same issue reclaimed more than RECLAIM_LIMIT times | Phase 2 (needs history) |
| V503 | `bulk_mutation` | error | Single robo cycle would mutate more than BULK_THRESHOLD issues | Phase 2 (robo --apply) |

## Severity Levels

| Level | Meaning | Runtime Behavior |
|-------|---------|-----------------|
| `error` | Protocol violation — must be resolved before execution can proceed | Phase 1.5: report. Phase 2+: block action or escalate. |
| `warning` | Anomaly — may indicate a problem but does not block execution | Report always. Never block. |

## Detection Phases

| Phase | Violations Detectable | Mechanism |
|-------|----------------------|-----------|
| Phase 1 (current) | V302, V303, V304, V400, V401 | `buildGraph()` classification — already emitted as INVALID |
| Phase 1.5 | V402, V500 | `guava-os validate` — graph analysis with config thresholds |
| Phase 2 | V100–V102, V200–V203, V300–V301 | Pre-action hooks or post-action control loop scan |
| Phase 2+ | V501–V503 | Robo control loop with activity/history data |

## Code Stability Rules

1. Once a code is published in this registry, it is never reassigned.
2. Deprecated codes are marked `deprecated` in the Severity column with a reason.
3. New codes are appended to the appropriate V{N}xx group.
4. Code ranges are allocated, not densely packed — gaps are intentional for future additions.

## Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Violations carry suggested remediation? | **Not in Phase 1.** Add in Phase 2 when `validate` exists. | Remediation text adds maintenance burden. Focus on detection correctness first. |
| Violation history persisted? | **No.** Violations are computed fresh each run. | The runtime is stateless. History belongs in a future telemetry layer. |
| Violations have source field? | **Yes, in Phase 2.** Add `detected_by` (status/validate/hook) and `detected_at` (ISO timestamp). | Useful for audit. Not needed until enforcement exists. |
