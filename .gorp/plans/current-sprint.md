# Sprint 1 — Foundation

Date: 2026-03-10
Phase: 1 — Foundation
Goal: Scaffold app, set up data model, implement habit CRUD, build Today view

## Wave 1 — Schema + Scaffold (parallel)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 1A | architect | Design Prisma schema + frequency model | done | schema.prisma with all 4 tables, migrations run clean |
| 1B | backend | Scaffold Next.js app with Tailwind + shadcn/ui | in-progress | `next build` passes, shadcn/ui initialized, dark theme in tailwind.config, `src/lib/db.ts` Prisma singleton created, `src/actions/` dir created, `prisma/` dir ready for schema |

## Wave 2 — Server Actions (depends on Wave 1)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 2A | backend | Implement habit CRUD server actions | pending | create, update, archive habits + tests |
| 2B | backend | Implement completion toggle + stats queries | pending | toggleCompletion, getStreaks, getDailyProgress + tests |

## Wave 3 — Today View (depends on Wave 2)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 3A | frontend | Build Today page — habit list + toggle | pending | Shows today's habits, click toggles completion, optimistic UI |
| 3B | frontend | Build daily progress ring component | pending | Circular progress showing X/Y habits done today |

## Wave 4 — Validation

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 4A | qa | Validate Sprint 1 | pending | All quality gates pass, acceptance criteria met |

## Dependencies
- Wave 2 depends on Wave 1 (need schema before actions)
- Wave 3 depends on Wave 2 (need actions before UI)
- Wave 4 depends on Wave 3 (validate everything)

## Notes
- 1A and 1B can run in parallel (scaffold doesn't need schema)
- 2A and 2B can run in parallel (independent server actions)
- 3A and 3B can run in parallel (independent components)
