# Sprint 10 — Multi-User Launch

**Goal**: Auth + data isolation + tap persistence + create/delete UI + deploy.
**Started**: 2026-04-20

---

## Steps (locked order)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Supabase Auth (email/password) | done | `app/auth.tsx`, `lib/auth-context.tsx`, `lib/auth-server.ts` |
| 2 | Replace getOrCreateUser → auth session | done | All API routes + scripts use authenticated userId |
| 3 | Add user_id to goals + logs (migration) | done | Columns added, backfilled, NOT NULL |
| 4 | Enable RLS on all tables | done | 5 tables, 23 policies |
| 5 | Update all writes to include user_id | done | All INSERTs verified |
| 6 | Scope all queries by user_id | done | All SELECTs filter by userId |
| 7 | Wire tap → POST /api/quick-log + refetch | done | onIncrement → quick-log → refresh, rollback on failure |
| 8 | Build minimal create routine form | done | `components/now/create-goal-form.tsx` |
| 9 | Add delete routine action | done | Long-press → confirm → DELETE |
| 10 | Lightweight dashboard | done | Summary cards with live data, no charts |
| 11 | Strip dead code | done | 11 files deleted |
| 12 | Deploy to Vercel | pending | Env vars needed in Vercel dashboard |
| 13 | Multi-user smoke test | pending | 2 accounts, data isolation test |

## Pre-Deploy Checklist

- [x] Auth works (login/signup)
- [x] No route without auth
- [x] No table without RLS
- [x] No write without user_id
- [x] Tap persists + reflects
- [x] No mock data
- [x] No local-only state
- [x] Tests pass (12/12)
- [x] Build compiles
- [ ] Deploy to Vercel
- [ ] Multi-user smoke test
- [ ] Enable email confirmation (before real users)

## Previous Sprint

Sprint 9 (Home Screen Layout Lock) completed: DailyCard/WeeklyCard templates, layout system, responsive breakpoints, canvas viz, chat system, mutation scripts, live data wiring.
