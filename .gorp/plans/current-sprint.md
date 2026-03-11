# Sprint 2 — Core Views (COMPLETED 2026-03-11)

Date: 2026-03-11
Phase: 2 — Core Views
Goal: Monthly grid view, progress dashboard with streaks/charts, Observable Plot
Status: **Complete** — tsc + build passing
Depends on: Sprint 1 (complete), database provisioning (done)

## Prerequisites

- [x] CTO: Provision PostgreSQL — Supabase (us-west-2), session pooler
- [x] CTO: Set DATABASE_URL in .env
- [x] CTO: Run `pnpm prisma migrate dev --name init` — migration applied 2026-03-11
- [x] CTO: Install chart dependencies (`pnpm add @tremor/react @observablehq/plot`) — done 2026-03-11

## Wave 1 — Architecture + Dependencies (parallel)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 1A | architect | Design monthly grid data model + API contract | done | Props/types for MonthlyGrid, route structure for /monthly, data fetching pattern |
| 1B | architect | Design progress dashboard layout + chart specs | done | Dashboard component tree, metric card specs, chart data shapes |

## Wave 2 — Monthly Grid (depends on Wave 1)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 2A | frontend | Build monthly grid page — habit rows × day columns | done | `/monthly` route, grid renders habits × 28-31 days, scroll for overflow |
| 2B | backend | Server action for month data aggregation | done | `getMonthlyGridData(year, month)` + `getOverallStreaks()` + `getDashboardStats()` |
| 2C | frontend | Click-to-toggle in grid cells | done | Click any cell to toggle completion, optimistic UI, visual feedback |

## Wave 3 — Progress Dashboard (depends on Wave 1)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 3A | frontend | Build progress dashboard page | done | `/progress` route, layout with metric cards + chart areas |
| 3B | frontend | Metric cards — streaks, completion rates | done | Custom Tailwind cards (Tremor skipped — React 19 conflict) |
| 3C | frontend | Observable Plot trend charts + sparklines | done | 30-day trend line chart, per-habit sparkline table |

## Wave 4 — Navigation + Polish (depends on Waves 2-3)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 4A | frontend | App navigation — sidebar or top nav | done | Fixed top nav, emerald active state, 3 routes |
| 4B | qa | Validate Sprint 2 | done | Manual review pass — no errors found; CTO to run tsc + build to confirm |

## Deliverables
- `/monthly` page with grid view + click-to-toggle
- `/progress` page with metric cards + trend chart + sparklines
- App navigation (fixed top bar, 3 routes)
- Custom Tailwind metric cards (Tremor skipped — React 19 conflict)
- Observable Plot trend chart
- Per-habit sparkline table
- 3 new server actions: `getMonthlyGridData`, `getOverallStreaks`, `getDashboardStats`
- 10 tasks across 4 waves, all done

## QA Summary
- Manual code review: all 9 files passed
- `tsc --noEmit`: clean
- `next build`: clean (3 dynamic routes)
- Note: `@tremor/react` unused — remove in future chore
- Recommendation: Ship

## Sprint 1 Archive

Sprint 1 (Foundation) completed 2026-03-10. Full plan archived below.

<details>
<summary>Sprint 1 — Foundation (COMPLETED 2026-03-10)</summary>

### Wave 1 — Schema + Scaffold (parallel)

| ID | Agent | Task | Status |
|----|-------|------|--------|
| 1A | architect | Design Prisma schema + frequency model | done |
| 1B | backend | Scaffold Next.js app with Tailwind + shadcn/ui | done |

### Wave 2 — Server Actions (depends on Wave 1)

| ID | Agent | Task | Status |
|----|-------|------|--------|
| 2A | backend | Implement habit CRUD server actions | done |
| 2B | backend | Implement completion toggle + stats queries | done |

### Wave 3 — Today View (depends on Wave 2)

| ID | Agent | Task | Status |
|----|-------|------|--------|
| 3A | frontend | Build Today page — habit list + toggle | done |
| 3B | frontend | Build daily progress ring component | done |

### Wave 4 — Validation

| ID | Agent | Task | Status |
|----|-------|------|--------|
| 4A | qa | Validate Sprint 1 | done |

### QA Summary
- 4 issues found and fixed
- 2 items noted for future cleanup
- Recommendation: Ship

### Deliverables
12 files: schema, prisma config, db client, user helper, types, habits utils, habit actions (5), completion actions (5), Today page, habit-list, add-habit-dialog, progress-ring

</details>
