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
| `V400` | `missing_domain_label` | deliverable has no domain label |
| `V404` | `readiness_label_count` | deliverable has 0 or >1 readiness label |
| `V405` | `missing_description_sections` | description missing a required section |

## Warnings

| Code | Name | Meaning |
|---|---|---|
| `V302` | `orphan_sub_issue` | parent id not in dataset |
| `V304` | `empty_parent` | active parent with no children + no domain label |
| `V307` | `external_blocker_gap` | blockers may exist outside the snapshot |
| `V402` | `unknown_label` | label not in configured domains/types/readiness |
| `V403` | `multiple_domain_labels` | deliverable has >1 domain label |
| `V500` | `queue_overflow` | domain queue exceeds `max_todo_per_domain` |

Domains are `pm`, `qa`, `security`, `backend`, `frontend`, `devops`, `ai-ml`. Fix in
Linear, re-run `validate` until exit 0.