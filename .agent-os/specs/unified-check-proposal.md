# Unified Check Flow Proposal: `agent-os check`

## Purpose

Single command that answers: "Is this repo ready for execution?"

Equivalent to `validate` then `status`, with a unified Go/No-Go summary.

## Behavior

```bash
cat issues.json | agent-os check
```

Internally runs:
1. `validate` — detect protocol violations
2. `status` — derive executable queue

Produces a single combined output.

## Exit Semantics

| Condition | Exit Code | Rationale |
|-----------|-----------|-----------|
| Validation errors exist | 1 | Protocol violations block execution |
| No validation errors, executable work exists | 0 | Ready to operate |
| No validation errors, empty queue | 0 | Valid state, no work available |

**Key decision**: Empty queue is NOT a failure. It's a valid informational state.

## Warning Semantics

- Warnings are surfaced in output but do NOT affect exit code (default)
- `--strict` makes warnings fail (exit 1), same as `validate --strict`
- Empty queue is informational, never a warning or error

## Human Output

```
CHECK

VALIDATE
  no violations found

EXECUTABLE
  backend:        GUA-17 [P1/High] "Build action executor"
  architect:      GUA-16 [P1/High] "Define Action types"

RESULT: READY
  0 errors, 0 warnings
  2 personas with work, 3 executable total
```

When empty queue:

```
CHECK

VALIDATE
  no violations found

EXECUTABLE
  (no executable work for any persona)

RESULT: VALID (no executable work)
  0 errors, 0 warnings
  0 personas with work, 0 executable total
```

When errors:

```
CHECK

VALIDATE
  ERRORS
    V303  TST-10  parent TST-1 status "Backlog" is not active

RESULT: NOT READY
  1 error, 0 warnings
```

## JSON Structure

```json
{
  "ready": true,
  "reason": "executable work available",
  "validate": {
    "summary": { "errors": 0, "warnings": 0, "total": 0 },
    "violations": []
  },
  "status": {
    "executable": { "backend": [...], "architect": [...] },
    "summary": {
      "totalExecutable": 3,
      "totalNotPromoted": 1,
      "totalBlocked": 0,
      "totalInvalid": 0,
      "activeParentCount": 2
    }
  },
  "capabilities": { "dependencyRelationsLoaded": false }
}
```

### `ready` field logic

| Errors | Executable work | `ready` | `reason` |
|--------|-----------------|---------|----------|
| > 0 | any | `false` | `"validation errors"` |
| 0 | > 0 | `true` | `"executable work available"` |
| 0 | 0 | `false` | `"no executable work"` |

Note: `ready: false` with reason `"no executable work"` still exits 0.
`ready` is informational guidance, not the exit code determinant.

## Handling of Empty Executable Queues

- Output clearly states "(no executable work for any persona)"
- `ready` is `false` with reason explaining why
- Exit code is still 0 (no protocol failure)
- No persona is surfaced as "idle" or "blocked" — just absent

## Operator UX

```bash
# Quick check before starting work
cat issues.json | agent-os check
# Exit 0? Good to go. Read the RESULT line.

# CI gate
cat issues.json | agent-os check --strict
# Exit 1 on any violation including warnings

# Pipe to next for full workflow
cat issues.json | agent-os check && cat issues.json | agent-os next
```

## Implementation Notes

- Reuses `runValidate()` and `buildGraph()` — no new classification logic
- `formatStatusJson(graph)` provides the status portion
- `check` is a composition of existing pure functions, not a new computation
- `--strict` and `--json` flags supported, same semantics as existing commands
