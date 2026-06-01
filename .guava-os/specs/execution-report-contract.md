# Execution Report Contract

## Purpose

Formalizes the output contract agents/builders must emit after execution sessions.
This becomes the reconciliation substrate in future phases.

## Status

Spec only. No ingestion, persistence, or reconciliation runtime implemented.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `issue_id` | string | Linear issue ID (e.g., `GUA-17`) |
| `persona` | string | Executing agent persona |
| `status` | enum | Outcome of the execution session |
| `summary` | string | Human-readable description of what was done |
| `files_changed` | string[] | Paths modified relative to repo root |
| `tests_run` | string[] | Test file paths or suite names executed |
| `blockers` | string[] | Obstacles encountered during execution |
| `recommended_transition` | string | Suggested Linear status transition |
| `correlation_id` | string | Links back to the directive that triggered this session |
| `timestamp` | string | ISO 8601 timestamp of report generation |

## Status Values

| Value | Meaning |
|-------|---------|
| `completed` | All acceptance criteria met |
| `partial` | Some work done, blockers remain |
| `blocked` | Could not proceed, no meaningful changes |
| `failed` | Execution errored or produced invalid state |
| `abandoned` | Operator cancelled the session |

## Recommended Transition Values

| Value | Meaning |
|-------|---------|
| `in_progress` | Work started but not ready for review |
| `in_review` | Ready for QA/peer review |
| `done` | All work complete, no review needed |
| `blocked` | Cannot proceed, needs human intervention |
| `none` | No transition recommended |

## Constraints

- Reports are emitted by the executing agent, not by Guava OS
- Guava OS does NOT generate, validate, or ingest reports in Phase 2A
- Reports are human-authored artifacts, not computed outputs
- The `recommended_transition` field expresses agent intent — it does not trigger mutation
- `correlation_id` links to the directive's `issue_id + persona` pair from `guava-os next`

## File Convention

Reports should be written to:

```
.guava-os/reports/{issue_id}-{persona}-{timestamp}.json
```

Example: `.guava-os/reports/GUA-17-backend-2026-05-15T14-30-00Z.json`

## Schema

See `execution-report.schema.json` for the JSON Schema definition.

## Deferred

- Report ingestion/parsing by Guava OS
- Report persistence backend
- Reconciliation runtime (comparing reports to Linear state)
- Report signing or tamper detection
- Aggregate report summaries
