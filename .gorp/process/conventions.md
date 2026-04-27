# Conventions

## Git

- **Branches**: `feat/`, `fix/`, `chore/`, `docs/`
- **Commits**: Conventional format — `type(scope): description`
- **Scopes**: `app`, `db`, `ui`, `infra`, `docs`
- **Never push directly to main** — feature branches + PRs

## Sprint

- `.gorp/plans/roadmap.md` — CTO-maintained, agents never modify
- `.gorp/plans/current-sprint.md` — active task breakdown
- `.gorp/journal/` — one file per agent per day
- Sprint tasks must have: ID, agent, title, status, acceptance criteria

## Code (v3 — Expo)

- TypeScript strict mode
- No `any` types (except Tamagui ref workarounds)
- Expo Router file-based routing (root `app/` directory)
- API routes in `app/api/*+api.ts`
- **Supabase JS client** for all DB operations (NOT Prisma)
- `supabaseAdmin` (service role key) in API routes
- `authFetch()` from `lib/api.ts` for all client-side API calls
- **Every API route requires auth** via `requireAuth(request)`
- **Every DB write includes user_id**
- Components follow Tamagui patterns (see `.gorp/docs/tamagui-style-guide.md`)
- Light/dark theme via `lib/theme-context.tsx`
- UI tokens in `tamagui.config.ts` + `themes.ts`
- Layout constants in `lib/layout.ts` (single source of truth)
- Card templates in `components/ui/card-templates.tsx`

## Auth

- Supabase Auth with email/password
- `lib/auth-context.tsx` — client-side session provider
- `lib/auth-server.ts` — server-side JWT validation
- AuthGate in `_layout.tsx` — redirects unauthenticated users to `/auth`
- RLS enabled on all tables: `user_id = auth.uid()::text`

## Home Screen Layout (LOCKED)

- Order: Nav → Header/Date → ChatSurface → DailyCard → WeeklyCard → Add Routine
- DailyCard: explicit tile grid (left, max 3 cols) + doughnut (right), NO flexWrap
- WeeklyCard: always rendered (stable layout), CollectionCard with flexWrap
- Tap tile → persist to DB → refresh from DB (no local-only state)
- Long-press tile → delete with confirmation
- No duplicated metrics across cards
- Tiles never resize — grid grows by adding rows
- Spacing from layout system only (CARD_GAP, SECTION_GAP, CONTENT_GAP)

## Chat System

- Classifier → Normalizer → Estimator (if nutrition) → Propose → Confirm → Execute
- Scripts in `lib/scripts/mutations/` (deterministic, own DB writes)
- Queries in `lib/scripts/queries/` (read-only)
- Internal helpers in `lib/scripts/helpers.ts` (not public scripts)
- Standard return: `ScriptResult<T>` with mutation, summary, data, timestamp

## Quality

Run before every PR:

```bash
npx tsc --noEmit
npx vitest run
npx expo export --platform web
npx eas deploy --prod  # deploy to EAS Hosting
```
