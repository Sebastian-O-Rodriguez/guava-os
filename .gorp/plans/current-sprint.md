# Sprint 8 — UI Polish + Features

**Goal**: Fix critical UI bugs, add light/dark mode, improve interactions, and apply Tamagui best practices.

**Started**: 2026-04-01

---

## Wave 1: Critical Bug Fixes (Parallel)

- [ ] **1.1** [frontend] Fix white background on chatbar Input and arrow Buttons — unstyled Tamagui Input/Button have default white bg. Need `backgroundColor="transparent"` or proper glass tokens.
- [ ] **1.2** [frontend] Fix increment not persisting — gauges show optimistic value then revert. The `onMutate` callback triggers refetch but the refetched data may arrive before the DB write completes. Add a small delay before refetch, or update local state optimistically without refetching.
- [ ] **1.3** [frontend] Show chatbar on ALL dates (remove `isToday` guard on InlineChat)
- [ ] **1.4** [frontend] Allow future date navigation (remove the clamp in `handleDateNavigate`)

## Wave 2: Light/Dark Mode (Sequential)

- [ ] **2.1** [architect] Add light theme to `tamagui.config.ts` — full light palette with glass tokens, fill colors, text variants
- [ ] **2.2** [frontend] Add theme toggle button in nav (sun/moon icon)
- [ ] **2.3** [frontend] Wire theme state — persist in AsyncStorage, wrap app in `Theme` provider with dynamic name

## Wave 3: Tamagui Best Practices (Parallel)

- [ ] **3.1** [frontend] Replace Motion stagger with Tamagui `enterStyle` + `animation` where possible
- [ ] **3.2** [frontend] Add Zod validation to chat input and any client-side forms
- [ ] **3.3** [frontend] Create dark_Card / dark_Button sub-themes
- [ ] **3.4** [frontend] Load Geist font via expo-font
- [ ] **3.5** [frontend] Use Tamagui `Adapt` for responsive dialog/sheet patterns

## Wave 4: QA Gate (Sequential, blocks deploy)

- [ ] **4.1** [qa] `npx tsc --noEmit` — zero errors
- [ ] **4.2** [qa] `npx expo export --platform web` — clean build
- [ ] **4.3** [qa] API smoke tests: curl all 5 endpoints, verify responses
- [ ] **4.4** [qa] Tap increment: verify value persists after tap (not reverts)
- [ ] **4.5** [qa] Chat: send a message on a past date, verify response
- [ ] **4.6** [qa] Theme toggle: verify light/dark switch works
- [ ] **4.7** [qa] Date navigation: verify future dates work
- [ ] **4.8** [qa] Responsive: verify no overflow on 375px viewport
- [ ] **4.9** [qa] Deploy only after all above pass

## Execution Order

Wave 1 (parallel fixes) → Wave 2 (light/dark) → Wave 3 (polish) → Wave 4 (QA gate) → Deploy
