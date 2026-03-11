# Sprint: Phase 4 — Role Dashboards

**Status:** Complete
**Phase:** 4
**Owner:** Robo
**Started:** 2026-03-07
**Completed:** 2026-03-09

## Goal

Populate the three role-based dashboard stubs with real operational data from new summary API endpoints.

## Task Groups

### Group: Schema (Architect)
| ID | Persona | Task | Status | Acceptance Criteria |
|----|---------|------|--------|---------------------|
| 4A0 | Architect | Migrate WorkItem — add entityId FK + org scoping | done | Migration runs clean, WorkItem has entityId FK, index added |

### Group: Dashboard APIs (Backend)
| ID | Persona | Task | Status | Acceptance Criteria |
|----|---------|------|--------|---------------------|
| 4A1 | Backend | GET /v1/dashboard/portfolio — property count, occupancy %, invoice totals, backlog | done | Returns JSON with properties, occupancy, revenue, blockedInvoices, maintenanceBacklog |
| 4A2 | Backend | GET /v1/dashboard/inbox — pending invoices, open maintenance, unit turns | done | Returns JSON with pendingInvoices[], openWorkItems[], scoped to org |
| 4A3 | Backend | GET /v1/dashboard/tasks — assigned work orders with priority/due/location | done | Returns JSON with assignedItems[], filterable by status |
| 4A4 | Backend | Dashboard endpoint tests | done | >=80% coverage, all pass |

### Group: Dashboard UI (Frontend)
| ID | Persona | Task | Status | Acceptance Criteria |
|----|---------|------|--------|---------------------|
| 4B1 | Frontend | Shared dashboard components — KPI card, status badge, action list | done | Reusable, typed, Tailwind-styled |
| 4B2 | Frontend | Portfolio dashboard — wire to API, render KPI cards + tables | done | Shows occupancy, revenue, blocked invoices, backlog. Empty state handled. |
| 4B3 | Frontend | Inbox dashboard — wire to API, render action list with links | done | Shows pending invoices, open work items. Links to invoice detail. |
| 4B4 | Frontend | Tasks dashboard — wire to API, render work order queue | done | Shows assigned items, priority badges, property location. Empty state. |

### Group: Validation (QA)
| ID | Persona | Task | Status | Acceptance Criteria |
|----|---------|------|--------|---------------------|
| 4C1 | QA | Full validation — role routing, data accuracy, empty states, tenant isolation | done | All dashboards render for correct roles. No cross-org leaks. Quality gates pass. |

## Execution Order

- Wave 1 (parallel): 4A0, 4B1
- Wave 2 (after 4A0): 4A1, 4A2, 4A3
- Wave 3 (after Wave 2 + 4B1): 4A4, 4B2, 4B3, 4B4
- Wave 4 (after all): 4C1

## Sessions

| Session | Template | Persona | Branch | Tasks |
|---------|----------|---------|--------|-------|
| phase4-arch | pmlad-api | Architect | feat/sprint-phase4-architect-v2 | 4A0 |
| phase4-api | pmlad-api | Backend | feat/phase4-backend-dashboard-apis | 4A1-4A4 |
| phase4-fe | pmlad-web | Frontend | feat/phase4-frontend-dashboard-wiring | 4B2-4B4 |
| phase4-qa | pmlad-fullstack | QA | feat/phase4-qa-validation | 4C1 |

## Notes

- No new dependencies. All dashboards use existing Prisma models + Tailwind + React.
- Invoice approve/reject: dashboards link to existing workflow pages, not inline actions.
- Revenue: aggregated from Invoice.amount by workflowStatus. Direct Prisma query.
- Occupancy: derived from Unit.status counts. No new model.
- WorkItem scoping (4A0) is the critical-path blocker for Wave 2.

## Wave 1 Results (2026-03-07)

| Task | Commit | Cost | Duration |
|------|--------|------|----------|
| 4A0 | `a90d2e7` (feat/sprint-phase4-architect-v2) | ~$0.08 | 1m 19s |
| 4B1 | `f5858b0` (feat/sprint-phase4-frontend) | ~$0.61 | 4m 32s |

## Wave 2 Results (2026-03-09)

| Task | Commit | Branch |
|------|--------|--------|
| 4A1-4A4 | `e3dc657` | feat/phase4-backend-dashboard-apis |

## Wave 3 Results (2026-03-09)

| Task | Commit | Branch |
|------|--------|--------|
| 4B2-4B4 | `da572ad` | feat/phase4-frontend-dashboard-wiring |

## Wave 4 Results (2026-03-09)

| Task | Commit | Branch | Bugs Fixed |
|------|--------|--------|------------|
| 4C1 | `987177d` | feat/phase4-qa-validation | 4 (deletedAt on Entity, jest.Mock→jest.fn, env var name, auth guard mock) |

## QA Observations (Non-blocking)

1. No role-based access on dashboard endpoints — any auth'd user can query any dashboard type (org-scoped, acceptable for launch)
2. workflowStatus uses string literals instead of enum values
3. No pagination on task queue endpoint
