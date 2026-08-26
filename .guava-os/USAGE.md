# Guava OS CLI

## Commands

| Command | Surface | Reads stdin | Calls Linear |
|---|---|---|---|
| `doctor` | validate repo setup | optional | no |
| `status` | executable queue by domain | yes | no |
| `validate` | protocol violations | yes | no |
| `next` | one launch directive per domain | yes | no |
| `work` | open work by domain (session gate) | no | **yes** |
| `pm` | Linear create/update/link/move/comment/cancel/archive | no | **yes** |
| `register` | project bootstrap | no | no |
| `sync` | consumer convergence (config/labels/symlinks) | no | **yes** |
| `triage` | set readiness labels | no | **yes** |

An issue carries **one domain label** (selecting both the skill domain and the
OMP agent via the `domainAgents` map), **one type label**, and **one readiness
label** (`ready-for-work` to be dispatchable). The seven OMP agent types are
`task`, `reviewer`, `scout`, `designer`, `sonic`, `librarian`, `security-reviewer`.

## Classifier commands (`doctor`, `status`, `validate`, `next`)

Read-only over stdin JSON. They never call Linear, mutate state, or write files.

```bash
guava-os doctor
cat issues.json | guava-os status
cat issues.json | guava-os validate
cat issues.json | guava-os next --domain backend
```

### `status`

Groups executable work by domain. Categories: EXECUTABLE (Todo, one domain label + `ready-for-work`,
active parent), NOT_PROMOTED (Backlog), BLOCKED (unresolved `blocks`), INVALID
(protocol violations), PARENTS (container health). Exit 0 if any executable
work exists.

### `validate`

Violation codes:

- `V302` orphan_sub_issue (warning)
- `V303` parent_not_active (error)
- `V304` empty_parent (warning)
- `V305` subtask_overflow (error)
- `V306` container_domain_label (warning)
- `V307` external_blocker_gap (warning)
- `V400` missing_domain_label (error)
- `V402` unknown_label (warning)
- `V403` multiple_domain_labels (warning)
- `V404` readiness_label_count (error)
- `V405` missing_description_sections (error)
- `V500` queue_overflow (warning)
Exit 0 if no errors; `--strict` makes warnings fail too.

### `next`

One operator-ready directive per domain (highest-priority executable issue).
`--domain <name>` filters to a single domain. Read-only.

## Network commands

### `work`

The session gate — queries Linear and reports open work (Todo by domain, plus
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
guava-os pm search --project <name> --status Todo --label backend
guava-os pm create --title "..." --team "Guava AI" --label backend
guava-os pm link <id> --blocked-by <id>
guava-os pm move <id> --status "In Progress"
guava-os pm comment <id> --body "..."
guava-os pm archive <id>
```

Prefer `pm` for Linear; Linear MCP is a last-resort fallback.

### `sync`

Consumer convergence (config / labels / symlinks). Report-first:

```bash
guava-os sync [repo]                 # report-only — exit 0 clean / 1 drift
guava-os sync --fix [repo]           # prompt [A]ccept/[C]ancel
guava-os sync --fix --force [repo]   # apply, no prompt
guava-os sync --all                  # every active registry project
```

### `triage`

Sets the readiness label on open Todo deliverables:

```bash
guava-os triage          # this project
guava-os triage --all    # every active registry project
```

## Stdin contract (classifier commands)

A JSON array of Linear issues:

```json
[{
  "id": "GUA-10", "title": "Issue title",
  "status": "Todo", "statusType": "unstarted",
  "priority": { "value": 2, "name": "High" },
  "labels": ["backend"], "parentId": "GUA-5",
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