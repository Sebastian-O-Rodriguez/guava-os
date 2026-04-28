# RoutineMe

Multi-user habit + nutrition tracker. Daily usable, portfolio-ready.

## Product

Daily habit tracking with <60 second sessions.
Create routines, tap to log, track streaks, view progress, log nutrition via chat.

## Stack (v3 — Expo App, ACTIVE)

| Layer      | Tech                                       |
| ---------- | ------------------------------------------ |
| App        | Expo SDK 54 + Expo Router + TypeScript     |
| UI         | Tamagui v5 (cross-platform)                |
| Animations | Motion (web) + canvas requestAnimationFrame |
| Auth       | Supabase Auth (email/password)             |
| DB         | PostgreSQL via Supabase                    |
| Chat AI    | OpenRouter (Claude Haiku 4.5)              |
| Deploy     | EAS Hosting (web) — EAS Build (native, deferred) |

**No** microservices, separate backends, queues, event pipelines, or scale infra.

## Architecture

- Expo Router file-based routing (root `app/` directory)
- API routes (`app/api/*+api.ts`) — server-side, require auth
- Supabase JS client (not Prisma) for all DB operations
- `supabaseAdmin` (service role key) in API routes — bypasses RLS
- Client-side `authFetch()` attaches JWT to all API calls
- Auth guard in `_layout.tsx` — unauthenticated users → `/auth`
- Chat pipeline: classify → normalize → estimate → propose → confirm → execute via scripts
- Deterministic mutation scripts in `lib/scripts/mutations/`
- Read-only query scripts in `lib/scripts/queries/`

## Data Model

```
users        { id }
categories   { id, user_id, name, type, icon?, color?, active }
goals        { id, user_id, category_id, metric, target, period, active }
logs         { id, user_id, category_id, date, data (JSONB) }
daily_notes  { id, user_id, date, reflection }
```

- All tables have `user_id` for direct ownership
- RLS enabled on all tables: `user_id = auth.uid()::text`
- Log data is typed JSON: NutritionLogData, GymLogData, RunLogData, CustomLogData

## Views

1. **Auth** (`app/auth.tsx`) — Login / signup (email + password)
2. **Home** (`app/index.tsx`) — DailyCard (tiles + doughnut) + WeeklyCard (tiles) + ChatSurface + Create form
3. **Dashboard** (`app/dashboard.tsx`) — Summary cards with live progress data
4. **Settings** — planned, not implemented
5. **Monthly Grid** — planned, not implemented

## Home Screen Layout (locked)

- Nav → Header/Date → ChatSurface → DailyCard → WeeklyCard → Add Routine button
- DailyCard: explicit tile grid (left) + nutrition doughnut (right), no flexWrap
- WeeklyCard: always rendered (stable layout), shows empty state if no weekly goals
- Tap tile → persist to DB via `/api/quick-log` → refresh from DB
- Long-press tile → delete goal (with confirmation)
- Chat → propose → confirm → execute → refresh

## Chat System

- Classifier: intent + entities only (no macro estimation) — OpenRouter Haiku
- Estimator: separate LLM call for nutrition macros
- Normalizer: canonical category lookup, period defaulting
- Executor: thin router → dispatches to deterministic scripts
- Scripts: pure, own their DB writes, return ScriptResult
- Propose → confirm → execute flow (no silent mutations)

## UX Rules

- Tap = primary action (persists immediately)
- Chat = secondary / assistive
- No mock data anywhere
- No local-only state — DB is source of truth
- Failed refresh preserves last good UI state
- Only executed mutations trigger refresh

## Non-Goals

No: social, collaborative, AI-first, sharing, notifications,
integrations, marketplace, complex gamification, voice mode.

## v1 Feature Status

| Feature | Status |
|---------|--------|
| Auth (email/password) | Working |
| View routines (home) | Working |
| Tap → persist to DB | Working |
| Create routine (form) | Working |
| Delete routine (long-press) | Working |
| Chat logging (food, gym, run) | Working |
| Chat mark habit | Working |
| Chat create goal | Working |
| Nutrition doughnut (live) | Working |
| Dashboard (summary) | Working |
| Light/dark mode | Working |
| Supabase RLS | Enabled |
| Deploy (EAS Hosting) | **Live** — https://routineme.expo.app |
| Settings page | Not implemented |
| Monthly grid | Not implemented |
| Onboarding | Not implemented |

## Agent System

This repo uses Claude Code multiagent orchestration. Agents live in `.claude/agents/`.

| Agent     | Role                                                              |
| --------- | ----------------------------------------------------------------- |
| robo      | Orchestrator — plans sprints, dispatches agents, collects reports |
| architect | Schema design, API contracts, component structure                 |
| backend   | Server actions, Supabase queries, data logic                      |
| frontend  | React components, pages, dashboard UI                             |
| qa        | Testing, review, quality gates                                    |

## Conventions

- **Commits**: `type(scope): description` — scopes: app, db, ui, infra
- **Branches**: `feat/`, `fix/`, `chore/`
- **Sprint tracking**: `.gorp/plans/current-sprint.md`

## Quality Gates

| Gate             | How                                             |
| ---------------- | ----------------------------------------------- |
| Type check       | `npx tsc --noEmit`                              |
| Tests            | `npx vitest run`                                |
| Build            | `npx expo export --platform web`                |
| Dev              | `npx expo start --web`                          |

## Launch Checklist (pre-deploy)

- [x] Auth works (login/signup)
- [x] No route without auth
- [x] No table without RLS
- [x] No write without user_id
- [x] Tap persists + reflects
- [x] No mock data
- [x] No local-only state
- [x] Tests pass (12/12)
- [x] Build compiles
- [x] Deploy to EAS Hosting (https://routineme.expo.app)
- [x] Verify OpenRouter API key (V2) works in production
- [x] Multi-user smoke test (18 tests, isolation verified, replay attack found + fixed)
- [ ] Enable email confirmation (before real users)

## Pre-Public Launch TODO

1. Remove or auth-gate `/api/health` (exposes env var names)
2. Enable Supabase email confirmation (Settings → Auth → toggle "Confirm email" ON)
