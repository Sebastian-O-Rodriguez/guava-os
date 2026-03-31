# RoutineMe v3: Cross-Platform Migration Plan

## Vision

Take RoutineMe from a Next.js web app to a cross-platform app (iOS, Android, web) with premium animations and App Store readiness. Single codebase.

### Visual Direction

**Vending machine aesthetic.** The dashboard background is an animated Rive vending machine (using the existing `Vending Machine by PixeledFX.riv` — 12MB, detailed). Metric jars float in front of the vending machine like items on display. All metrics live in one wide, mostly-transparent card that overlays the scene — subtle glass-like container, not a heavy opaque box.

**Key design principles:**
- Vending machine is the hero — always visible, gently animated (idle hum, lights)
- Jars are cohesive: same shape, different fill colors per metric type (emerald for nutrition, sky for fitness, etc.)
- Jars use Rive state machines: fill level driven by progress, tap to increment, idle liquid wave, overflow glow
- Single wide card holds all jars in a row — `bg-white/5 backdrop-blur-sm border-white/10` vibe
- Minimal chrome: the UI should feel like you're looking at the vending machine, not at a dashboard
- Dark ambient mood — the vending machine provides the visual interest, UI stays out of the way

---

## New Stack

| Layer | Current (v2) | Target (v3) | Why |
|-------|-------------|-------------|-----|
| Framework | Next.js 15 App Router | **Expo SDK 55 + Expo Router** | Single codebase for iOS/Android/web |
| UI System | Tailwind CSS + shadcn/ui | **Tamagui** | Cross-platform components, compile-time perf, native sheets/dialogs |
| Web Animations | CSS transitions | **Motion** (web) + **Reanimated** (native) | Spring physics, gesture interactions, stagger effects |
| Gauge Visuals | react-liquid-gauge (SVG) | **Rive** (.riv state machines) | Interactive fill animations, idle waves, tap effects, overflow states |
| Auth | None (single-user env) | **Supabase Auth** | App Store requirement, multi-device sync |
| Database | Supabase PostgreSQL + Prisma | **Supabase PostgreSQL + Prisma** (keep) | Working, portable |
| Data Access | Next.js Server Actions | **Expo Router API Routes** (server) + Supabase client (optional) | Server actions port to API routes |
| Chat/AI | OpenRouter via server action | **OpenRouter via API route** | Same pattern, new transport |
| Deploy (web) | Vercel | **EAS Hosting** (Cloudflare Workers) | Unified with native pipeline |
| Deploy (native) | N/A | **EAS Build + EAS Submit** | App Store/Play Store |
| OTA Updates | N/A | **EAS Update** | JS-only updates skip app review |

---

## Architecture: What Changes vs What Stays

### Stays (portable as-is)
- `src/lib/types.ts` -- all TypeScript types
- `src/lib/dates.ts` -- date utilities
- `src/lib/chat-classifier.ts` -- LLM intent classification
- `src/lib/chat-executor.ts` -- scenario execution
- `src/lib/chat-scenarios.ts` -- Zod schemas
- `src/lib/chat-prompt.ts` -- prompt template
- `src/lib/openrouter.ts` -- OpenRouter client
- `prisma/schema.prisma` -- data model (add auth_id column)
- All Zod validation logic in server actions

### Transforms (moderate rewrite)
- `src/actions/*.ts` -- server actions become Expo Router API routes (`+api.ts`)
- `src/lib/db.ts` -- Prisma singleton (same code, new hosting context)
- `src/lib/user.ts` -- add Supabase Auth JWT verification
- `src/app/api/chat/route.ts` -- becomes `app/api/chat+api.ts`

### Full Rewrite (UI layer)
- All `src/components/**` -- React DOM to React Native Views via Tamagui
- All `src/app/page.tsx` pages -- Expo Router file-based routes
- `globals.css` -- becomes `tamagui.config.ts` (tokens + themes)
- Navigation -- `next/navigation` to `expo-router`
- Gauge component -- react-liquid-gauge to Rive

---

## Technology Details

### 1. Expo + Expo Router

**What it gives us:** File-based routing that produces native Stack/Tab navigation on mobile and standard web routes on web. Server Functions (`"use server"`) and API Routes (`+api.ts`) for server-side logic.

**Key decisions:**
- Use Expo SDK 55 (React Native 0.83, React 19)
- Expo Router v5 for routing
- EAS Build for native binaries, EAS Hosting for web + API
- Drop `react-dom` -- Expo handles web rendering via React Native Web

**Migration note:** `revalidatePath()` has no Expo equivalent. Switch to client-side refetching (React Query or manual `router.replace()` after mutations).

### 2. Tamagui

**What it gives us:** Cross-platform styled components with compile-time optimization. Full UI kit (Button, Card, Dialog, Sheet, Input, etc.) that renders natively on iOS/Android.

