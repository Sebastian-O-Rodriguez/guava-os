# Guava OS CLI

## Commands

| Command | Surface | Reads stdin | Calls Linear |
|---|---|---|---|
| `doctor` | validate repo setup | optional | no |
| `status` | executable queue by role | yes | no |
| `validate` | protocol violations | yes | no |
| `next` | one launch directive per role | yes | no |
| `work` | open work by role (session gate) | no | **yes** |
| `pm` | Linear create/update/link/move/comment/cancel/archive | no | **yes** |
| `register` | project bootstrap | no | no |

Roles are the 6 OMP agent types: `task`, `reviewer`, `scout`, `designer`,
`sonic`, `librarian`. Each executable issue carries exactly **one role label**;
that label picks the subagent a project session dispatches.

## Classifier commands (`doctor`, `status`, `validate`, `next`)

Read-only over stdin JSON. They never call Linear, mutate state, or write files.

```bash
guava-os doctor
cat issues.json | guava-os status
cat issues.json | guava-os validate
cat issues.json | guava-os next --role task
```

### `status`

Groups executable work by role. Categories: EXECUTABLE (Todo, one role label,
active parent), NOT_PROMOTED (Backlog), BLOCKED (unresolved `blocks`), INVALID
(protocol violations), PARENTS (container health). Exit 0 if any executable
work exists.

### `validate`

Violation codes:

- `V302` orphan_sub_issue (warning)
- `V303` parent_not_active (error)
- `V304` empty_parent (warning)
- `V305` subtask_overflow (error)
- `V306` container_role_label (warning)
- `V307` external_blocker_gap (warning)
- `V400` missing_role_label (error)
- `V401` multiple_role_labels (error)
- `V402` unknown_role_label (warning)
- `V500` queue_overflow (warning)

Exit 0 if no errors; `--strict` makes warnings fail too.

### `next`

One operator-ready directive per role (highest-priority executable issue).
`--role <name>` filters to a single role. Read-only.

## Network commands

### `work`

The session gate — queries Linear and reports open work (Todo by role, plus
In Progress / In Review counts). This is the "script, not AI" bootstrap a
session hook runs on open.

```bash
guava-os work          # this project (repo config)
guava-os work --all    # every active registry project
guava-os work --json
```

Exit `0` if open work exists, `1` if none (the hook closes the session on 1).

### `pm`

All Linear read/write through the guava-os tooling layer — the only supported
Linear interface:

```bash
guava-os pm get-project
guava-os pm get-sprint [parent-id]
guava-os pm get-issue <id>
guava-os pm search --project <name> --status Todo --label task
guava-os pm create --title "..." --team "Guava AI" --label task
guava-os pm link <id> --blocked-by <id>
guava-os pm move <id> --status "In Progress"
guava-os pm comment <id> --body "..."
guava-os pm archive <id>
```

Prefer `pm` for Linear; Linear MCP is a last-resort fallback.

## Stdin contract (classifier commands)

A JSON array of Linear issues:

```json
[{
  "id": "GUA-10", "title": "Issue title",
  "status": "Todo", "statusType": "unstarted",
  "priority": { "value": 2, "name": "High" },
  "labels": ["task"], "parentId": "GUA-5",
  "project": "guava-os", "createdAt": "2026-01-01", "updatedAt": "2026-01-01",
  "completedAt": null, "canceledAt": null
}]
```

## Sample fixtures

```bash
cat .guava-os/fixtures/clean.json     | guava-os validate   # exit 0
cat .guava-os/fixtures/warnings.json  | guava-os validate   # exit 0 (warnings only)
cat .guava-os/fixtures/errors.json    | guava-os validate   # exit 1 (errors)
```