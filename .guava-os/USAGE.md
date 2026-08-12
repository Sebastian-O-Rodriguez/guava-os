# Guava OS CLI

> **Authority note (2026-08).** The classifier commands (`doctor`, `status`,
> `validate`, `next`) are the read-only validation surface. Planning and
> project management use `pm`, `sprint`, and `wf` commands, which do call
> Linear and mutate state. See `.omp/skills/planning/SKILL.md` for the

## What It Does (classifier commands: `doctor`, `status`, `validate`, `next`)

- Validates repo Guava OS setup (`doctor`)
- Shows executable work queue by persona (`status`)
- Detects protocol violations in the issue graph (`validate`)

Planning and project management go through `pm`, `sprint`, and `wf` — those
commands call Linear and are covered by `.omp/skills/planning/SKILL.md`.

## What the Classifier Commands Do NOT Do

- Call Linear API (they read stdin only; `pm`/`sprint`/`wf` handle network)
- Mutate Linear issues, labels, or statuses (`pm` handles mutations)
- Write to the filesystem (except stdout)
- Execute git operations
- Deploy, build, or run product code
- Make autonomous decisions

The classifier commands are the validation surface: JSON in via stdin,
deterministic output to stdout. Planning/mutation commands (`pm`, `sprint`,
`wf`) are the active surface and do call Linear.

## How to Run

```bash
# Via npm script
npm run guava-os -- doctor
cat issues.json | npm run guava-os -- status
cat issues.json | npm run guava-os -- validate

# Via npx (direct)
npx tsx .guava-os/src/cli.ts doctor
cat issues.json | npx tsx .guava-os/src/cli.ts status
cat issues.json | npx tsx .guava-os/src/cli.ts validate

# Via wrapper script
.guava-os/bin/guava-os doctor
cat issues.json | .guava-os/bin/guava-os status
```

## Commands

### `doctor`

Validates the repo has a correct Guava OS setup.

```bash
# Without Linear data
guava-os doctor

# With Linear data (enables label checks)
echo '{"issues": [], "labels": ["architect", "backend", "frontend", "qa"]}' | guava-os doctor
```

Checks: config file, AGENTS.md, process docs, Linear data availability, persona labels, gitignore.

Exit: `0` if all checks pass, `1` if any fail.

### `status`

Shows the executable work queue grouped by persona.

```bash
cat issues.json | guava-os status
cat issues.json | guava-os status --json
```

Categories:
- **EXECUTABLE** — Todo sub-issues with valid persona, active parent
- **NOT_PROMOTED** — Backlog sub-issues awaiting promotion
- **BLOCKED** — Sub-issues with unresolved native Linear blockers (populated when dependency data is provided by caller)
- **INVALID** — Sub-issues violating protocol (missing label, inactive parent, etc.)
- **PARENTS** — Parent issue health summary

Exit: `0` if executable work exists, `1` if none.

### `validate`

Detects protocol violations in the issue graph.

```bash
cat issues.json | guava-os validate
cat issues.json | guava-os validate --json
cat issues.json | guava-os validate --strict
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
    "project": "guava-os",
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

Pre-built test inputs in `.guava-os/fixtures/`:

```bash
cat .guava-os/fixtures/clean.json | guava-os validate     # exit 0
cat .guava-os/fixtures/warnings.json | guava-os validate   # exit 0 (warnings only)
cat .guava-os/fixtures/errors.json | guava-os validate     # exit 1 (errors)
```

## Known Limitations (classifier commands only)

- The classifier commands (`doctor`, `status`, `validate`, `next`) are
  stdin-only — they do not call Linear and process data the caller provides.
  Dependency data for the BLOCKED category must come from the caller.
- **No stale claim detection** — requires git branch activity data not available to the CLI.
- **No agent identity context** — the CLI does not know which agent is running. Violations like V100–V102 (claim violations) require caller context.
- Mutations and dependency-aware planning go through `pm`, `sprint`, and `wf`
  (see `.omp/skills/planning/SKILL.md`), not the classifier commands.
