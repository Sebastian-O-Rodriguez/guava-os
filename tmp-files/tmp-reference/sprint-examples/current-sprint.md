# Sprint: Phase 7 — Launch Validation

**Status:** In Progress
**Phase:** 7
**Owner:** Robo
**Started:** 2026-03-10
**Execution:** Shoal orchestrated (opencode via OpenRouter)

## Goal

Build maintenance work orders + unit turn tracking, then validate the full system end-to-end. A property manager must be able to sign up, create an org, manage properties, residents, invoices, maintenance, and unit turns — all without engineering support.

## Completed Phases

Phases 1–6 + 7a are complete. See [launch roadmap](../../docs/roadmap/launch-roadmap.md).

## Wave 1 — Backend Foundation (parallel)

Schema, types, API service + controller for work orders. Architect and Backend run in parallel.

| ID   | Persona   | Task                                                                                                                                                          | Status  | Acceptance Criteria                                              |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| 7.1A | Architect | Schema migration: `WorkOrderStatus` enum, enhance `WorkItem` model (add `description`, `priority`, `dueDate`, `category`, `unitId` FK), indexes               | pending | Migration runs clean, `pnpm build` passes in `packages/db`       |
| 7.1B | Architect | Types package: `WorkOrderStatus` enum, `WorkOrderCreateSchema`, `WorkOrderResponseSchema`, `WorkOrderListResponseSchema` in `@pmlad/types`                    | pending | Types export clean, no build errors                              |
| 7.1C | Backend   | State graph: `WORKORDER_STATE_GRAPH` in workflow module (draft → scheduled → in_progress → completed/cancelled)                                               | pending | Graph defined, unit test validates transitions                   |
| 7.1D | Backend   | WorkOrder service: `create`, `schedule`, `start`, `complete`, `cancel`, `get`, `list` — mirrors InvoiceService pattern, uses WorkflowService + EventsService  | pending | All methods implemented, service spec passes (≥90% coverage)     |
| 7.1E | Backend   | WorkOrder controller: `POST /v1/orgs/:orgId/entities/:entityId/workorders`, `GET .../workorders`, `GET .../workorders/:id`, `PATCH .../workorders/:id/status` | pending | Endpoints respond correctly, controller spec passes              |
| 7.1F | Backend   | Unit turn side-effect: on work order completion where `category = 'unit_turn'`, transition `Unit.status` from `maintenance` → `vacant`                        | pending | Unit status updates on completion, test covers the flow          |
| 7.1G | Backend   | Dashboard enhancement: add `unitsInTurn` to portfolio, work order counts to inbox, richer task queue data                                                     | pending | Dashboard endpoints return new fields, existing tests still pass |

**Parallelism:** Architect (7.1A + 7.1B) and Backend (7.1C) can run simultaneously. Backend (7.1D–7.1G) depends on Architect completing schema + types.

**Execution plan:**

- **Architect session:** `feat/phase7-architect-workorder-schema` — template `pmlad-api`, tasks 7.1A + 7.1B
- **Backend session:** `feat/phase7-backend-workorder-api` — template `pmlad-api`, tasks 7.1C–7.1G (merge architect branch first for 7.1D+)

## Wave 2 — Frontend (parallel after Wave 1)

Work order UI pages + dashboard integration. Two frontend agents in parallel.

| ID   | Persona  | Task                                                                                                                                                    | Status  | Acceptance Criteria                                     |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------- |
| 7.2A | Frontend | Work Orders list page at `/maintenance` — paginated, status filter, create button. PageShell + DataTableShell.                                          | pending | Page renders, filters work, responsive                  |
| 7.2B | Frontend | Create Work Order dialog — select property → unit, title, description, priority, category (maintenance/repair/inspection/unit_turn), assignee, due date | pending | Form submits, creates work order via API                |
| 7.2C | Frontend | Work Order detail panel — SplitPane or detail page, workflow action buttons (schedule, start, complete, cancel), status badge                           | pending | Actions trigger API calls, status updates reflect       |
| 7.2D | Frontend | Task queue enhancement — click-through to work order detail, inline action buttons for technicians                                                      | pending | Technician can view + act on work orders from dashboard |
| 7.2E | Frontend | Dashboard wiring — portfolio: "units in turn" metric card. Inbox: work order counts.                                                                    | pending | New metrics visible on dashboards                       |
| 7.2F | Frontend | Navigation — add "Maintenance" to sidebar nav                                                                                                           | pending | Nav item visible, routes correctly                      |

