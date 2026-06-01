# Validate Guide

How to read and act on `guava-os validate` output.

## Violation Codes

### Errors (must fix before execution)

| Code | Name | What It Means | How to Fix |
|------|------|--------------|-----------|
| V303 | `parent_not_active` | Sub-issue is Todo but its parent is Backlog or Done | Move parent to Todo or In Progress in Linear |
| V400 | `missing_persona_label` | Sub-issue has no persona label — agents can't claim it | Add exactly one persona label (architect/backend/frontend/qa) in Linear |
| V401 | `multiple_persona_labels` | Sub-issue has more than one persona label — ambiguous | Remove extra labels, keep exactly one |

### Warnings (review, don't block)

| Code | Name | What It Means | When to Fix |
|------|------|--------------|------------|
| V302 | `orphan_sub_issue` | Sub-issue references a parent that isn't in the dataset | Check if parent was deleted or is in a different project |
| V304 | `empty_parent` | Active parent (Todo/In Progress) has zero sub-issues | Add sub-issues, or move parent to Backlog until decomposed |
| V402 | `unknown_persona_label` | Sub-issue has a label the CLI doesn't recognize | Check spelling, or add label to config if it's a new persona |
| V500 | `queue_overflow` | More Todo sub-issues for one persona than the configured max | May be intentional, or reduce the queue |

## Severity

**Errors** indicate protocol violations that will cause agents to fail or produce incorrect behavior. The sub-issue is classified as INVALID and excluded from the executable queue. Errors must be fixed in Linear.

**Warnings** indicate anomalies that may or may not be problems. Warnings do not exclude sub-issues from the queue. Review and use judgment.

## Exit Codes

- `exit 0` — no errors (warnings may exist)
- `exit 1` — one or more errors

With `--strict`:
- `exit 0` — zero violations of any severity
- `exit 1` — any violation (error or warning)

## Reading the Output

### Clean graph

```
VALIDATE: no violations found
```

### Errors present

```
ERRORS
  V303 parent_not_active          GUA-52       Parent GUA-1 status "Backlog" is not active
  V400 missing_persona_label      GUA-50       Sub-issue has no persona label

WARNINGS
  V302 orphan_sub_issue           GUA-53       Sub-issue references parent GUA-GONE not found

SUMMARY: 2 errors, 1 warnings, 3 total
```

Errors are listed first, then warnings. Within each group, violations are sorted by code, then issue ID.

## Remediation Workflow

1. Run `validate`
2. If errors exist, fix each one in Linear:
   - V303: move parent to active status
   - V400: add persona label
   - V401: remove extra persona labels
3. Re-export Linear data
4. Re-run `validate`
5. Repeat until `exit 0`

## Common Patterns

### "validate passes but status shows 0 executable"

This is correct. `validate` checks structural integrity. `status` checks promotion state. All sub-issues in Backlog will pass validate (they're structurally valid) but won't appear as executable (they're not promoted).

### "V400 on a sub-issue I thought had a label"

Check Linear — the label may have been removed, or the label name doesn't match config. The CLI matches against `config.labels.persona_labels` and `config.labels.qa_label` exactly.

### "V304 on a parent I just created"

Expected if the parent is in Todo or In Progress but you haven't created sub-issues yet. Move it to Backlog until decomposed, or add sub-issues.

## JSON Output

```bash
cat issues.json | .guava-os/bin/guava-os validate --json
```

```json
{
  "summary": { "errors": 2, "warnings": 1, "total": 3 },
  "violations": [
    {
      "code": "V303",
      "name": "parent_not_active",
      "severity": "error",
      "issue_id": "GUA-52",
      "detail": "Parent GUA-1 status \"Backlog\" is not active"
    }
  ]
}
```

Each violation has: `code`, `name`, `severity`, `issue_id`, `detail`.
