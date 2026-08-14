# Guava OS Operator Runbook

> **Authority note (2026-08).** This runbook covers the classifier commands
> (`doctor`, `status`, `validate`, `next`). Planning, project management, and
> governed execution go through `pm`, `sprint`, and `wf` — see
> `.omp/skills/planning/SKILL.md` for the canonical operational loop.
Operational guide for the classifier commands and the input contract they
expect. For planning (pm/sprint) and governed execution (wf), see
`.omp/skills/planning/SKILL.md` and `.omp/skills/execution/SKILL.md`.

**Layout & operating model** (checkouts, dev isolation, archives):
`docs/architecture/repo-layout.md`. Guava OS tooling is invoked from the
guava-os checkout — the CLI resolves `gorp/` and skills relative to it.

## Classifier Data Input Contract

The classifier commands (`doctor`, `status`, `validate`, `next`) do not call
Linear — the caller provides data via stdin. The recommended pipeline:

```bash
guava-os pm search --project guava-os --json | guava-os validate
guava-os pm search --project guava-os --json | guava-os status
```

The `pm search` response maps directly to the CLI input format without
transformation.

### Required Issue Shape

Each issue in the JSON array must have:

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `title` | string | Yes |
| `status` | string | Yes |
| `statusType` | string | Yes |
| `priority` | object | Yes |
| `labels` | string[] | Yes |
| `parentId` | string | Only for sub-issues |
| `project` | string | Yes |
| `createdAt` | string | Yes |
| `updatedAt` | string | Yes |
| `completedAt` | string or null | Yes |
| `canceledAt` | string or null | Yes |
| `assignee` | string | No |

### Common Mistakes

- Piping an object `{"issues": [...]}` instead of a bare array `[...]` — the classifiers expect a bare array
- Omitting `statusType` — needed to distinguish Backlog
- Omitting `canceledAt` — needed to exclude canceled issues

See `.omp/skills/planning/SKILL.md` for `pm`, `sprint`, and `wf` commands.

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

**AGENTS.md is optional/advisory.** The `agents-md` doctor check reports as
`[advisory]` and never hard-fails a registered, executable project. AGENTS.md
carries the repo's operating context and authority hierarchy for agents; its
completeness is a bootstrap concern owned by GOS-34 ordering, not an execution
prerequisite that `doctor` blocks on. A missing AGENTS.md produces a passing,
advisory result with a detail noting it is absent.


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

For a standard classifier cycle:

```bash
# 1. Verify repo setup
.guava-os/bin/guava-os doctor

# 2. Fetch Linear data via pm and pipe to classifier
guava-os pm search --project guava-os --json > issues.json

# 3. Check for violations
cat issues.json | .guava-os/bin/guava-os validate

# 4. If validate passes (exit 0), inspect queue
cat issues.json | .guava-os/bin/guava-os status

# 5. Decide: proceed with agents, or fix Linear first
```

Do not skip `validate`. Running `status` on a graph with errors gives misleading results — INVALID sub-issues are excluded from the queue silently.

## Target-Repo Runtime Bootstrap Prerequisites (GUA-133)

Before a gated worker can execute in a target repo, the target repo's own
runtime must be bootstrapped. These were rediscovered at execution time during
the Guavabi live run (2026-08-09) and blocked gated work; classify them P1 and
pre-flight them BEFORE scheduling execution — never defer to run moment.

1. **Dependency install with an approved build-script policy.** Run
   `pnpm install` in the target repo with the repo's `verify-deps-before-run`
   step. If the target repo uses ignored/blocked `prepare`/`postinstall` build
   scripts, the install must use the documented allowlist/policy for that repo
   so `verify-deps-before-run` does not block on those scripts.
2. **Browser binaries where E2E gates exist.** If the target repo has
   Playwright tests (e.g. `@playwright/test` in `apps/web/package.json`,
   `test:e2e: playwright test`), the machine must have the Chromium binary
   installed: `npx playwright install chromium`. Missing binaries fail E2E
   gates at run time.
3. **Execution-ordering prerequisite:** per GOS-34 (bootstrap ordering), the
   canonical bootstrap order is **create minimal repo → register (with
   canonical git_remote, GOS-31) → execute/scaffold**. A target repo must be
   created and registered before any execution-facing issue is picked.
   Planning issues may precede registration, but no gorp-facing issue
   (execute/scaffold) is ready until the repo exists AND the canonical
   remote is recorded. See `.guava-os/PLAYBOOK.md#bootstrap-order` for the
   worked example.

   ```bash
   # Register a new project (creates repo + records remote + appends registry):
   guava-os register <id> --repo ~/dev/repos/<id> --remote https://github.com/<owner>/<id>.git
   # Verify:
   guava-os doctor  # git-remote check should list the new project as "ok"
   ```


Product-side blockers (e.g. Guavabi's frontend/E2E runtime, Clerk middleware
500 on all routes — tracked under GUA-75) are owned by the target-repo product
owner, not gorp/guava-os. Record target-repo-specific prerequisites in the
project's `RUNTIME_STATE.md` / notes as they are discovered.

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
- **BLOCKED category empty** — the classifier doesn't load dependency data;
  use `sprint generate` for dependency-aware execution.
- **`doctor` label check failing** — only fails if Linear data wasn't piped in. Run with `{"issues":[], "labels":[...]}` for full check.
- **`doctor` agents-md advisory** — AGENTS.md is optional/advisory; its absence (or missing authority reference) does not block execution. Bootstrap completeness is owned by GOS-34 ordering.

## Fixing Violations

Fix in Linear (or via `pm update`). The classifier commands are read-only.

| Problem | Fix |
|---------|-----|
| Missing persona label | Add label via Linear or `pm update` |
| Multiple persona labels | Remove extra labels |
| Inactive parent | Change parent status to Todo or In Progress |
| Empty parent | Create sub-issues under the parent, or move parent to Backlog |
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

The CLI received no input. Pipe Linear issue data via `pm search` or from a
saved file:

```bash
guava-os pm search --project guava-os --json | .guava-os/bin/guava-os status
# or
cat issues.json | .guava-os/bin/guava-os status
```

### Empty executable queue

`status` shows all personas as `(none)`. Possible causes:

- All sub-issues are in Backlog (need promotion via gorp or manual move to Todo)
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

`status` output may include:

```
BLOCKED (dependency relations not loaded — blocker detection unavailable)
```

The classifier does not load dependency data on its own. For dependency-aware
execution, use `sprint generate --parent <chain-head>` (chain mode) or
`sprint generate --parent <container-id>` (container mode). The BLOCKED
category is populated when the caller provides dependency relations.

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
