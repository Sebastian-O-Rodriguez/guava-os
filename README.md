# RoutineMe

Full-stack TypeScript tracking system with a server-side NLP pipeline that converts natural language logs into validated action proposals and confirmed PostgreSQL mutations. Chat input and direct input converge through the same typed Action execution path.

Built with Expo SDK 54, React Native, Tamagui, and Supabase.

## Architecture

```
Client (Expo Router)
  │
  ├── Direct Input (tap/form)
  │     │
  │     └── POST /api/quick-log ──────────────────┐
  │                                                │
  └── Chat Input (natural language)                │
        │                                          │
        └── POST /api/chat                         │
              │                                    │
              ├── 1. Classify (LLM)                │
              ├── 2. Normalize                     │
              ├── 3. Estimate (LLM, nutrition)     │
              ├── 4. Propose (preview to user)     │
              ├── 5. Confirm (user accepts)        │
              │                                    │
              └──── Build Action ◄─────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  executeAction() │
              │  (intent router) │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │ Mutation Scripts │
              │ (Supabase Admin) │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │   PostgreSQL    │
              │   (RLS-backed)  │
              └─────────────────┘
```

Both input paths produce the same `Action` object and route through the same executor and mutation scripts. The chat path adds classification, normalization, estimation, and user confirmation. The quick-log path skips directly to action construction.

## NLP Pipeline

The chat pipeline runs server-side through four stages before producing an Action:

**Classifier** (`lib/chat-classifier.ts`) — Sends user message to Claude Haiku 4.5 via OpenRouter. Extracts intent and entities. Returns a scenario name, params, and confidence score (0-1). Falls back to `unknown` on failure.

**Normalizer** (`lib/chat-normalizer.ts`) — Resolves classifier output against database state. Maps categories to DB IDs, infers units, defaults periods to `daily`. Produces a `NormalizedInput` with authenticated `userId`.

**Estimator** (`lib/chat-estimator.ts`) — Runs only for nutrition intents. Sends extracted food item names to a separate LLM call with a nutrition-specific prompt. Returns estimated macros (calories, protein, fat, carbs) per item. Unknown foods are flagged with `unknown: true` and zeroed values.

**Action Builder** (`lib/chat-executor.ts`) — Constructs a typed `Action` from normalized input and optional estimates. Generates a human-readable preview for user confirmation. No database writes occur at this stage.

The classifier and estimator are the only LLM-dependent steps. OpenRouter is used solely for intent classification and macro estimation — no generation, summarization, or conversational AI.

### 9 Intent Scenarios

| Intent | Description |
|--------|-------------|
| `log_nutrition` | Food/drink consumption with macro estimation |
| `log_gym` | Gym session with optional body part |
| `log_run` | Running with distance in miles |
| `mark_habit` | Binary habit completion for today |
| `increment_goal` | Numeric progress toward a goal |
| `set_goal` | Create or update a tracking target |
| `add_category` | Create a new tracking category |
| `query_progress` | Read-only progress summary |
| `unknown` | Unrecognized input |

## Action System

Every mutation flows through a typed Action lifecycle defined in `lib/actions/types.ts`.

### Action Type

```typescript
{
  id: string;                    // UUID
  intent: ActionIntent;          // Discriminated union key
  userId: string;                // Server-derived, never from client
  categoryId: string | null;     // Resolved DB reference
  categoryName: string | null;
  payload: ActionPayload;        // Zod discriminated union by intent
  status: ActionStatus;          // proposed → confirmed → executed | cancelled | error
  confidence: number;            // 0-1 from classifier (1.0 for direct input)
  createdAt: string;             // ISO timestamp
  mutation: string | null;       // MutationType after execution
}
```

`ActionPayload` is a Zod discriminated union keyed on `intent`. Each variant carries only the fields relevant to its intent (e.g., `LogNutritionPayload` includes `entries[]`, `LogRunPayload` includes `miles`).

### Action Lifecycle

```
proposed → confirmed → executed
                    ↘ cancelled
         → error
```

