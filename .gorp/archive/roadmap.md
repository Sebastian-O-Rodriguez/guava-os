# DEPRECATED

> This file is archival only.
> Execution state lives in Linear (Guava AI team, RoutineMe project).
> Do NOT derive assignments, status, sprint execution, or priorities from this file.

# RoutineMe Roadmap

> CTO-maintained. Updated 2026-04-30.
> Product direction: Stateful daily ledger + action engine + AI input layer.

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
- [x] Security hardening (rate limiting, mutation scoping, fail-closed)

**Status: LIVE at https://routineme.expo.app**

### Pre-Public Launch TODO
1. ~~Remove or auth-gate `/api/health`~~ DONE
2. Enable Supabase email confirmation

## Phase 4 — State Engine (CURRENT)

> Sprint 11. See `.gorp/plans/current-sprint.md`.

- [ ] Daily ledger API (`GET /api/ledger`)
- [ ] Formal action schema (ADD / UPDATE / QUERY / ADVISE)
- [ ] Action executor (source-agnostic, replaces chat-only path)
- [ ] Action modal (nutrition, gym, run — UI-first entry)
- [ ] Log editing (UPDATE action)
- [ ] Daily totals widget on home
- [ ] Chat proposals → modal (chat becomes parser, not executor)
- [ ] Action reliability pass

## Phase 5 — Daily Usability

- [ ] Use app daily (real usage)
- [ ] Fix friction from real usage
- [ ] Validate <60 sec daily session
- [ ] UI clarity pass

## Phase 6 — Portfolio

- [ ] Record 2-min demo
- [ ] Capture screenshots
- [ ] Add to Upwork portfolio

## Phase 7 — Expansion (AFTER DAILY USE)

- [ ] Monthly grid
- [ ] Advanced dashboard (charts, trends)
- [ ] Settings expansion
- [ ] Notes / reflections
- [ ] Categories/tags improvements
- [ ] Mobile (EAS / App Store)

## Product Definition

RoutineMe is a stateful daily tracking system — NOT a chatbot.

- Daily ledger = persistent state for each day
- Actions = structured mutations (ADD/UPDATE/QUERY/ADVISE)
- UI = primary execution surface (forms, modals, taps)
- Chat = optional input parser (produces actions, doesn't execute them)
- Session goal: <60 seconds to check state + log entries
