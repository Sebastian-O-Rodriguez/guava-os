---
name: linear
description: Project management via guava-os tooling — the standard agent interface for Linear. Never use Linear MCP directly.
---

## Linear Project Management

**Rule:** agents use guava-os skills → guava-os tooling → Linear. Never `Agent → Linear MCP`.

Tooling is invoked from the guava-os checkout (`~/dev/guava-os`); see
`docs/architecture/repo-layout.md` for layout & dev-isolation rules.

All project management goes through `guava-os pm <subcommand>`:

```
guava-os pm get-project
guava-os pm get-sprint [parent-id]
guava-os pm get-issue <id>
guava-os pm search [--status <s>] [--label <l>] [--assignee <a>]
guava-os pm create --title "..." --team "Guava AI" [--project guava-os] [--parent <id>] [--label architect] [--priority 2]
guava-os pm update <id> [--status "In Progress"] [--assignee me] [--priority 3]
guava-os pm link <id> --blocked-by <id>
guava-os pm move <id> --status "Done"
guava-os pm assign <id> --assignee me
guava-os pm comment <id> --body "..."
```

### Conventions (GOS-21)

- **Native fields first**: Status, Assignee, Priority, Project, Parent, Dependencies.
- **Labels for metadata only**: architect, backend, frontend, qa, migration, adr.
- **Never labels for workflow state**: no ready/review/blocked/pickup. Workflow = Status.
- **One persona label per issue.**

### Identity (GOS-38 create)

- After Linear creation the canonical identifier (`GUA-###`) is the issue's
  **sole identity**. `pm create` / `pm get-issue` / `pm search` print it — use
  it for dependencies, reports, and handoff.
- The write path rejects non-canonical refs: `pm link <id> --blocks/--blocked-by`
  and `pm create --parent` accept only `GUA-###` identifiers or UUIDs. Never pass
  a plan alias (`S0`/`R1`) into tooling after creation.

### Standard workflows

#### pick work

Find executable work for a persona:

```bash
guava-os pm search --status Todo --label backend
```

Pick the first unblocked issue (check dependencies). Move it to In Progress:

```bash
guava-os pm move GUA-50 --status "In Progress"
guava-os pm assign GUA-50 --assignee me
```

#### create issue

```bash
guava-os pm create \
  --title "GOS-N — <short outcome>" \
  --team "Guava AI" \
  --project guava-os \
  --parent GUA-44 \
  --label backend \
  --priority 2 \
  --description "$(cat <<'EOF'
## Why this exists
...

## Scope
...

## Acceptance criteria
1. ...
EOF
)"
```

#### update issue

```bash
guava-os pm update GUA-50 --status "In Progress"
guava-os pm update GUA-50 --priority 3
```

#### review issue

Read the issue, check acceptance criteria, comment:

```bash
guava-os pm get-issue GUA-50
guava-os pm comment GUA-50 --body "Acceptance criteria verified: ..."
```

#### complete issue

Move to Done when acceptance criteria are met:

```bash
guava-os pm move GUA-50 --status "Done"
```

#### planning handoff (SprintDocument)

Build the execution input from a container parent OR a standalone chain head
(GUA-137 — shape inferred from the parent):

```bash
guava-os sprint generate --parent GUA-44 --out sprint.json   # container -> children
guava-os sprint generate --parent GUA-104 --out sprint.json  # chain head -> dependency chain
guava-os sprint approve sprint.json --by operator
```

`project.projectId` in the document is the canonical GOS registry id (not the
Linear project name; GUA-135). Standalone deliverables (no parent, persona +
Todo + unblocked) are valid executable work (GUA-111) — do not force them
into a container to satisfy tooling.

#### sprint summary

Get the sprint parent + children:

```bash
guava-os pm get-sprint GUA-44
```

#### blocked work

Find issues blocked by incomplete dependencies:

```bash
guava-os pm search --status Todo
# then check each issue's dependencies via get-issue
```

#### dependency graph

Get the sprint and inspect parent/child + blocked-by relations:

```bash
guava-os pm get-sprint GUA-44 --json
```

### Authentication

Set `LINEAR_API_KEY` env var (Linear Settings → API → Personal API keys).

## Uses

- `pm create`, `pm update`, `pm link`, `pm move`, `pm assign`, `pm comment` — all Linear writes
- `pm get-issue`, `pm get-project` — issue/project reads (board-wide reads belong to `planning`)
- Issue template: `docs/architecture/linear-conventions.md` (GOS-21)