- **proposed** — Action built, preview shown to user (chat flow)
- **confirmed** — User accepted the proposal
- **executed** — Mutation script completed, DB write confirmed
- **cancelled** — User rejected the proposal
- **error** — Validation or execution failure

### Executor

`executeAction()` in `lib/actions/executor.ts` validates the Action schema, routes by intent to the correct mutation script, and returns an `ActionResult`:

```typescript
{
  actionId: string;
  success: boolean;
  message: string;         // Human-readable result
  status: string;          // executed | info | error | clarify
  mutation: string | null; // Which MutationType occurred
  data?: unknown;          // Script-specific result data
  timestamp: number;
}
```

### Mutation Scripts

| Script | Mutation Type | Operation |
|--------|--------------|-----------|
| `log-nutrition.ts` | `nutrition_logged` | Insert food entries, return daily totals |
| `log-gym.ts` | `gym_logged` | Log gym session, count weekly sessions |
| `log-run.ts` | `run_logged` | Log run with miles, compare to weekly goal |
| `mark-habit.ts` | `habit_marked` | Mark habit complete, calculate streak |
| `increment-goal.ts` | `goal_incremented` | Add numeric progress, compute daily total |
| `set-goal.ts` | `goal_created` / `goal_updated` | Upsert goal by metric |
| `add-category.ts` | `category_created` | Create tracking category |

All scripts live in `lib/scripts/mutations/` and return a `ScriptResult` that the executor maps to `ActionResult`.

## API Surface

| Method | Route | Auth | Rate Limit | Purpose |
|--------|-------|------|------------|---------|
| GET | `/api/health` | No | — | Health check |
| GET | `/api/categories` | Yes | — | List user categories |
| POST | `/api/categories` | Yes | — | Create category |
| PATCH | `/api/categories` | Yes | — | Update category |
| DELETE | `/api/categories` | Yes | — | Delete category |
| GET | `/api/goals` | Yes | — | List goals (optionally by category) |
| POST | `/api/goals` | Yes | — | Upsert goal |
| DELETE | `/api/goals` | Yes | — | Delete goal |
| GET | `/api/logs` | Yes | — | Query logs (daily, range, summaries, progress) |
| POST | `/api/logs` | Yes | — | Insert log entries |
| POST | `/api/quick-log` | Yes | 60/min | Direct action dispatch |
| POST | `/api/chat` | Yes | 20/min | NLP pipeline with proposal/confirmation |

All data endpoints require a valid Supabase JWT in the `Authorization: Bearer` header.

## Security Model

**Server-derived identity.** User ID is extracted from the Supabase JWT on every request via `requireAuth()`. The client-sent `userId` is never trusted — the chat API explicitly overrides it with the server-derived value.

**Row Level Security.** RLS is enabled on all 5 data tables. Every policy scopes access to `user_id = auth.uid()::text`. Policies cover SELECT, INSERT, UPDATE, and DELETE operations per table.

**Fail-closed service role.** The `SUPABASE_SERVICE_ROLE_KEY` is required for all server-side database operations. If the key is missing, the server throws immediately — no fallback to the anon key.

**Ownership verification.** Every PATCH and DELETE operation verifies ownership by including `user_id` in the query filter before mutating. Cross-user access returns 404, not 403 (no information leakage about resource existence).

**Rate limiting.** In-memory sliding window rate limiter on expensive endpoints:
- `/api/chat` — 20 requests/min per IP (LLM cost protection)
- `/api/quick-log` — 60 requests/min per IP

**Mutation scoping.** All mutation scripts receive the authenticated `userId` and scope writes accordingly. The executor validates the Action schema before routing.

## Database Model

5 tables in PostgreSQL via Supabase, managed with Prisma migrations (6 migrations).

