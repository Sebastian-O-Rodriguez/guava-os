---
name: linear
description: "Project management via guava-os tooling — the standard agent interface for Linear. Prefer pm tooling; reach for Linear MCP only as a fallback. Linear is the workflow state of record."
domain: pm
role: manager
order: 4

metadata:
  author: guava-os
  version: "0.2.0"
---

## Linear Project Management

**Rule:** agents use guava-os skills → guava-os tooling → Linear. Prefer
skills and native tools first; reach for Linear MCP only as a fallback.

Tooling is invoked from the guava-os checkout (`~/dev/guava-os`). Linear is the
workflow state of record: an issue is the unit of work, the worker's task
contract, and the handoff record (its comment thread).

All project management goes through `gos pm <subcommand>`:

```
gos pm get-project
gos pm get-sprint [parent-id]
gos pm get-issue <id>
gos pm search [--status <s>] [--label <l>] [--assignee <a>]
gos pm create --title "..." --team "Guava AI" [--project guava-os] [--parent <id>] [--label <domain>] [--label <type>] [--priority 2]
gos pm update <id> [--status "In Progress"] [--assignee me] [--priority 3]
gos pm link <id> --blocked-by <id>
gos pm unlink <id> --blocked-by <id>   # remove a dependency edge (GOS-41)
gos pm move <id> --status "Done"
gos pm assign <id> --assignee me
gos pm comment <id> --body "..."
```

### Conventions (GOS-21)

- **Native fields first**: Status, Assignee, Priority, Project, Parent, Dependencies.
- **Labels**: one **domain** label (`pm`/`qa`/`security`/`backend`/`frontend`/`devops`/`ai-ml`) selects both the skills AND the OMP agent (via the `domainAgents` map); one **type** label (`Feature`/`Bug`/`Improvement`/`Chore`/`Spike`); one **readiness** label (`untriaged`/`ready-for-work`/`needs-rescoping`). Other labels are metadata.
- **Never labels for workflow state**: no ready/review/blocked/pickup. Workflow = Status (readiness is a separate computed axis).
- **One domain + one type + one readiness label per issue.**

### Identity (GOS-38 create)

- After Linear creation the canonical identifier (`GUA-###`) is the issue's
  **sole identity**. Use it for dependencies, reports, commit subjects, and
  handoff.
- The write path rejects non-canonical refs. Never pass a plan alias (`S0`/`R1`)
  into tooling after creation.

### Branching model (ADR_001 Amendment 2)

```
production   ← protected: PR from staging + required review + required CI
    ↑
staging      ← protected: PR from dev/* + QA review + required CI
    ↑
dev/backend   dev/frontend   ...   (one per domain; workers push here)
```

- Workers push to `dev/<domain>` — never to staging/production.
- Every commit subject carries `GUA-### <outcome>` so QA can map commits to
  issues and acceptance criteria.
- Promotion is two-gated: QA review to staging, then a second review to
  production. GitHub enforces both.

### Standard workflows

#### pick work

Find executable work for a domain:

```bash
gos pm search --status Todo --label backend
```

Pick the first unblocked issue (check dependencies). Move to In Progress:

```bash
gos pm move GUA-50 --status "In Progress"
gos pm assign GUA-50 --assignee me
```

#### create issue

```bash
gos pm create \
  --title "GUA-N — <short outcome>" \
  --team "Guava AI" \
  --project guava-os \
  --parent GUA-44 \
  --label backend --label Feature \
  --priority 2 \
  --description "$(cat <<'EOF'
## Why this exists
...

## Scope
...

## Out of scope
...

## Acceptance criteria
1. ...
EOF
)"
```

The description **is** the worker's task contract and the subagent's prompt.

`pm create` / `pm update` also accept `--description -` to read the body from
stdin (the `$(cat <<'EOF' … EOF)` heredoc form above is equivalent).

#### worker result handoff (clean handoff protocol)

When a worker finishes, it records the result on the issue — this is the
authoritative handoff, not a side note:

```bash
gos pm move GUA-50 --status "In Review"
gos pm comment GUA-50 --body "$(cat <<'EOF'
## Result
- Changed: <files>
- Commit: <sha> on dev/<domain>
- Verification: <test output / grep proof>
- Acceptance: 1. ✅ 2. ✅ 3. ⚠️ (blocked on ...)
EOF
)"
```

Next session (any agent) resumes by reading `pm get-issue GUA-50` — the issue
+ comment thread is the state.

#### review issue

Read the issue, check acceptance criteria against the diff, comment:

```bash
gos pm get-issue GUA-50
gos pm comment GUA-50 --body "Acceptance verified: ..."
```

#### complete issue

Move to Done when acceptance criteria are met and merged:

```bash
gos pm move GUA-50 --status "Done"
```

#### dependencies: add, fix, and remove edges (GOS-41 / GOS-44)

- `pm link <id> --blocks/--blocked-by` creates a native `blocks` relation.
- `pm unlink <id> --blocks/--blocked-by` removes one.
- A `blocks` edge means a **hard result-dependency**. Never use it for "roughly
  before" ordering (GOS-44).

### Authentication

Set `LINEAR_API_KEY` env var (Linear Settings → API → Personal API keys).

## Consumer convergence

Outside `pm`, two commands reconcile a consumer repo to the canonical contract:

```bash
gos sync [repo]          # report drift (config/labels/symlinks)
gos sync --fix --force   # apply with no prompt
gos triage               # set readiness labels on open Todo
```

`sync` is report-first: `--fix` prompts before applying, `--fix --force`
applies without a prompt, `--all` batches every active registry project. See
`docs/architecture/sync-convergence.md`.

## Uses

- `pm create`, `pm update`, `pm link`, `pm unlink`, `pm move`, `pm assign`, `pm comment` — all Linear writes
- `pm get-issue`, `pm get-project` — issue/project reads (board-wide reads belong to `planning`)
- Issue template + branching: `docs/architecture/linear-conventions.md` (GOS-21)
