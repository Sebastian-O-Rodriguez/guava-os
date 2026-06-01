# Status Guide

How to read and interpret `guava-os status` output.

## Sections

### EXECUTABLE

Sub-issues that agents can claim right now, grouped by persona.

```
EXECUTABLE
  architect:    GUA-16 [P1/High] "Define Action type + Zod schemas"
  backend:      GUA-27 [P0/Urgent] "Add tests for category fallback"
                GUA-17 [P1/High] "Build action executor"
  frontend:     (none)
  qa:           (none)
```

Each entry shows: issue ID, priority, title. Sorted by priority (urgent first), then oldest update, then lowest ID.

`(none)` means no executable work for that persona. This is not an error.

### NOT_PROMOTED

Sub-issues in Backlog. They have valid structure but haven't been promoted to Todo.

```
NOT_PROMOTED
  GUA-40  [backend] "Create GitHub Actions workflow"
  GUA-34  [frontend] "Build settings page layout"
```

These need manual promotion to Todo in Linear before agents can claim them.

### BLOCKED

Sub-issues that would be executable but have unresolved dependencies.

**Current state**: always empty. Dependency relation data is not available to the CLI. The output includes a notice:

```
BLOCKED (dependency relations not loaded — blocker detection unavailable)
```

This means sub-issues with real blockers appear as EXECUTABLE. Operators must manually verify dependency order in Linear.

### INVALID

Sub-issues with protocol violations. These are excluded from the executable queue.

```
INVALID
  GUA-50  missing persona label
  GUA-51  multiple persona labels: backend, frontend
```

Fix these in Linear before agents can work on them.

### PARENTS

Health summary of parent issues.

```
PARENTS
  GUA-14  Todo          2/3   subtasks  (2 Done, 1 Backlog)
  GUA-9   Todo          2/3   subtasks  (2 Done, 1 Backlog)
  GUA-6   Todo          0/3   subtasks  (3 Backlog)
         ^ WARNING: some sub-issues missing persona labels
```

Shows: parent ID, status, completion ratio, status breakdown. Warnings appear for parents with no sub-issues or sub-issues missing labels.

### SUMMARY

One-line aggregate.

```
SUMMARY: 2 executable, 15 not promoted, 0 blocked, 0 invalid, 9 active parents
```

## Understanding an Empty Queue

The most common question: "Why does status show 0 executable?"

### 0 executable is usually correct

It means none of the sub-issues pass all eligibility conditions right now. Common reasons:

**All sub-issues are in Backlog** — the most common case. Work exists but hasn't been promoted. This is the normal state before a sprint starts.

**Sub-issues are Todo but parent is Backlog** — validate would flag this as V303. The sub-issue can't be executable because its parent isn't active.

**Sub-issues are missing persona labels** — validate would flag this as V400. Agents can't route unlabeled work.

### 0 executable does NOT mean the graph is broken

If `validate` passes with 0 errors and `status` shows 0 executable, the graph is valid — there's just nothing promoted for execution. This is the expected state when all work is in Backlog.

## Real Example: RoutineMe Pilot

From the pilot run (2026-05-12):

```
EXECUTABLE
  architect:    (none)
  backend:      (none)
  frontend:     (none)
  qa:           (none)

NOT_PROMOTED
  GUA-16  [architect] "Define Action type + Zod schemas"
  GUA-17  [backend] "Build action executor"
  ... (15 total)

SUMMARY: 0 executable, 15 not promoted, 0 blocked, 0 invalid, 9 active parents
```

Interpretation: 15 valid sub-issues exist. All are in Backlog. Zero protocol violations. The graph is healthy — it just needs promotion.

## JSON Output

Use `--json` for machine-readable output.

```bash
cat issues.json | .guava-os/bin/guava-os status --json
```

The JSON includes:
- `executable` — object with persona keys, each containing an array of sub-issues
- `not_promoted` — array
- `blocked` — array (currently always empty)
- `invalid` — array
- `parents` — array of parent health objects
- `summary` — canonical counts
- `capabilities` — declares what data was available (`dependencyRelationsLoaded: false`)