```
users
  id            TEXT (PK, matches Supabase auth.uid())
  created_at    TIMESTAMP
  updated_at    TIMESTAMP

categories
  id            TEXT (PK)
  user_id       TEXT (FK → users, indexed)
  name          TEXT
  type          TEXT
  icon          TEXT
  color         TEXT
  active        BOOLEAN
  created_at    TIMESTAMP
  updated_at    TIMESTAMP

goals
  id            TEXT (PK)
  user_id       TEXT (indexed, denormalized for RLS)
  category_id   TEXT (FK → categories)
  metric        TEXT
  unit          TEXT
  target        FLOAT
  period        TEXT (daily | weekly)
  active        BOOLEAN
  created_at    TIMESTAMP
  updated_at    TIMESTAMP

logs
  id            TEXT (PK)
  user_id       TEXT (indexed with date)
  category_id   TEXT (FK → categories)
  date          DATE
  data          JSONB
  created_at    TIMESTAMP

daily_notes
  id            TEXT (PK)
  user_id       TEXT (UNIQUE with date)
  date          DATE
  reflection    TEXT
  created_at    TIMESTAMP
  updated_at    TIMESTAMP
```

`logs.data` is a polymorphic JSONB column. Structure varies by category type:
- **Nutrition**: `{ item, calories, protein, fat, carbs }`
- **Gym**: `{ bodyPart, notes? }`
- **Running**: `{ miles, duration?, notes? }`
- **Custom**: `{ value, notes? }`

Schema validation happens in application code via Zod, not database constraints.

`goals.user_id` is denormalized from the category relationship specifically to support RLS policies without joins.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Expo SDK 54 / Expo Router | 54.0.x / 6.0.x |
| UI Framework | React Native | 0.81.x |
| Component Library | Tamagui | 2.0.0-rc |
| Language | TypeScript (strict) | 5.9.x |
| Database | PostgreSQL via Supabase | — |
| Auth | Supabase Auth (email/password) | 2.101.x |
| Validation | Zod | 4.3.x |
| NLP Backend | OpenRouter (Claude Haiku 4.5) | — |
| Migrations | Prisma | 7.6.x |
| Testing | Vitest | 4.1.x |
| Animation | Motion (web) | 12.38.x |
| Deploy | EAS Hosting (web), EAS Build (native) | — |

Supabase JS client is used for all database operations. Prisma is used only for schema definition and migrations, not as a query ORM.

## Setup

### Prerequisites

- Node.js 18+
- Supabase project with Auth enabled
- OpenRouter API key

### Environment

Create a `.env` file with:

```
DATABASE_URL=postgresql://user:password@host:5432/routineme?schema=public
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENROUTER_API_KEY_V2=your-openrouter-key
```

### Install and Run

```bash
npm install
npx prisma migrate deploy    # Apply migrations
npx expo start               # Development server
```

### Web Build

```bash
npx expo export --platform web
```

## Testing

3 test suites covering security boundaries, action execution, and chat workflows:

```bash
npx vitest run
```

| Suite | Focus |
|-------|-------|
| `tests/security.test.ts` | Auth rejection, cross-user isolation, rate limiting, fail-closed verification |
| `tests/action-executor.test.ts` | Intent routing, Action schema validation, ActionResult contract |
| `tests/chat-workflows.test.ts` | Classifier → normalizer → estimator → executor pipeline |

### Quality Gates

```bash
npx tsc --noEmit              # Type check (strict mode)
npx vitest run                # Test suite
npx expo export --platform web # Build verification
```

## Deployment

Production is deployed to EAS Hosting at `https://routineme.expo.app`.

```bash
npx eas deploy --prod         # Web deployment
```

EAS Build profiles are configured for development, preview, and production native builds.

## Limitations

- **Not a health product.** No medical, dietary, or nutritional claims. Macro estimates are LLM-generated approximations, not verified nutritional data.
- **Single-instance rate limiting.** The in-memory rate limiter works for single-process deployments. Multi-instance deployments would require a shared store.
- **No email confirmation enforced.** Supabase email confirmation is currently disabled. Must be enabled before public availability.
- **Tamagui RC.** The UI layer depends on Tamagui 2.0.0 release candidate, which may have breaking changes before stable release.
- **No audit logging.** Database mutations are not written to an application-level audit trail.
- **JSONB validation is application-side.** The polymorphic `logs.data` column is validated by Zod in the API layer, not by database constraints.

## License

No license file is included. All rights reserved. Source is available for review.
