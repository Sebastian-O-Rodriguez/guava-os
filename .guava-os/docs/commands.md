# Commands

The Guava OS CLI has two surfaces:

- **Classifier commands** (`doctor`, `status`, `validate`, `next`) — read-only,
  stdin-driven JSON; never call Linear or mutate state.
- **Live commands** (`work`, `pm`) — query Linear; the session gate + project
  management.
- **Bootstrap** (`register`) — project setup.

```bash
.guava-os/bin/guava-os <command> [flags]
```

## `doctor`

Validates repo setup (config, registry remotes, Linear data availability, role
labels, gitignore). Read-only.

## `status`

Shows the executable queue grouped by role.

```bash
cat issues.json | guava-os status
cat issues.json | guava-os status --json
```

Exit 0 if executable work exists for at least one role.

## `validate`

Detects protocol violations.

```bash
cat issues.json | guava-os validate
cat issues.json | guava-os validate --strict
```

Codes: `V302` orphan · `V303` parent_not_active (error) · `V304` empty_parent ·
`V305` subtask_overflow (error) · `V306` container_role_label · `V307`
external_blocker_gap · `V400` missing_role_label (error) · `V401`
multiple_role_labels (error) · `V402` unknown_role_label · `V500`
queue_overflow.

Exit 0 if no errors; `--strict` also fails on warnings.

## `next`

One launch directive per role (highest-priority executable issue).

```bash
guava-os next < issues.json
guava-os next --role task < issues.json
```

Read-only. Exit 0 if at least one directive.

## `work`

The session gate — queries Linear for open work, grouped by role.

```bash
guava-os work          # this project
guava-os work --all    # every active registry project
guava-os work --json
```

Exit 0 if open work exists, 1 if none (the session hook closes on 1).

## `pm`

All Linear reads/writes. The only supported Linear interface — never Linear MCP.

```bash
guava-os pm search --project guava-os --status Todo --label task
guava-os pm create --title "..." --team "Guava AI" --label task
guava-os pm link <id> --blocked-by <id>
guava-os pm move <id> --status "In Progress"
guava-os pm comment <id> --body "..."
guava-os pm archive <id>
```

## Global flags

| Flag | Commands | Effect |
|---|---|---|
| `--json` | all | machine-readable output |
| `--strict` | `validate` | warnings become errors |
| `--role <name>` | `next` | filter directives to one role |
| `--all` | `work` | every registry project |