**Theme setup:** Port zinc dark theme to Tamagui tokens:
```ts
const tokens = createTokens({
  color: {
    zinc50: '#fafafa', zinc100: '#f4f4f5', zinc200: '#e4e4e7',
    zinc300: '#d4d4d8', zinc400: '#a1a1aa', zinc500: '#71717a',
    zinc600: '#52525b', zinc700: '#3f3f46', zinc800: '#27272a',
    zinc900: '#18181b', zinc950: '#09090b',
    emerald400: '#34d399', emerald500: '#10b981',
    sky400: '#38bdf8', red500: '#ef4444',
  },
  // space, size, radius tokens...
})
```

**Animation driver:** `@tamagui/animations-reanimated` for native, `@tamagui/animations-css` for web (or Motion driver for premium web effects).

**Replaces:** Tailwind CSS, shadcn/ui, all `src/components/ui/` files.

### 3. Motion (Web Microinteractions)

**What it gives us:** Spring physics, gesture animations, layout transitions, stagger effects -- web only.

**Package:** `motion` (v12+), import from `motion/react`

**Key patterns for RoutineMe:**
- **Card entrance stagger** -- `variants` with `staggerChildren: 0.08`
- **Tap pulse** -- `whileTap={{ scale: 0.92 }}` on gauge containers
- **Spring fill** -- `useSpring()` for smooth gauge value transitions
- **Error shake** -- keyframe `x: [0, -8, 8, -6, 6, 0]`
- **Exit animations** -- `AnimatePresence` for page transitions

**Bundle:** ~15kb with `LazyMotion` + `domAnimation` features.

**Native equivalent:** Reanimated handles equivalent animations on iOS/Android via Tamagui's animation driver. Moti provides a Motion-like declarative API for RN if needed.

### 4. Rive (Gauge Animations)

**What it gives us:** A state-machine-driven gauge animation that replaces react-liquid-gauge. Interactive, GPU-accelerated, cross-platform from a single `.riv` file.

**Packages:**
- Web: `@rive-app/react-canvas` (WASM runtime, ~300kb one-time)
- Native: `rive-react-native` (C++ runtime, requires EAS dev build)

**State machine design for habit gauge:**
- **Inputs:** `fill` (Number 0-150), `tap` (Trigger), `isOverflow` (Boolean)
- **Layer 1 (Fill):** 1D Blend State interpolating empty-to-full based on `fill`
- **Layer 2 (Idle):** Looping wave animation on liquid surface
- **Layer 3 (Effects):** Tap ripple, celebration burst at 100%, overflow glow above 100%

**Design work required:** The `.riv` file must be created in the Rive editor (rive.app). Budget 4-8 hours for a polished custom gauge. Community remixable files can accelerate this.

**Integration code is lightweight:** ~20 lines per gauge component.

### 5. Supabase Auth

**What it gives us:** Login, session management, JWT-based identity. Required for App Store.

**Phase 1 (launch):** Email/password only via `supabase.auth.signUp()` / `signInWithPassword()`. Simplest to implement.

**Phase 2 (App Store):** Add Apple Sign-In (`expo-apple-authentication` + `signInWithIdToken()`). Required by Apple if any social login exists.

**Session storage:** AsyncStorage with `autoRefreshToken: true`. Start/stop refresh on app state changes.

**Data layer impact:** Keep Prisma. Add `auth_id UUID` column to User table. Verify JWT in API routes before running Prisma queries. Skip RLS for now (single-user).

**Migration:** `ALTER TABLE "User" ADD COLUMN "auth_id" UUID UNIQUE;` -- existing data untouched.

---

## File Structure (v3)

```
app/
  _layout.tsx              -- TamaguiProvider + AuthProvider + Tabs
  (tabs)/
    _layout.tsx            -- Tab navigator (Dashboard, Progress)
    index.tsx              -- Dashboard (was src/app/page.tsx)
    progress.tsx           -- Progress (was src/app/progress/page.tsx)
  chat.tsx                 -- Chat (modal or stack screen)
  login.tsx                -- Auth screen
  api/
    chat+api.ts            -- Chat endpoint (was src/app/api/chat/route.ts)
    logs+api.ts            -- Log mutations
    categories+api.ts      -- Category CRUD
    goals+api.ts           -- Goal mutations
    quick-log+api.ts       -- Tap increment/decrement
components/
  gauge/
    rive-gauge.tsx          -- Rive-powered gauge (replaces liquid-gauge)
  dashboard/
    nutrition-card.tsx      -- Tamagui rewrite
    fitness-card.tsx        -- Tamagui rewrite
    custom-card.tsx         -- Tamagui rewrite
    day-header.tsx          -- Tamagui rewrite
    inline-chat.tsx         -- Tamagui rewrite
  chat.tsx                  -- Tamagui rewrite
  app-nav.tsx               -- Tab bar (handled by Expo Router Tabs)
lib/                        -- PORTABLE (copy from v2)
  types.ts
  dates.ts
  db.ts
  user.ts                   -- Add JWT verification
  openrouter.ts
  chat-classifier.ts
  chat-executor.ts
  chat-scenarios.ts
  chat-prompt.ts
  seed-defaults.ts
  supabase.ts               -- NEW: Supabase client singleton
assets/
  animations/
    gauge.riv               -- Rive gauge animation file
tamagui.config.ts           -- Tokens, themes, fonts, animations
```

