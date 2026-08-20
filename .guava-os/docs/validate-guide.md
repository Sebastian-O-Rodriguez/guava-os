# `validate` — violation codes

Read-only, stdin-driven. Detects structural problems in the issue graph.

```bash
cat issues.json | guava-os validate
cat issues.json | guava-os validate --strict   # warnings fail too
```

## Errors

| Code | Name | Meaning |
|---|---|---|
| `V303` | `parent_not_active` | todo child under a Backlog/Done parent |
| `V305` | `subtask_overflow` | parent exceeds `max_subtasks_per_parent` |
| `V400` | `missing_role_label` | deliverable has no role label |
| `V401` | `multiple_role_labels` | deliverable has >1 role label |

## Warnings

| Code | Name | Meaning |
|---|---|---|
| `V302` | `orphan_sub_issue` | parent id not in dataset |
| `V304` | `empty_parent` | active parent with no children + no role label |
| `V306` | `container_role_label` | container wrongly carries a role label |
| `V307` | `external_blocker_gap` | blockers may exist outside the snapshot |
| `V402` | `unknown_role_label` | label not in configured roles |
| `V500` | `queue_overflow` | role queue exceeds `max_todo_per_role` |

Roles are `task`, `reviewer`, `scout`, `designer`, `sonic`, `librarian`. Fix in
Linear, re-run `validate` until exit 0.