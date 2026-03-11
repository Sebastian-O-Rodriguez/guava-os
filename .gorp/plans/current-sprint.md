# Sprint 4 — AI Chat (Brain Dump → Habits)

Date: 2026-03-11
Phase: 4 — Post-Launch / AI Integration
Goal: Chat interface where user brain-dumps goals, Claude extracts and creates habits automatically. Ongoing adjustment via conversation.
Status: **Not Started**
Depends on: Sprint 3 (complete), habit modes (complete)

## Wave 1 — Architecture + Dependencies (sequential)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 1A | architect | Design chat API contract — route handler, tool schemas, system prompt, message format | todo | Tool definitions for create/update/delete/list habits matching FrequencyConfig. System prompt that knows about daily/scheduled/weekly modes. Request/response types. |
| 1B | CTO | Add `OPENROUTER_API_KEY` to Vercel env vars | done | Key set in Vercel dashboard + local .env |
| 1C | backend | Install dependency: `openai` (OpenRouter-compatible SDK) | todo | `pnpm add openai`, no peer dep conflicts, build passes |

## Wave 2 — Backend (depends on Wave 1)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 2A | backend | Build chat route handler (`/api/chat`) — Claude API with tool use | todo | POST endpoint accepts `{ messages }`, calls Claude with tool definitions, executes tool calls against existing server actions, returns assistant message + results. Streaming not required for v1. |
| 2B | backend | Define tool schemas — `create_habit`, `update_habit`, `delete_habit`, `list_habits` | todo | Zod-validated tool inputs matching FrequencyConfig. Claude can create any habit mode (daily, scheduled with specific days, weekly with target). List returns current habits for context. |
| 2C | backend | System prompt — teach Claude about RoutineMe habit model | todo | Claude understands: daily/scheduled/weekly modes, day abbreviations (mon-sun), timesPerWeek range (1-7), can parse natural language like "gym 3x a week" or "meditate every morning" or "call mom on sundays". Returns confirmation of what was created/changed. |

## Wave 3 — Frontend (depends on Wave 2)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 3A | frontend | Build chat page (`/chat`) — message input + response display | todo | New route, textarea input, send button, message history (session only), shows Claude's responses + habit creation confirmations. Dark theme consistent with rest of app. |
| 3B | frontend | Add Chat link to AppNav | todo | 5th nav item "Chat" with message icon, active state matches other links |
| 3C | frontend | Habit creation feedback — show created/updated habits inline | todo | When Claude creates habits via tools, show a summary card in the chat: habit name, frequency, confirmation. User can see what was just created without leaving chat. |

## Wave 4 — Polish + QA (depends on Wave 3)

| ID | Agent | Task | Status | Acceptance Criteria |
|----|-------|------|--------|-------------------|
| 4A | frontend | Chat UX polish — loading states, error handling, empty state | todo | Loading spinner while Claude responds, error message on API failure, welcome message with example prompts on first visit |
| 4B | qa | Full quality gate pass | todo | `tsc --noEmit` clean, `next build` clean, chat flow works end-to-end, habits appear on Today page after creation via chat |
| 4C | CTO | Deploy + verify in production | todo | Chat works on Vercel with production API key, all existing routes still work |

## Notes

- **No streaming for v1** — simple request/response. Can add streaming in a future sprint.
- **No chat persistence** — messages are session-only (React state). No DB table needed.
- **No check-off via chat** — the toggle UI is faster for daily use. Chat is for setup/adjustment.
- **Context per request** — pass current habits list to Claude so it knows what exists.
- **API**: OpenRouter (`https://openrouter.ai/api/v1`) with `openai` SDK. Model: `anthropic/claude-haiku` (cheap, fast).
- **New dependency**: `openai` only. No `assistant-ui` for v1 (custom chat UI is simpler and avoids another dep).
- **Tool use pattern**: Claude calls tools, server executes them, returns results to Claude, Claude summarizes for user.

## Example Interactions

```
User: "I want to go to the gym 3 times a week, meditate every day,
       message clients every monday, and read on weekends"

Claude: Created 4 habits:
  ✓ Gym — 3x per week
  ✓ Meditate — Every day
  ✓ Message clients — Mondays
  ✓ Read — Sat, Sun

User: "Actually make gym 4 times a week"

Claude: Updated Gym to 4x per week ✓

User: "What habits do I have?"

Claude: You have 4 active habits:
  • Gym — 4x/week
  • Meditate — Daily
  • Message clients — Mon
  • Read — Sat, Sun
```

## Sprint 3 Archive

Sprint 3 (Polish + Deploy) completed 2026-03-11. Includes post-sprint features:
QA fixes (W1-W5), Vercel deployment, Today page upgrades (streaks, gamification,
day picker), habit modes (scheduled/weekly/overdue), delete habit.

<details>
<summary>Sprint 3 — Polish + Deploy (COMPLETED 2026-03-11)</summary>

### Waves 1-3: Settings, responsive, theme polish — all done
### Wave 4: QA + Deploy — done
### Post-sprint: Today upgrades, habit modes, delete — done

### QA Summary
- `tsc --noEmit`: clean
- `next build`: clean (4 dynamic routes)
- 5 warnings found and fixed (W1-W5)
- Deployed to Vercel, production DB connected
- Recommendation: Ship ✓

</details>
