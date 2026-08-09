# Guava OS Operator Runbook

> **Authority note (2026-07).** Execution state for governed work is owned by the gorp execution engine; Linear is an input format for this classifier only.

Operational guide for running the Guava OS CLI in the Guava planning/execution loop.

**Layout & operating model** (checkouts, dev isolation, archives):
`docs/architecture/repo-layout.md`. Guava OS tooling is invoked from the
guava-os checkout — the CLI resolves `gorp/` and skills relative to it.

## Workflow Overview

```
Human/CTO defines plan in Linear
        ↓
Operator fetches Linear issue data (via MCP tools or Linear export)
        ↓
Data piped into Guava OS CLI
        ↓
CLI reports: queue state, violations, parent health
        ↓
Human/CTO decides: proceed / fix Linear / pivot
        ↓
Agents execute validated work
```

The CLI sits between Linear (source of truth) and agent execution. It is a checkpoint, not a controller.

## When to Run Each Command

### `doctor` — Run Once Per Session

Run at the start of any operator session to verify the repo is set up correctly.

```bash
.guava-os/bin/guava-os doctor
```

Run with Linear data for full label verification:

```bash
echo '{"issues": [], "labels": ["architect", "backend", "frontend", "qa"]}' | .guava-os/bin/guava-os doctor
```

**When**: Before any other command. If doctor fails, stop and fix the repo setup before proceeding.

### `status` — Run to Inspect Queue

Run to see what agents can execute right now.

```bash
cat issues.json | .guava-os/bin/guava-os status
```

**When**:
- Before dispatching agents (confirm work is available)
- After making Linear changes (confirm changes reflected in queue)
- When an agent reports "no executable work" (verify the queue state)

### `validate` — Run Before Execution

Run to detect protocol violations that would cause agents to fail or misbehave.

```bash
cat issues.json | .guava-os/bin/guava-os validate
```

**When**:
- Before any agent dispatch cycle
- After restructuring parent/sub-issue hierarchy in Linear
- After bulk label changes
- When agents report unexpected behavior

## Required Command Sequence

For a standard operator cycle:

```bash
# 1. Verify repo setup
.guava-os/bin/guava-os doctor

# 2. Fetch Linear data (caller's responsibility — see Data Input below)
# Example: save MCP list_issues output to issues.json

# 3. Check for violations
cat issues.json | .guava-os/bin/guava-os validate

# 4. If validate passes (exit 0), inspect queue
cat issues.json | .guava-os/bin/guava-os status

# 5. Decide: proceed with agents, or fix Linear first
```

Do not skip `validate`. Running `status` on a graph with errors gives misleading results — INVALID sub-issues are excluded from the queue silently.

## Data Input Contract

The CLI does not fetch Linear data. The caller must provide it.

### How to Get Linear Data

**Using guava-os tooling:**

```
guava-os pm search --project guava-os --json
```

Pipe the resulting JSON array to the CLI. Agents reach Linear only through
guava-os tooling (GOS-19) — never Claude Code or raw MCP.

**Option B: Manual export**

Copy issue data from Linear's API or export tools into a JSON file.

### Required Issue Shape

Each issue in the JSON array must have:

| Field | Type | Source | Required |
|-------|------|--------|----------|
| `id` | string | Linear issue identifier (e.g. `"GUA-10"`) | Yes |
| `title` | string | Issue title | Yes |
| `status` | string | Linear status name (e.g. `"Todo"`, `"In Progress"`) | Yes |
| `statusType` | string | Linear status type (e.g. `"unstarted"`, `"started"`, `"completed"`, `"backlog"`, `"canceled"`) | Yes |
| `priority` | object | `{ "value": 2, "name": "High" }` | Yes |
| `labels` | string[] | Array of label names (e.g. `["backend"]`) | Yes |
| `parentId` | string | Parent issue identifier, if this is a sub-issue | Only for sub-issues |
| `project` | string | Project name | Yes |
| `createdAt` | string | ISO date | Yes |
| `updatedAt` | string | ISO date | Yes |
| `completedAt` | string or null | ISO date or null | Yes |
| `canceledAt` | string or null | ISO date or null | Yes |
| `assignee` | string | Assignee name (optional) | No |

### Field Mapping from Linear MCP

The `guava-os pm search` response maps directly to the CLI input format. The `issues` array from the MCP response can be piped to the CLI without transformation.


> **Note:** Agents use `guava-os pm` commands, not Linear MCP directly (GOS-18).
### Common Mistakes

- Piping an object `{"issues": [...]}` instead of a bare array `[...]` to `status`/`validate` — the CLI expects a bare array for these commands
- Omitting `statusType` — the CLI uses this to distinguish Backlog from other statuses
- Omitting `canceledAt` — the CLI uses this to exclude canceled issues

## Exit Code Reference

| Command | Exit 0 | Exit 1 |
|---------|--------|--------|
| `doctor` | All repo checks pass | Any check fails |
| `status` | Executable work exists for at least one persona | No executable work anywhere |
| `validate` | No error-severity violations | One or more errors |
| `validate --strict` | Zero violations (errors or warnings) | Any violation at all |

## Interpreting Errors vs Warnings

### Errors — Must Fix Before Execution

