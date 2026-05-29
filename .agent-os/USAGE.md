# Agent OS CLI

Guava internal tooling for validating and inspecting Linear execution graphs.

## What It Does

- Validates repo Agent OS setup (`doctor`)
- Shows executable work queue by persona (`status`)
- Detects protocol violations in the issue graph (`validate`)

## What It Does NOT Do

- Call Linear API (the CLI has no network layer)
- Mutate Linear issues, labels, or statuses
- Write to the filesystem (except stdout)
- Execute git operations
- Deploy, build, or run product code
- Make autonomous decisions

The CLI is a **pure data processor**: JSON in via stdin, deterministic output to stdout.

## How to Run

```bash
# Via npm script
npm run agent-os -- doctor
cat issues.json | npm run agent-os -- status
cat issues.json | npm run agent-os -- validate

# Via npx (direct)
npx tsx .agent-os/src/cli.ts doctor
cat issues.json | npx tsx .agent-os/src/cli.ts status
cat issues.json | npx tsx .agent-os/src/cli.ts validate

# Via wrapper script
.agent-os/bin/agent-os doctor
cat issues.json | .agent-os/bin/agent-os status
```

## Commands

### `doctor`

Validates the repo has a correct Agent OS setup.

```bash
# Without Linear data
agent-os doctor

# With Linear data (enables label checks)
echo '{"issues": [], "labels": ["architect", "backend", "frontend", "qa"]}' | agent-os doctor
```

Checks: config file, CLAUDE.md, AGENT.md files, process docs, Linear data availability, persona labels, gitignore.

Exit: `0` if all checks pass, `1` if any fail.

### `status`

Shows the executable work queue grouped by persona.

```bash
cat issues.json | agent-os status
cat issues.json | agent-os status --json
```

Categories:
- **EXECUTABLE** — Todo sub-issues with valid persona, active parent
- **NOT_PROMOTED** — Backlog sub-issues awaiting promotion
- **BLOCKED** — Sub-issues with unresolved dependencies (requires dependency data, currently unavailable)
- **INVALID** — Sub-issues violating protocol (missing label, inactive parent, etc.)
- **PARENTS** — Parent issue health summary

Exit: `0` if executable work exists, `1` if none.

### `validate`

Detects protocol violations in the issue graph.

```bash
cat issues.json | agent-os validate
cat issues.json | agent-os validate --json
cat issues.json | agent-os validate --strict
```

Violation codes detected:
- `V302` orphan_sub_issue (warning)
- `V303` parent_not_active (error)
- `V304` empty_parent (warning)
- `V400` missing_persona_label (error)
- `V401` multiple_persona_labels (error)
- `V402` unknown_persona_label (warning)
- `V500` queue_overflow (warning)

Exit: `0` if no errors, `1` if errors. `--strict` makes warnings fail too.

## Stdin Input Contract

### For `status` and `validate`

A JSON array of Linear issues:

```json
[
  {
    "id": "GUA-10",
    "title": "Issue title",
    "status": "Todo",
    "statusType": "unstarted",
    "priority": { "value": 2, "name": "High" },
    "labels": ["backend"],
    "parentId": "GUA-5",
    "project": "RoutineMe",
    "createdAt": "2026-01-01",
    "updatedAt": "2026-01-01",
    "completedAt": null,
    "canceledAt": null
  }
]
```

Required fields: `id`, `status`, `statusType`, `priority`, `labels`, `project`, `createdAt`, `updatedAt`, `completedAt`, `canceledAt`.

Optional: `parentId` (absent = top-level/parent issue), `assignee`.

### For `doctor`

Either a bare array (same as above) or an object with issues and labels:

```json
{
  "issues": [...],
  "labels": ["architect", "backend", "frontend", "qa"]
}
```

## Exit Codes

| Command | 0 | 1 |
|---------|---|---|
| `doctor` | All checks pass | Any check fails |
| `status` | Executable work exists | No executable work |
| `validate` | No errors | Errors found |
| `validate --strict` | No violations at all | Any violation (error or warning) |

## Sample Fixtures

Pre-built test inputs in `.agent-os/fixtures/`:

```bash
cat .agent-os/fixtures/clean.json | agent-os validate     # exit 0
cat .agent-os/fixtures/warnings.json | agent-os validate   # exit 0 (warnings only)
cat .agent-os/fixtures/errors.json | agent-os validate     # exit 1 (errors)
```

## Known Limitations

- **No dependency/blocker detection** — Linear's `list_issues` API does not return blocking relations. BLOCKED category is always empty. `dependencyRelationsLoaded: false` in capabilities.
- **No stale claim detection** — requires git branch activity data not available to the CLI.
- **No agent identity context** — the CLI does not know which agent is running. Violations like V100–V102 (claim violations) require caller context.
- **No mutation authority** — the CLI cannot promote, reclaim, or transition issues. That is Robo's domain.
