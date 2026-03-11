# Sprint 3 — Polish + Deploy

Date: 2026-03-11
Phase: 3 — Polish + Deploy
Goal: Settings view, responsive layout, dark theme polish, cleanup, Vercel deployment
Status: **In Progress** — Waves 1+3 complete, Wave 2 next
Depends on: Sprint 2 (complete)

## Wave 1 — Architecture (sequential)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 1A | architect | Design Settings view — component tree, edit/archive flows, UI states | done | Props/types for settings page, component breakdown, edit-in-place vs modal decision, re-activate archived habit flow |

## Wave 2 — Settings + Cleanup (depends on Wave 1)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 2A | frontend | Build Settings page — habit list with edit/archive/reactivate | todo | `/settings` route, lists all habits (active + archived), inline edit name/frequency, archive button, reactivate archived habits |
| 2B | frontend | Add Settings link to AppNav | todo | 4th nav item "Settings" with gear icon, active state matches other links |
| 2C | backend | Remove `@tremor/react` dependency | done | `pnpm remove @tremor/react`, no import references remain, build passes |

## Wave 3 — Responsive + Theme Polish (parallel with Wave 2)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 3A | frontend | Responsive layout — all 4 pages mobile-usable | done | Today/Settings stack vertically on mobile, Monthly grid horizontal-scrolls, Progress dashboard stacks cards, nav collapses or stays usable at 375px+ |
| 3B | frontend | Dark theme refinement — consistent spacing, typography, hover states | done | Audit all pages for inconsistent colors/spacing, polish hover/focus states, ensure emerald accent is consistent, add subtle transitions |

## Wave 4 — Quality + Deploy (depends on Waves 2-3)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 4A | qa | Full quality gate pass | todo | `tsc --noEmit` clean, `next build` clean, manual review of all routes, no console errors |
| 4B | CTO | Vercel deployment + production PostgreSQL | todo | App deployed on Vercel, production DATABASE_URL set, all routes working in production |

## Notes

- Backend CRUD already exists: `createHabit`, `updateHabit`, `archiveHabit`, `getHabits(includeArchived)` — Settings page is purely frontend
- `@tremor/react` is installed but unused (React 19 peer dep conflict) — remove in 2C
- Production PostgreSQL: already on Supabase, just needs Vercel env vars
- No new schema changes needed

## Sprint 2 Archive

Sprint 2 (Core Views) completed 2026-03-11. Full plan archived below.

<details>
<summary>Sprint 2 — Core Views (COMPLETED 2026-03-11)</summary>

### Wave 1 — Architecture + Dependencies (parallel)

| ID | Agent | Task | Status |
|----|-------|------|--------|
| 1A | architect | Design monthly grid data model + API contract | done |
| 1B | architect | Design progress dashboard layout + chart specs | done |

### Wave 2 — Monthly Grid (depends on Wave 1)

| ID | Agent | Task | Status |
|----|-------|------|--------|
| 2A | frontend | Build monthly grid page — habit rows × day columns | done |
| 2B | backend | Server action for month data aggregation | done |
| 2C | frontend | Click-to-toggle in grid cells | done |

### Wave 3 — Progress Dashboard (depends on Wave 1)

| ID | Agent | Task | Status |
|----|-------|------|--------|
| 3A | frontend | Build progress dashboard page | done |
| 3B | frontend | Metric cards — streaks, completion rates | done |
| 3C | frontend | Observable Plot trend charts + sparklines | done |

### Wave 4 — Navigation + Polish (depends on Waves 2-3)

| ID | Agent | Task | Status |
|----|-------|------|--------|
| 4A | frontend | App navigation — sidebar or top nav | done |
| 4B | qa | Validate Sprint 2 | done |

### QA Summary
- Manual code review: all 9 files passed
- `tsc --noEmit`: clean
- `next build`: clean (3 dynamic routes)
- Recommendation: Ship

</details>

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
- Recommendation: Ship

</details>
