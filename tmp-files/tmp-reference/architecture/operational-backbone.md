# PM Lad — Operational Backbone

**Owner:** CTO Office
**Status:** Authoritative
**Last Updated:** 2026-03-05

---

## Overview

The operational backbone is PM Lad's core data flow architecture. It is **preserved from the original design** and must not be redesigned.

```
Events (append-only history)
       |
Workflows (state machines)
       |
Read Models (current operational state)
       |
UI Query Spine
       |
Dashboards
```

---

## Layer Descriptions

### Events

- Append-only `events` table in PostgreSQL
- Every state change produces an immutable event record
- Fields: `correlationId`, `eventType`, `payload` (JSON), `metadata`, `createdAt`
- 7-year retention (accounting/audit safe)
- Not event-sourced — entities remain the source of truth

### Workflows

- State machines managing entity lifecycle transitions
- Current implementation: hybrid model (mutable entities + event log)
- Invoice workflow: `draft -> pending_approval -> approved -> paid/voided`
- Idempotent operations with correlation ID propagation
- Future: Temporal orchestration (post-launch)

### Read Models

- Semantic layer derived from entities and events
- Stable field contracts (12-20 fields per model)
- UI depends on these, never raw Prisma entities
- Current models: `invoice_current`, `unit_turn_current`, `work_items`
- Deterministic derivation (same inputs = same output)

### UI Query Spine

- API layer that serves read models to the frontend
- Metrics API contract (`docs/contracts/metrics-api.md`)
- Supports aggregation, filtering, and pagination
- Read-only — no mutations through this layer

### Dashboards

- **Primary:** Role-based operational dashboards (CEO, PM, Technician)
- **Secondary:** Config-driven question templates for exploration
- **Tertiary:** Conversational interface for natural-language queries

---

## Architecture Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Event model | Hybrid audit-log | Full event sourcing is premature; entities are source of truth |
| State management | Mutable entities + event trail | Simpler, Prisma-native, audit-safe |
| Read models | Derived semantic layer | Decouples UI from implementation |
| UI strategy | Role-based operational views | Operations first, exploration second |

---

## Key Invariants

1. **Correlation everywhere** — Every operation is traceable end-to-end
2. **Zero irreversible actions** — UI cannot delete, void, or mutate critical state without workflow
3. **Idempotent workflows** — Retryable without double-execution
4. **Stable contracts** — Read model field names are stable; UI depends on them

---

## Naming Convention

| Term | Meaning |
|------|---------|
| **Resident** | Property occupant (replaces legacy "Tenant" Prisma model name) |
| **Organization** | Customer company (multi-tenancy scope) |
| `organizationId` | Tenant isolation field (replaces legacy `tenantId`) |

This convention applies across the operational backbone. All new code and documentation should use these terms.

---

## References

- Event model contract: `docs/contracts/workflow-v0-bridge.md`
- Read model contract: `docs/contracts/metrics-api.md`
- View config contract: `docs/contracts/view-config-schema.md`
- Launch roadmap: `docs/roadmap/launch-roadmap.md`

---

**CTO Office — Guava AI Ltd.**