**Parallelism:** Split into two frontend agents:

- **Frontend-A session:** `feat/phase7-frontend-workorder-pages` — template `pmlad-web`, tasks 7.2A + 7.2B + 7.2C + 7.2F
- **Frontend-B session:** `feat/phase7-frontend-dashboard-wiring` — template `pmlad-web`, tasks 7.2D + 7.2E

Both merge the backend branch before starting.

## Wave 3 — QA Validation (after Wave 2)

Automated validation of the complete system.

| ID   | Persona | Task                                                                                                | Status  | Acceptance Criteria                   |
| ---- | ------- | --------------------------------------------------------------------------------------------------- | ------- | ------------------------------------- |
| 7.3A | QA      | OpenAPI drift check: `pnpm ci:openapi-diff`                                                         | pending | 0 drift                               |
| 7.3B | QA      | Test coverage audit: run all tests with coverage                                                    | pending | ≥80% coverage, 0 P0 bugs              |
| 7.3C | QA      | Tenant isolation tests: create 2 orgs, verify no cross-org data leaks                               | pending | All isolation tests pass              |
| 7.3D | QA      | E2E user journey test: signup → org → property → unit → resident → invoice → work order → unit turn | pending | Full journey completes without errors |
| 7.3E | QA      | Build validation: `pnpm lint && pnpm test && pnpm build`                                            | pending | All clean                             |

**Execution plan:**

- **QA session:** `feat/phase7-qa-validation` — template `pmlad-fullstack`, all tasks

## Wave 4 — Performance + Production (after Wave 3)

| ID   | Persona | Task                                                                                                 | Status  | Acceptance Criteria    |
| ---- | ------- | ---------------------------------------------------------------------------------------------------- | ------- | ---------------------- |
| 7.4A | QA      | Load test staging: concurrent requests, p95 < 250ms on key endpoints                                 | pending | Performance target met |
| 7.4B | QA      | Cold start assessment: document Container Apps cold start behavior, recommend min-replicas if needed | pending | Assessment documented  |
| 7.4C | CTO     | Production smoke test: full user journey on `app.pmlad.com`                                          | pending | CTO sign-off           |

## Session Plan (for Robo)

| Session Name        | Template          | Branch                                   | Persona   | Tasks                | Wave |
| ------------------- | ----------------- | ---------------------------------------- | --------- | -------------------- | ---- |
| `phase7-architect`  | `pmlad-api`       | `feat/phase7-architect-workorder-schema` | Architect | 7.1A, 7.1B           | 1    |
| `phase7-backend`    | `pmlad-api`       | `feat/phase7-backend-workorder-api`      | Backend   | 7.1C–7.1G            | 1    |
| `phase7-frontend-a` | `pmlad-web`       | `feat/phase7-frontend-workorder-pages`   | Frontend  | 7.2A–7.2C, 7.2F      | 2    |
| `phase7-frontend-b` | `pmlad-web`       | `feat/phase7-frontend-dashboard-wiring`  | Frontend  | 7.2D, 7.2E           | 2    |
| `phase7-qa`         | `pmlad-fullstack` | `feat/phase7-qa-validation`              | QA        | 7.3A–7.3E, 7.4A–7.4B | 3+4  |

**Dependency chain:**

- Wave 1: Architect starts immediately. Backend 7.1C starts immediately. Backend 7.1D+ merges architect branch.
- Wave 2: Both frontend agents merge backend branch before starting.
- Wave 3: QA merges all frontend branches before starting.
- Wave 4: Performance after QA. Production smoke is CTO-manual.

## Notes

- Previous sprint archived to `sprints/2026-03-10-phase5-6-infra-pipeline.md`
- Phase 7a (UI Stack Revamp) completed 2026-03-10 as CTO-direct work
- **CTO pre-approved:** Schema migration (7.1A) — new `WorkOrderStatus` enum + `WorkItem` enhancements
- **Tool:** opencode via OpenRouter for all agent sessions
- **Quality gates:** `pnpm lint`, `pnpm test`, `pnpm build` must pass per agent before reporting done
