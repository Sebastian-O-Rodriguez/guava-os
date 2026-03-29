# Sprint 6 — RoutineMe v2: Category Tracker + Deterministic Chat

**Goal**: Replace checkbox habits with category-based tracking (Gym, Nutrition, Running, custom). Consolidate into 2 pages. Refactor chat from freeform tool-calling to classifier + deterministic executor.

**Started**: 2026-03-28

---

## Wave 1: Schema + Data Layer
**Agent**: architect → backend

- [ ] **1.1** New Prisma models: `Category`, `Goal`, `Log` (replace Habit/Completion)
- [ ] **1.2** Migration: create new tables, drop old ones
- [ ] **1.3** Server actions: CRUD categories, upsert goals, create/query logs
- [ ] **1.4** Seed default categories (Gym, Nutrition, Running) + default goals
- [ ] **1.5** Types: `CategoryType`, `GoalConfig`, `LogData`, `NutritionEntry`, `GymEntry`, `RunEntry`

### Schema Design

```prisma
model Category {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  name      String                          // "Gym", "Nutrition", "Running", "Stretching"
  type      String   @default("custom")     // "gym" | "nutrition" | "running" | "custom"
  icon      String?                         // emoji or icon name
  color     String?                         // tailwind color token
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  goals Goal[]
  logs  Log[]

  @@index([userId, active])
  @@map("categories")
}

model Goal {
  id         String   @id @default(cuid())
  categoryId String   @map("category_id")
  metric     String                         // "leg_sessions", "calories", "miles", etc.
  target     Float                          // 1, 2500, 1.0
  period     String   @default("weekly")    // "daily" | "weekly"
  active     Boolean  @default(true)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@index([categoryId, active])
  @@map("goals")
}

model Log {
  id         String   @id @default(cuid())
  categoryId String   @map("category_id")
  date       DateTime @db.Date
  data       Json                           // type-specific payload
  createdAt  DateTime @default(now()) @map("created_at")

  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@index([categoryId, date])
  @@index([date])
  @@map("logs")
}
```

**Log `data` payloads:**
- Gym: `{ bodyPart: "chest", notes?: "bench press 185x5" }`
- Nutrition: `{ item: "200g chicken breast", calories: 330, protein: 62, fat: 7, carbs?: 0 }`
- Running: `{ miles: 1.2, duration?: "12:30", notes?: "easy pace" }`
- Custom: `{ value: 1, notes?: "done" }`

---

## Wave 2: Chat Classifier + Deterministic Executor
**Agent**: backend

- [ ] **2.1** Define scenario schemas (Zod): `log_nutrition`, `log_gym`, `log_run`, `set_goal`, `add_category`, `query_progress`
- [ ] **2.2** Classifier prompt: LLM returns `{ scenario, params }` JSON only
- [ ] **2.3** Executor map: scenario → server action (no LLM in the loop)
- [ ] **2.4** Nutrition parser: LLM extracts `[{item, calories, protein, fat, carbs?}]` from natural language
- [ ] **2.5** Update `/api/chat/route.ts`: classify → execute → respond
- [ ] **2.6** Response templates: deterministic confirmation messages per scenario

### Scenario Table

| Scenario | Example Input | Extracted Params | Server Action |
|----------|--------------|------------------|---------------|
| `log_nutrition` | "200g chicken and rice" | `[{item, cal, protein, fat}]` | `createLogs(nutritionCategoryId, entries)` |
| `log_gym` | "did chest today" | `{bodyPart, notes?}` | `createLog(gymCategoryId, gymData)` |
| `log_run` | "ran 1.5 miles in 13 min" | `{miles, duration?}` | `createLog(runCategoryId, runData)` |
| `set_goal` | "set protein to 180g daily" | `{category, metric, target, period}` | `upsertGoal(...)` |
| `add_category` | "add stretching" | `{name, type?}` | `createCategory(...)` |
| `query_progress` | "how's my week" | `{timeframe}` | Read + format summary |

---

## Wave 3: Dashboard Page (/)
**Agent**: frontend

- [ ] **3.1** New layout: single-page dashboard with category cards
- [ ] **3.2** Nutrition card: daily macro bars (cals/protein/fat vs goals), logged items list
- [ ] **3.3** Gym card: body parts done this week vs goals, session log
- [ ] **3.4** Running card: miles this week vs goal
- [ ] **3.5** Custom category cards: simple count vs goal
- [ ] **3.6** Weekly summary section: all goals progress at a glance
- [ ] **3.7** Quick-log buttons: tap to log gym/run directly (not just chat)

---

## Wave 4: Progress Page (/progress)
**Agent**: frontend

- [ ] **4.1** Refactor progress page for new data model
- [ ] **4.2** Per-category trends (weekly/monthly)
- [ ] **4.3** Nutrition charts: macro intake over time
- [ ] **4.4** Gym frequency chart: sessions per body part per week
- [ ] **4.5** Streak/consistency metrics adapted to new model

---

## Wave 5: Cleanup + QA
**Agent**: qa

- [ ] **5.1** Remove old pages: `/monthly`, `/settings` (standalone)
- [ ] **5.2** Remove old components: habit-list, monthly-grid, add-habit-dialog, day-picker, settings/*
- [ ] **5.3** Remove old actions: habits.ts, completions.ts (old)
- [ ] **5.4** Remove old types/libs: habits.ts (frequency helpers)
- [ ] **5.5** Update nav: only Dashboard + Progress + Chat
- [ ] **5.6** Type check: `tsc --noEmit`
- [ ] **5.7** Build: `next build`
- [ ] **5.8** Manual smoke test all flows
- [ ] **5.9** Deploy to Vercel

---

## Execution Order

```
Wave 1 (schema + data) → Wave 2 (chat) → Wave 3 (dashboard) → Wave 4 (progress) → Wave 5 (cleanup)
```

Waves are sequential — each depends on the previous. Within a wave, tasks are sequential except where noted.

## Acceptance Criteria

- [ ] Two pages: Dashboard (/) and Progress (/progress)
- [ ] Gym: log sessions by body part, weekly goal tracking
- [ ] Nutrition: log food via chat, daily macro tracking with goals
- [ ] Running: log miles, weekly goal tracking
- [ ] Custom categories addable via chat
- [ ] Chat classifies input → deterministic action (no freeform tool calling)
- [ ] `tsc --noEmit` clean
- [ ] `next build` clean
- [ ] Deployed to Vercel
