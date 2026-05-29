# RoutineMe — Architecture (State Engine)

> Updated 2026-04-30. Documents current state + target state.

## Layer Model

```
┌─────────────────────────────────────────┐
│           UI Layer (Expo/React)          │
│  Tiles · Forms · Modals · Dashboard     │
├─────────────────────────────────────────┤
│         Chat Layer (Optional)           │
│  Classifier → Normalizer → Estimator   │
├─────────────────────────────────────────┤
│          Action Layer (API)             │
│  Action Schema · Executor · Scripts     │
├─────────────────────────────────────────┤
│         State Layer (Supabase)          │
│  Logs · Categories · Goals · Ledger    │
└─────────────────────────────────────────┘
```

## State Layer (DB)

**Tables (current):**
- `users` — identity only
- `categories` — { id, user_id, name, type, icon, color, active }
- `goals` — { id, user_id, category_id, metric, target, period, active }
- `logs` — { id, user_id, category_id, date, data (JSONB), created_at }
- `daily_notes` — { id, user_id, date, reflection } (exists in schema, unused)

**Indexes:** `[user_id, date]`, `[category_id, date]`, `[date]` on logs.

**RLS:** Enabled on all tables. `user_id = auth.uid()::text`.

**Current aggregation:** Query-time only. Every progress check re-sums all logs for the date range.

**Target — Daily Ledger:**
The daily ledger is NOT a new table. It's a query pattern:
```
SELECT * FROM logs WHERE user_id = $1 AND date = $2
```
Aggregated into a `DailyLedger` object by the API layer:
```typescript
type DailyLedger = {
  date: string;               // YYYY-MM-DD
  entries: LogEntry[];         // all logs for the day
  totals: {
    nutrition: NutritionDailySummary;
    gym: GymBodyPartCount[];
    running: RunningSummary;
  };
  goals: GoalProgress[];      // actual vs target per goal
};
```

Whether to cache/materialize this is a future optimization decision. Start with query-time computation (which already works).

## Action Layer (API)

**Current action flow:**

| Source | Path | Description |
|--------|------|-------------|
| Tile tap | `POST /api/quick-log` | Direct increment, no chat |
| Create form | `POST /api/goals` | Direct goal creation |
| Chat | `POST /api/chat` → propose → confirm → execute | LLM-classified, user-confirmed |
| Long-press | `DELETE /api/goals/:id` | Direct deletion |

**Target — Action Schema:**

All mutations produce an `Action` before execution:

```typescript
type Action = {
  type: "ADD" | "UPDATE" | "QUERY" | "ADVISE";
  category: string;          // category ID
  payload: Record<string, unknown>;
  source: "tap" | "form" | "chat";
  userId: string;            // always server-injected
};
```

**How sources produce actions:**
- **Tap** → `{ type: "ADD", payload: { value: 1 } }` (implicit, no modal)
- **Form/Modal** → `{ type: "ADD", payload: { item, calories, ... } }` (explicit user input)
- **Chat** → Classifier + Normalizer → same `Action` shape

**Executor:** Routes action to appropriate script. Scripts are unchanged — they already accept structured input and return `ScriptResult`.

**Key insight:** `NormalizedInput` is already ~80% of this Action type. The transition is mostly a rename + adding UPDATE support.

## UI Layer

**Current surfaces:**
- Home: tiles (tap-to-log), nutrition doughnut, chat surface
- Dashboard: summary cards, progress data
- Auth: login/signup form
- Create form: new goal creation

**Target additions:**
- **Action Modal**: Structured form for nutrition/gym/run entry. Replaces chat as primary entry method for detailed logging.
- **Edit capability**: Tap existing entry → modal pre-filled → UPDATE action
- **Daily summary widget**: Calories/macros running total, always visible on home

## Chat Layer

**Current pipeline (unchanged):**
```
Message → Classifier (LLM) → Normalizer → Estimator (nutrition only) → Proposal
```

**Target role:** Chat produces an Action, which the UI renders for confirmation. Chat never executes directly. This is already ~true today (propose → confirm → execute), but confirmation happens in chat UI rather than in a modal.

**Migration path:** When action modal exists, chat proposals route to the modal instead of inline chat confirmation.

## Key Files

| Layer | File | Role |
|-------|------|------|
| State | `prisma/schema.prisma` | Schema definition |
| State | `lib/supabase.ts` | Client + admin Supabase instances |
| Action | `app/api/quick-log+api.ts` | Tap-to-log API |
| Action | `app/api/chat+api.ts` | Chat → action pipeline |
| Action | `lib/chat-executor.ts` | Action dispatcher |
| Action | `lib/scripts/mutations/*.ts` | Deterministic write scripts |
| Action | `lib/scripts/queries/*.ts` | Read-only queries |
| Action | `lib/scripts/types.ts` | ScriptResult + MutationType |
| Chat | `lib/chat-classifier.ts` | LLM intent extraction |
| Chat | `lib/chat-normalizer.ts` | Param validation + category resolution |
| Chat | `lib/chat-estimator.ts` | Nutrition macro estimation |
| UI | `app/index.tsx` | Home screen |
| UI | `app/dashboard.tsx` | Dashboard |
| UI | `components/now/goal-tile.tsx` | Tap-to-log tiles |
| UI | `components/now/create-goal-form.tsx` | Goal creation form |
| UI | `lib/types.ts` | Shared type definitions |