| Code | What It Means | How to Fix in Linear |
|------|--------------|---------------------|
| V303 `parent_not_active` | Sub-issue is Todo but parent is Backlog/Done | Move parent to Todo or In Progress |
| V400 `missing_persona_label` | Sub-issue has no persona label — agents can't claim it | Add a persona label (architect/backend/frontend/qa) |
| V401 `multiple_persona_labels` | Sub-issue has >1 persona label — ambiguous routing | Remove extra labels, keep exactly one |

### Warnings — Review But Don't Block

| Code | What It Means | When to Fix |
|------|--------------|-------------|
| V302 `orphan_sub_issue` | Sub-issue references a parent not in the dataset | Check if parent was deleted or is in a different project |
| V304 `empty_parent` | Active parent (Todo/In Progress) has no sub-issues | Add sub-issues, or move parent to Backlog until decomposed |
| V402 `unknown_persona_label` | Sub-issue has a label the CLI doesn't recognize | Check if label is misspelled or needs to be added to config |
| V500 `queue_overflow` | More Todo sub-issues for a persona than the configured max | May be intentional for a sprint push, or reduce queue |

## What Blocks Execution

Agents should NOT be dispatched if:

- `doctor` fails (repo setup broken)
- `validate` has errors (graph integrity violations)
- `status` shows 0 executable work and you expected work to be available

## What Is Safe to Ignore

- **Warnings in validate** — review them, but they don't block execution
- **`status` exit code 1** — means no executable work, which may be correct (all work is in Backlog awaiting promotion)
- **BLOCKED category empty** — this is expected. Dependency relation data is not yet available (`dependencyRelationsLoaded: false`)
- **`doctor` label check failing** — only fails if Linear data wasn't piped in. Run with `{"issues":[], "labels":[...]}` for full check.

## What Must Be Fixed in Linear Manually

The CLI is read-only. All fixes happen in Linear:

| Problem | Fix |
|---------|-----|
| Missing persona label | Add label to the sub-issue in Linear |
| Multiple persona labels | Remove extra labels in Linear |
| Inactive parent | Change parent status to Todo or In Progress in Linear |
| Empty parent | Create sub-issues under the parent in Linear, or move parent to Backlog |
| Orphan sub-issue | Re-link to correct parent, or delete if stale |

## Go / No-Go Rules

### Go — Safe to Dispatch Agents

All of the following must be true:

1. `doctor` exits 0
2. `validate` exits 0 (no errors)
3. `status` shows expected executable work for target personas
4. Warnings in `validate` have been reviewed and are understood
5. No unexplained anomalies in parent health

### No-Go — Do Not Dispatch Agents

Any of the following:

1. `doctor` fails — repo setup is broken
2. `validate` has errors — graph integrity violations exist
3. `status` shows unexpected empty queues — work may be misconfigured
4. Unknown persona labels detected — routing is unreliable
5. Malformed input data — CLI reports parse errors
6. Parent graph corruption — orphan sub-issues or inactive parents with Todo sub-issues
7. Missing persona labels on sub-issues — agents cannot claim unlabeled work

### Recovery from No-Go

1. Read the specific violations from `validate` output
2. Fix each violation in Linear (see "What Must Be Fixed" above)
3. Re-fetch Linear data
4. Re-run `validate` — confirm errors are resolved
5. Re-run `status` — confirm queue looks correct
6. Proceed to Go

## Troubleshooting

### No stdin data

```
error: command requires issue data on stdin
```

The CLI received no input. Pipe Linear issue data:

```bash
cat issues.json | .guava-os/bin/guava-os status
```

### Empty executable queue

`status` shows all personas as `(none)`. Possible causes:

- All sub-issues are in Backlog (need Robo promotion or manual move to Todo)
- Sub-issues are Todo but parent is Backlog (V303 — validate will catch this)
- Sub-issues are missing persona labels (V400 — validate will catch this)
- All work is Done or In Progress (nothing left to claim)

### Missing persona labels

`validate` reports V400 errors. Fix: add exactly one persona label (architect, backend, frontend, or qa) to each sub-issue in Linear.

### Multiple persona labels

`validate` reports V401 errors. Fix: remove extra persona labels in Linear so each sub-issue has exactly one.

### Inactive parent

`validate` reports V303 errors. The sub-issue is Todo but its parent is Backlog or Done. Fix: move the parent to Todo or In Progress in Linear.

### Empty parent

`validate` reports V304 warnings. An active parent has no sub-issues. Fix: either create sub-issues under it, or move it to Backlog until it's decomposed.

### Unknown persona labels

`validate` reports V402 warnings. A sub-issue has a label the CLI doesn't recognize as a persona. Check: is it a misspelling? Should it be added to `.guava-os/config.json` under `labels.persona_labels`?

### Blocker detection unavailable

`status` output includes:

```
BLOCKED (dependency relations not loaded — blocker detection unavailable)
```

This is expected. The CLI cannot detect blocking relationships because Linear's `list_issues` API does not return them. Sub-issues that have blockers will appear as EXECUTABLE even if they shouldn't be. This is a known limitation — operators should manually check blocking relations in Linear for critical work.

## Pilot Checklist

For the first internal run:

```
[ ] doctor passes (exit 0)
[ ] Linear data fetched and saved to file
[ ] validate passes with no errors (exit 0)
[ ] validate warnings reviewed and understood
[ ] status shows expected executable queue by persona
[ ] queue assignments match intended sprint work
[ ] no unexplained empty queues
[ ] no unexplained INVALID items
[ ] parent health looks correct (subtask counts match expectations)
[ ] operator confirms Go decision
```
