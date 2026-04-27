# RoutineMe v3: Cross-Platform Migration Plan

## Vision

Take RoutineMe from a Next.js web app to a cross-platform Expo app with multi-user auth, chat-driven logging, and premium animations.

---

## Stack (current)

| Layer | Tech |
|-------|------|
| Framework | Expo SDK 54 + Expo Router |
| UI System | Tamagui v5 |
| Animations | Motion (web) + canvas requestAnimationFrame |
| Auth | Supabase Auth (email/password) |
| Database | Supabase PostgreSQL (direct JS client, not Prisma) |
| Chat AI | OpenRouter (Claude Haiku 4.5) |
| Deploy (web) | EAS Hosting |
| Deploy (native) | EAS Build (deferred) |

---

## Migration Phases

### Phase 0: Prep — COMPLETE
- [x] Set up Expo project
- [x] Install Expo SDK 54, Expo Router, Tamagui, Motion
- [x] Configure tamagui.config.ts with dark/light themes + purple accent

### Phase 1: Data Layer — COMPLETE
- [x] Port server actions to Expo Router API routes (+api.ts)
- [x] Replace revalidatePath with client-side refetch
- [x] Supabase Auth (email/password)
- [x] user_id on all tables (users, categories, goals, logs, daily_notes)
- [x] RLS enabled on all 5 tables (23 policies)
- [x] JWT verification in API routes (requireAuth)
- [x] Client-side authFetch with JWT headers
- [x] Migrated from Prisma to Supabase JS client

### Phase 2: Core UI — COMPLETE
- [x] Tamagui component primitives (cards, tiles, shell)
- [x] GoalTile with canvas fluid fill animation
- [x] NestedDoughnut (canvas macro chart)
- [x] Home screen layout locked: DailyCard + WeeklyCard + ChatSurface
- [x] Card template system (DailyCard, CollectionCard, SummaryBreakdownCard, SingleFocusCard)
- [x] Motion stagger animations (tile entrance)
- [x] Light/dark mode toggle

### Phase 3: Chat + Mutations — COMPLETE
- [x] Chat pipeline: classify → normalize → estimate → propose → confirm → execute
- [x] Deterministic mutation scripts (7 mutations + 1 query)
- [x] Tap → DB persistence via /api/quick-log
- [x] Create routine form (name + category + period)
- [x] Delete routine (long-press + confirm)
- [x] Live data via useTileData hook
- [x] Post-mutation refresh
- [x] Suggestion chips (time-of-day + reactive)

### Phase 4: Deploy — COMPLETE
- [x] Build passes (npx expo export --platform web)
- [x] EAS Hosting deployed (https://routineme.expo.app)
- [x] Env vars set in EAS dashboard
- [ ] Verify OpenRouter API key (V2) in production
- [ ] Multi-user smoke test

### Phase 5: Native (DEFERRED)
- [ ] EAS Build for iOS simulator
- [ ] EAS Build for Android emulator
- [ ] Platform-specific fixes
- [ ] TestFlight / Play Store internal testing
- [ ] App Store submission

---

## What Was Cut (intentionally)

- Rive gauge animations → replaced with canvas-based fluid fills
- Prisma ORM → replaced with Supabase JS client
- Vending machine aesthetic → replaced with clean card-based layout
- OAuth / Magic link → email/password only
- Monthly grid view → deferred post-launch
- Settings page → deferred post-launch
- Onboarding flow → deferred
- Push notifications → deferred
- Offline-first → deferred

---

## File Structure (current)

```
app/
  _layout.tsx              — TamaguiProvider + AuthProvider + ThemeModeProvider + AuthGate
  auth.tsx                 — Login/signup page
  index.tsx                — Home (DailyCard + WeeklyCard + ChatSurface + Create form)
  dashboard.tsx            — Summary dashboard (live data)
  +not-found.tsx
  api/
    chat+api.ts            — Chat pipeline (requires auth)
    logs+api.ts            — Log CRUD + aggregates (requires auth)
    goals+api.ts           — Goal CRUD (requires auth)
    categories+api.ts      — Category CRUD (requires auth)
    quick-log+api.ts       — Tap increment (requires auth)
components/
  nav/hamburger.tsx        — Hamburger menu + theme toggle
  now/goal-tile.tsx        — GoalTile with fluid fill, tap, long-press
  now/chat-surface.tsx     — Chat UI (reply bubble + input + suggestions)
  now/reply-bubble.tsx     — Assistant reply display
  now/suggestion-row.tsx   — Suggestion chips
  now/create-goal-form.tsx — Create routine form
  ui/card-templates.tsx    — DailyCard, CollectionCard, SummaryBreakdownCard, SingleFocusCard
  ui/tile.tsx              — TileFrame, TileValue, TileDenom, TileUnit
  ui/tile-fluid-fill.tsx   — Canvas fluid wave animation
  ui/nested-doughnut.tsx   — Macro doughnut chart (canvas)
  ui/shell.tsx             — Shell + Content layout primitives
hooks/
  use-card-layout.ts       — Layout measurement hook
  use-tile-data.ts         — Live data fetching + refresh
lib/
  auth-context.tsx         — Client auth provider (session, signIn, signUp, signOut)
  auth-server.ts           — Server auth helper (requireAuth, getAuthUser)
  api.ts                   — API_BASE + authFetch
  supabase.ts              — Supabase admin + anon clients
  chat-classifier.ts       — Intent classification (LLM)
  chat-normalizer.ts       — Input normalization
  chat-estimator.ts        — Nutrition estimation (LLM)
  chat-executor.ts         — Thin router → scripts
  chat-scenarios.ts        — Zod schemas
  chat-prompt.ts           — LLM prompts
  openrouter.ts            — OpenRouter client
  suggestions.ts           — Suggestion generation
  types.ts                 — Shared types
  dates.ts                 — Date utilities
  id.ts                    — ID generation
  layout.ts                — Layout constants
  palette.ts               — Color palette
  tile-animation-driver.ts — Shared rAF loop
  theme-context.tsx        — Light/dark mode
  scripts/
    types.ts               — ScriptResult type
    helpers.ts             — Shared DB helpers
    mutations/             — log-nutrition, log-gym, log-run, mark-habit, increment-goal, set-goal, add-category
    queries/               — query-progress
tests/
  chat-workflows.test.ts   — 12 tests (normalize, propose, execute, errors)
```
