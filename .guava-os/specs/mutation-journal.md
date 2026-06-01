# Mutation Journal Spec

## Purpose

Prepares future mutation authority safely by defining the journal format.
Spec only — no storage backend, ingestion, or runtime in Phase 2A.

## Invariants

- **Append-only**: entries are never modified after creation
- **Immutable**: no update or delete operations
- **Human-readable**: entries must be inspectable without tooling
- **Machine-readable**: valid JSON, one object per line (JSONL)
- **Replay-safe**: applying the journal in order must reproduce final state

## Record Schema

```json
{
  "timestamp": "2026-05-15T14:30:00Z",
  "actor": "robo",
  "operation": "transition",
  "issue_id": "GUA-17",
  "before": { "status": "Todo" },
  "after": { "status": "In Progress" },
  "reason": "Directive claimed by backend agent",
  "correlation_id": "GUA-17-backend-2026-05-15T14:30:00Z"
}
```

## Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | string (ISO 8601) | yes | When the mutation occurred |
| `actor` | string | yes | Who/what initiated the mutation |
| `operation` | string (enum) | yes | Type of mutation performed |
| `issue_id` | string | yes | Target Linear issue |
| `before` | object | yes | State before mutation (relevant fields only) |
| `after` | object | yes | State after mutation (relevant fields only) |
| `reason` | string | yes | Human-readable justification |
| `correlation_id` | string | yes | Links to directive, execution session, or robo action |

## Operation Values

| Operation | Description |
|-----------|-------------|
| `transition` | Status change (e.g., Todo → In Progress) |
| `assign` | Assignee change |
| `label` | Label addition/removal |
| `priority` | Priority change |
| `comment` | Comment added |

## Actor Values

| Actor | Authority |
|-------|-----------|
| `human` | Direct operator action |
| `robo` | Orchestrator-mediated (human-approved) |
| `system` | Automated but pre-approved rule |

All actors require human gate in Phase 2A. No autonomous mutation.

## File Convention

```
.guava-os/journal/mutations.jsonl
```

Single append-only file. One JSON object per line.

## Correlation

The `correlation_id` field links mutations to their triggering context:

- **From directives**: `{issue_id}-{persona}-{timestamp}` (matches execution report)
- **From robo actions**: `robo-{action}-{timestamp}`
- **From human actions**: `human-{timestamp}`

This enables the audit trail: directive → execution report → mutation → Linear state.

## Explicitly Deferred

- Storage backend selection (filesystem JSONL is placeholder)
- Cryptographic signing of entries
- Tamper detection / integrity verification
- Remote persistence or replication
- Journal compaction or rotation
- Runtime ingestion by Guava OS
- Reconciliation against Linear state
- Journal replay tooling
