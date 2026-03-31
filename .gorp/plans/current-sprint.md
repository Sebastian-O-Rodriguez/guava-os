# Sprint 7 — Expo Migration

**Goal**: Create a new Expo project alongside the existing Next.js app. Systematically migrate the entire codebase: data layer, API routes, UI components (vending machine background + unified metrics card + Tamagui). Keep .gorp/ and .claude/ resources in the original project.

**Started**: 2026-03-31
**Status**: Waves 1-4 complete. Expo app scaffolded, data layer ported, UI components built, pages wired up. Web bundles clean.

---

## Wave 1: Expo Project Scaffold (Sequential)

**Agent**: architect

- [x] **1.1** Create new Expo project in `expo-app/` directory via `npx create-expo-app`
- [x] **1.2** Install core deps: Expo Router, Tamagui, Rive, Motion, Prisma, Supabase client
- [x] **1.3** Configure `tamagui.config.ts` with zinc dark theme tokens
- [x] **1.4** Set up Expo Router file structure (`app/_layout.tsx`, tabs, API routes)
- [x] **1.5** Copy `.env` and configure for Expo (`EXPO_PUBLIC_` prefix)
- [x] **1.6** Verify `npx expo start --web` launches clean

**Acceptance**: Expo app runs on web with Tamagui dark theme, empty shell, no errors.

---

## Wave 2: Data Layer Port (Parallel with Wave 1.6)

**Agent**: backend

- [x] **2.1** Copy portable `src/lib/` files into `expo-app/lib/`
- [x] **2.2** Copy `prisma/` directory (schema, config, migrations)
- [x] **2.3** Port server actions (`src/actions/*.ts`) to Expo Router API routes (`app/api/*+api.ts`)
- [x] **2.4** Replace `revalidatePath()` calls with response-only pattern (client will refetch)
- [x] **2.5** Port `src/app/api/chat/route.ts` to `app/api/chat+api.ts`
- [x] **2.6** Create Supabase client singleton (`lib/supabase.ts`)
- [x] **2.7** Test all API routes via curl/fetch

**Acceptance**: All API routes work, return correct data, Prisma connects to Supabase PostgreSQL.

**Depends on**: Wave 1 complete

---

## Wave 3: Core UI Components (Parallel tasks)

**Agent**: frontend

- [x] **3.1** Build `VendingBackground` component (Rive, Tamagui wrapper)
- [x] **3.2** Port `LiquidGauge` to work with Tamagui (keep react-liquid-gauge for web, wrap in Tamagui View)
- [x] **3.3** Build unified `MetricsCard` with Tamagui (glass card, all jars in one row)
- [x] **3.4** Build `DayHeader` with Tamagui + Expo Router navigation
- [x] **3.5** Build `InlineChat` with Tamagui
- [x] **3.6** Build `Chat` full-page screen with Tamagui
- [x] **3.7** Build `AppNav` / Tab layout

**Acceptance**: All components render on web, match vending machine aesthetic, dark theme consistent.

**Depends on**: Wave 1 + Wave 2 (API routes needed for data)

---

## Wave 4: Pages + Navigation (Sequential)

**Agent**: frontend

- [x] **4.1** Dashboard page (`app/(tabs)/index.tsx`): VendingBackground + MetricsCard + InlineChat + DayHeader
- [x] **4.2** Progress page (`app/(tabs)/progress.tsx`): port existing progress view
- [x] **4.3** Chat page (`app/chat.tsx`): full-screen chat
- [x] **4.4** Wire tab navigation (Dashboard, Progress)
- [x] **4.5** Date navigation via URL params (web) / state (native)

**Acceptance**: All pages render, data flows from API routes to UI, navigation works.

**Depends on**: Wave 3

---

## Wave 5: Polish + QA

**Agent**: qa

**Status**: In progress. UI is built and web bundles clean. Rive jar design not yet complete.

- [ ] **5.1** Type check: `npx tsc --noEmit`
- [ ] **5.2** Web build: `npx expo export --platform web`
- [ ] **5.3** Verify vending machine background renders + animates
- [ ] **5.4** Verify all metric jars display + tap-to-increment works
- [ ] **5.5** Verify date navigation
- [ ] **5.6** Verify chat works end-to-end
- [ ] **5.7** Motion microinteractions (card stagger, tap pulse)
- [ ] **5.8** Responsive check (mobile web)

**Acceptance**: Clean build, all features work on web, visual polish matches direction.

**Depends on**: Wave 4

---

## Execution Order

```
Wave 1 (scaffold) → Wave 2 (data) + Wave 3 (UI) in parallel → Wave 4 (pages) → Wave 5 (QA)
```

## Key Constraints

- `.gorp/` and `.claude/` stay in the root project, NOT copied to `expo-app/`
- Existing Next.js app remains functional (Vercel deployment unaffected)
- `expo-app/` is the new project root for the Expo version
- Prisma schema shared (symlink or copy)
- Same Supabase PostgreSQL database
