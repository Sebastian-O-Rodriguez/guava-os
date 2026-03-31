# RoutineMe

Private single-user habit tracker for Sebastian. Personal operating tool, not a startup.

## Product

Daily habit tracking with <60 second sessions. Premium dark dashboard aesthetic.
Create habits, check them off, track streaks, view monthly grids, see progress trends.

## Stack (v2 — Next.js Web App)

| Layer    | Tech                                        |
| -------- | ------------------------------------------- |
| App      | Next.js 15 (App Router) + TypeScript        |
| Deploy   | Vercel                                      |
| DB       | PostgreSQL + Prisma                         |
| UI       | Tailwind CSS + shadcn/ui                    |
| Charts   | Tremor (metrics) + Observable Plot (custom) |
| Deferred | assistant-ui (reflections/insights)         |

## Stack (v3 — Expo App)

| Layer      | Tech                                            |
| ---------- | ----------------------------------------------- |
| App        | Expo SDK 54 + Expo Router + TypeScript          |
| UI         | Tamagui (cross-platform)                        |
| Animations | Motion (web) + Reanimated (native)              |
| Gauges     | Rive (.riv state machines) + Motion springs     |
| Auth       | Supabase Auth (planned)                         |
| DB         | PostgreSQL + Prisma (same as v2)                |
| Deploy     | EAS Build (native) + EAS Hosting (web)          |

**No** microservices, separate backends, queues, event pipelines, enterprise auth, or scale infra.

## Architecture (v2 — Next.js)

- One Next.js app, server actions + route handlers
- Prisma ORM with PostgreSQL
- Single-user, no auth system (simple env-based session or cookie)
- Vercel deployment with managed Postgres (Neon/Supabase)

## Architecture (v3 — Expo)

- Expo Router file-based routing (`app/` directory in `expo-app/`)
- API routes (`app/api/*+api.ts`) replace Next.js server actions
- Tamagui for cross-platform UI components
- Rive vending machine background with metric jar gauges
- Client-side data fetching (`useEffect` + fetch to API routes)
- Single unified MetricsCard (no separate Nutrition/Fitness cards)

## Data Model

```
users        { id }
habits       { id, name, frequency, active, created_at }
completions  { id, habit_id, date, completed, note? }
daily_notes  { id, date, reflection }
```

Frequency: "daily" | "weekdays" | custom days array (e.g. ["mon","wed","fri"])

## Views (v1)

1. **Today** — today's habits, toggle completion, daily progress ring
2. **Monthly Grid** — habits as rows, days as columns, click to toggle
3. **Progress Dashboard** — streaks, weekly/monthly completion %, trend charts
4. **Settings** — habit CRUD, archive, frequency rules

## UX Rules

- 2-click max for any daily action
- Desktop-first, mobile-usable
- Dark theme, strong typography, progress rings/bars
- Motivating but minimal — not a spreadsheet

## Non-Goals

No: social, collaborative, multi-user, AI-first, sharing, notifications,
integrations, marketplace, complex gamification.

## Agent System

This repo uses Claude Code multiagent orchestration. Agents live in `.claude/agents/`.

| Agent     | Role                                                              | When                        |
| --------- | ----------------------------------------------------------------- | --------------------------- |
| robo      | Orchestrator — plans sprints, dispatches agents, collects reports | Sprint planning + execution |
| architect | Schema design, API contracts, component structure                 | Before implementation       |
| backend   | Server actions, Prisma queries, data logic                        | Implementation              |
| frontend  | React components, pages, dashboard UI                             | Implementation              |
| qa        | Testing, review, quality gates                                    | After implementation        |

### Dispatch

```bash
# Interactive orchestrator
claude --agent robo

# Headless single-task dispatch
claude -p "Implement habit CRUD server actions" --agent backend

# Parallel dispatch
./scripts/dispatch.sh sprint-1

# Isolated worktree
claude --worktree feat/monthly-grid --agent frontend
```

## Conventions

- **Commits**: `type(scope): description` — scopes: app, db, ui, infra
- **Branches**: `feat/`, `fix/`, `chore/`
- **Sprint tracking**: `.gorp/plans/current-sprint.md`
- **Roadmap**: `.gorp/plans/roadmap.md` (CTO-maintained, agents never modify)
- **Journal**: `.gorp/journal/<agent>-<date>.md`

## Quality Gates

| Gate             | How                                              |
| ---------------- | ------------------------------------------------ |
| Type check       | `tsc --noEmit`                                   |
| Lint             | `eslint . --max-warnings 0`                      |
| Format           | `prettier --check .`                             |
| Build            | `next build`                                     |
| Tests            | `vitest run`                                     |
| Expo Type check  | `cd expo-app && npx tsc --noEmit`                |
| Expo Web build   | `cd expo-app && npx expo export --platform web`  |
| Expo Dev         | `cd expo-app && npx expo start --web`            |

## Approval Matrix

| Action                                            | Who             |
| ------------------------------------------------- | --------------- |
| Write code, run tests, create branches            | Auto (agents)   |
| Task re-prioritization within sprint              | Robo            |
| Roadmap changes, new deps, schema changes, deploy | CTO (Sebastian) |
