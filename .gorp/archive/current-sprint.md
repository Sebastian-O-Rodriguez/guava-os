# DEPRECATED

> This file is archival only.
> Execution state lives in Linear (Guava AI team, RoutineMe project).
> Do NOT derive assignments, status, sprint execution, or priorities from this file.

# Sprint 11 — State Engine Foundation

**Goal**: Action reliability + action schema + unified action modal + daily widget. No AI work.
**Planned start**: 2026-05-01
**Duration**: 5–7 days

---

## Context

RoutineMe is shifting from "chat-driven tracker" to "stateful daily ledger + action engine + AI input layer." This sprint fixes action reliability first, then builds the action schema and gives the user a UI-first way to log entries.

## Steps

| # | Task | Agent | Status | Deliverable |
|---|------|-------|--------|-------------|
| 1 | Fix action reliability + category decoupling | backend + qa | todo | Audit all action paths (chat + quick-log), ensure clear errors, no silent failures. **Decouple log creation from pre-created categories.** Categories are organization, not permission to log. Implement category fallback: match existing → fall back to generic type category (Nutrition/Running/Gym/Custom) → auto-create generic if missing. Never fail with "No category found." |
| 2 | Define Action type + validation schemas | architect | todo | `lib/actions/types.ts` — Action type, per-action Zod schemas |
| 3 | Build action executor (route Action → Script) | backend | todo | `lib/actions/executor.ts` — source-agnostic, replaces chat-executor for non-chat sources |
| 4 | Build unified Action Modal | frontend | todo | Single modal, switches fields by category type (nutrition: item/cal/protein/fat/carbs; gym: body part/notes; run: miles/duration/notes) → produces ADD action |
| 5 | Wire home screen "+" button → action modal | frontend | todo | FAB or section button opens modal, category type picker |
| 6 | Add daily totals widget to home | frontend | todo | Calories/macros running total card, always visible |
| 7 | Route chat proposals to action modal | backend + frontend | todo | Chat propose → open modal pre-filled, instead of inline confirm |
| 8 | QA pass | qa | todo | All existing tests pass + new tests for action endpoints |

## Category Fallback Rule

**Categories must not block logging.** User input should always produce a log proposal, even when no matching category/goal/routine exists.

**Fallback hierarchy** (deterministic, no LLM):
1. If a matching category exists for the user → attach it
2. If no match → attach generic category by type (`Nutrition`, `Running`, `Gym`, `Custom`)
3. If generic category missing for user → auto-create it
4. Never return "No category found" — always resolve to something

**Modal behavior**: Worst case, pre-fill form with best estimate. User can review + edit before confirm. No dead-end chat responses.

**Pass criteria**:
- "I had 2 tacos" → proposed nutrition log (category auto-resolved)
- "I ran 1 mile" → proposed running log (category auto-resolved)
- "yes" (confirm) never triggers "No category found"
- Logs can be added from chat or modal without prior routine setup

## Deferred

- **DailyLedger API** (`GET /api/ledger`) — not needed yet; current query-time aggregation works
- **UPDATE action** (log editing, PATCH endpoint) — deferred to Sprint 12; ADD path must be solid first

## Dependencies

```
1 (reliability) — no deps, do first
2 (action type) → 3 (executor) → 4 (modal)
3 (executor) → 7 (chat→modal)
5 (wire "+") depends on 4 (modal)
6 (widget) — independent
```

## Non-Goals (this sprint)

- No AI improvements (classifier, estimator unchanged)
- No new DB tables or migrations
- No dashboard redesign
- No settings page
- No mobile-specific work
- No log editing (UPDATE deferred)

## Definition of Done

- [ ] All action paths return clear errors, no silent failures
- [ ] Category never blocks logging — fallback + auto-create works
- [ ] Action type defined, validated with Zod
- [ ] Nutrition/gym/run can be logged via unified modal (no chat required)
- [ ] "+" button on home opens action modal
- [ ] Daily totals widget visible on home screen
- [ ] Chat proposals open in modal instead of inline
- [ ] All 25+ existing tests pass
- [ ] New tests for action schema + modal flows

## Previous Sprint

Sprint 10 (Multi-User Launch) completed: Auth, RLS, tap persistence, create/delete UI, deploy to EAS Hosting, multi-user smoke test, security hardening.
