# Limitations

Current capabilities and constraints of Guava OS CLI.

## Implemented

| Capability | Status |
|-----------|--------|
| Repo setup validation (`doctor`) | Working |
| Execution queue inspection (`status`) | Working |
| Protocol violation detection (`validate`) | Working — 7 violation codes |
| Parent/sub-issue graph building | Working — Linear-native `parentId` |
| Persona routing validation | Working — label matching against config |
| JSON and human output modes | Working |
| Deterministic, reproducible output | Working |
| Read-only operation | Enforced — tested |
| Fixture-based testing | Working — 91 tests |

## Not Implemented

| Capability | Why | Impact |
|-----------|-----|--------|
| **Dependency/blocker detection** | Linear's `list_issues` doesn't return blocking relations. Per-issue `get_issue` calls needed. | BLOCKED category is always empty. Sub-issues with real blockers appear as EXECUTABLE. Operators must manually verify dependency order. |
| **Linear data fetching** | CLI is a pure data processor by design. No network layer. | Caller must pipe data via stdin. |
| **Linear mutations** | Read-only by design in current phase. | Promotion, reclamation, status changes must be done manually in Linear. |
| **Stale claim detection** | Requires git branch activity data and Linear comment timestamps. | In Progress sub-issues are not age-checked. Stale work is invisible. |
| **Agent identity context** | CLI doesn't know which agent is running. | Cannot detect persona mismatch on active claims (V102). |
| **Status transition history** | CLI sees current state, not history. | Cannot detect illegal transitions (V200), skipped review (V203), or unauthorized Done (V202). |
| **Git integration** | CLI doesn't read git state. | Cannot validate branch naming, detect commits, or verify branch existence. |
| **Hooks / pre-action enforcement** | No OMP runtime hooks configured. | Protocol violations are detected after the fact, not prevented. |
| **Robo control loop** | Not implemented. | No automated promotion, reclamation, or queue management. |
| **Dashboard / GUI** | Not implemented. | CLI output only. |
| **Activity tracking** | No lease or activity monitoring. | Cannot extend claim leases or detect abandoned work. |
| **Concurrency handling** | No lock or contention detection. | If two agents claim the same sub-issue, the CLI won't detect it. |

## Intentionally Deferred

These are planned but deliberately postponed to maintain system stability:

| Capability | Deferred Until | Rationale |
|-----------|---------------|-----------|
| `guava-os robo` (dry-run) | Phase 3 | Requires dependency data for safe promotion recommendations |
| `guava-os robo --apply` | Phase 3+ | Mutation authority requires human opt-in and audit logging |
| OMP runtime hooks | Phase 3+ | Enforcement should be proven via validate before being automated |
| Dependency relation loading | Phase 3 | N+1 API call pattern needs rate-limit design |
| Manifest generation | Phase 3 | Useful for hooks, not needed for manual workflow |

## Known Edge Cases

### Sub-issues without parents in dataset

If a sub-issue references a parent that isn't in the Linear export (e.g., different project, deleted issue), it's flagged as V302 (orphan). The CLI can't determine the parent's status, so the sub-issue is excluded from the executable queue.

### Canceled issues

Issues with `canceledAt` set are excluded from all processing. They don't appear in any status category and don't trigger violations.

### Parent issues with no sub-issues

An issue with no `parentId` and no children referencing it is treated as a standalone/parent. If it's in an active status (Todo/In Progress), V304 fires as a warning.

### In Progress / In Review sub-issues

Sub-issues actively being worked (In Progress) or awaiting QA (In Review) do not appear in any status category. They're not executable (already claimed), not blocked, not invalid. They're simply in progress and not the CLI's concern.
