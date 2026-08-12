# Limitations

> These apply to the classifier commands (`doctor`, `status`, `validate`,
> `next`) only. Planning/management (`pm`, `sprint`, `wf`) call Linear and
> mutate state — see `.omp/skills/planning/SKILL.md`.
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

## Not Implemented (classifier commands)

| Capability | Why | Impact |
|-----------|-----|--------|
| **Dependency/blocker detection** | Classifier reads stdin only; dependency data is available via `pm search` and used by `sprint generate`. | BLOCKED category empty unless caller provides relations. |
| **Stale claim detection** | Requires git branch activity data and Linear comment timestamps. | In Progress sub-issues are not age-checked. Stale work is invisible. |
| **Agent identity context** | CLI doesn't know which agent is running. | Cannot detect persona mismatch on active claims (V102). |
| **Status transition history** | CLI sees current state, not history. | Cannot detect illegal transitions (V200), skipped review (V203), or unauthorized Done (V202). |
| **Git integration** | CLI doesn't read git state. | Cannot validate branch naming, detect commits, or verify branch existence. |
| **Hooks / pre-action enforcement** | No OMP runtime hooks configured. | Protocol violations are detected after the fact, not prevented. |
| **Dashboard / GUI** | Not implemented. | CLI output only. |
| **Activity tracking** | No lease or activity monitoring. | Cannot extend claim leases or detect abandoned work. |
| **Concurrency handling** | No lock or contention detection. | If two agents claim the same sub-issue, the CLI won't detect it. |

## Known Edge Cases

### Sub-issues without parents in dataset

If a sub-issue references a parent that isn't in the Linear export (e.g., different project, deleted issue), it's flagged as V302 (orphan). The CLI can't determine the parent's status, so the sub-issue is excluded from the executable queue.

### Canceled issues

Issues with `canceledAt` set are excluded from all processing. They don't appear in any status category and don't trigger violations.

### Parent issues with no sub-issues

An issue with no `parentId` and no children referencing it is treated as a standalone/parent. If it's in an active status (Todo/In Progress), V304 fires as a warning.

### In Progress / In Review sub-issues

Sub-issues actively being worked (In Progress) or awaiting QA (In Review) do not appear in any status category. They're not executable (already claimed), not blocked, not invalid. They're simply in progress and not the CLI's concern.