---

## Migration Phases

### Phase 0: Prep — COMPLETE
- [x] Set up new Expo project alongside existing code (or in new branch)
- [x] Install Expo SDK 54, Expo Router, Tamagui, Rive, Motion
- [x] Configure `tamagui.config.ts` with zinc dark theme tokens
- [ ] Set up EAS project (`eas init`)
- [ ] Apple Developer Account ($99/year) + Google Play ($25 one-time)

### Phase 1: Data Layer — COMPLETE
- [x] Copy all `src/lib/` files (portable as-is)
- [x] Port server actions to Expo Router API routes (`+api.ts`)
- [x] Replace `revalidatePath()` with client-side refetch pattern
- [ ] Add Supabase Auth (email/password) — deferred
- [ ] Add `auth_id` column to User table (Prisma migration) — deferred
- [ ] Add JWT verification to API routes — deferred
- [x] Test all API routes with Supabase auth tokens

### Phase 2: Core UI — MOSTLY COMPLETE (Rive jar design remaining)
- [x] Build Tamagui component primitives (Card, GaugeContainer, etc.)
- [ ] Create Rive gauge `.riv` file in Rive editor — not yet done
- [x] Build unified MetricsCard with liquid-gauge (Rive swap in later)
- [x] Rebuild NutritionCard with Tamagui (as part of MetricsCard)
- [x] Rebuild FitnessCard with Tamagui (as part of MetricsCard)
- [x] Rebuild DayHeader with date navigation
- [x] Rebuild Progress page
- [ ] Add Motion stagger animations on web, Reanimated on native — in progress (Wave 5)

### Phase 3: Chat + Polish (remaining)
- [x] Rebuild Chat screen with Tamagui
- [x] Rebuild InlineChat component
- [ ] Add login/auth screen — deferred (auth not implemented yet)
- [x] Add tab navigation (Dashboard, Progress)
- [ ] Dark theme polish pass — in progress
- [ ] Motion microinteractions (tap pulse, card entrance, error shake) — in progress

### Phase 4: Deploy (not started)
- [ ] EAS Build for iOS simulator testing
- [ ] EAS Build for Android emulator testing
- [ ] EAS Hosting deploy for web
- [ ] Fix platform-specific issues
- [ ] EAS Submit to TestFlight (iOS)
- [ ] EAS Submit to Play Store internal testing
- [ ] App Store listing (screenshots, description, privacy policy)

### Phase 5: Launch (not started)
- [ ] TestFlight beta → App Store review
- [ ] Play Store internal testing → Production
- [ ] DNS switch for web (or keep both Vercel + EAS Hosting)
- [ ] Upgrade Supabase to Pro ($25/mo) to prevent auto-pause

---

## Estimated Timeline

| Phase | Effort | Dependency |
|-------|--------|-----------|
| Phase 0: Prep | 1-2 days | None |
| Phase 1: Data | 2-3 days | Phase 0 |
| Phase 2: UI | 4-5 days | Phase 1 + Rive design |
| Phase 3: Polish | 2-3 days | Phase 2 |
| Phase 4: Deploy | 2-3 days | Phase 3 |
| **Total** | **~2-3 weeks** | |

The Rive gauge design is on the critical path -- it can be done in parallel with Phase 1 but must be ready for Phase 2.

---

## Costs

| Item | Cost |
|------|------|
| Apple Developer Account | $99/year |
| Google Play Developer | $25 one-time |
| Supabase Pro (recommended) | $25/month |
| EAS Build (free tier) | $0 (15 builds/month) |
| Rive Editor (free tier) | $0 |
| **Total year 1** | ~$424 |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Tamagui v2 is RC, not stable | Bugs, breaking changes | Pin version, follow changelog, fallback to v1.144 stable |
| Rive gauge design takes longer than expected | Blocks Phase 2 | Start with Motion-based CSS gauge as interim, swap Rive in later |
| Expo web SSR is experimental | SEO/performance gaps | Not needed -- RoutineMe is a private app, client rendering is fine |
| NativeWind v5 (Tailwind v4) is pre-release | Can't use Tailwind v4 on native | Using Tamagui instead, no Tailwind dependency |
| Prisma in Expo Router API routes | Untested combo | If issues, fall back to standalone Express/Hono API |

---

## What We're NOT Doing

- Multi-user / social features
- Offline-first (PowerSync) -- defer to v4
- Push notifications -- defer to v4
- Complex gamification
- React Server Components (experimental in Expo)
