# RoutineMe Launch Roadmap

> CTO-maintained. Updated 2026-04-20.

## Phase 1 — Foundation ✓

- [x] Expo + Expo Router app working
- [x] Supabase DB (users, goals, logs, categories)
- [x] Auth system (email/password)
- [x] RLS on all tables
- [x] Core APIs (/api/logs, /api/goals, /api/chat, /api/quick-log)
- [x] Home view (live data)
- [x] Chat logging pipeline

## Phase 2 — Core Product ✓

- [x] View routines (home, live data)
- [x] Tap → persist to DB
- [x] UI sync from DB (no local state)
- [x] Create routine (form UI)
- [x] Delete routine (UI action)
- [x] Multi-user isolation (auth + RLS)

## Phase 3 — Launch ✓

- [x] Deploy to EAS Hosting (https://routineme.expo.app)
- [x] Verify OpenRouter API key (V2) in production
- [x] Fix production issues (user provisioning, DB defaults, replay attack)
- [x] Multi-user test (18 tests, 2 accounts, isolation verified)
- [ ] UI clarity pass (remove friction, no redesign)
- [ ] Validate daily usability (<60 sec flow)

**Status: LIVE — launch-ready for small cohort.**

### Pre-Public Launch TODO
1. Remove or auth-gate `/api/health`
2. Enable Supabase email confirmation

## Phase 4 — Portfolio + Usage

- [ ] Use app daily (real usage)
- [ ] Fix friction from real usage
- [ ] Record 2-min demo
- [ ] Capture screenshots
- [ ] Add to Upwork portfolio

## Phase 5 — Expansion (AFTER LAUNCH ONLY)

- [ ] Monthly grid
- [ ] Advanced dashboard (charts, trends)
- [ ] Settings expansion
- [ ] Notes / reflections
- [ ] Categories/tags improvements
- [ ] Mobile (EAS / App Store)

## Launch Definition

App is live (URL works)
User can sign up / log in
User can create a routine
User can tap to log completion
Data persists and reloads correctly
Each user sees only their data
App usable daily in <60 seconds
