# RoutineMe — Product Specification

> Updated 2026-05-01. Locked goal/log model.

## Product Identity

**RoutineMe is a stateful daily tracking system.**

It maintains a persistent daily ledger of what the user did — habits, nutrition, exercise — and provides real-time visibility into daily state. The user opens the app, sees where they stand, takes action, and moves on.

It is NOT a chatbot. Chat is an input parser, not the product.

## Locked Data Model

### Logs = Source of Truth

- Every progress change creates a log entry
- Logs are append-only, date-partitioned
- Progress is computed from logs at query time — never stored
- Deleting a log recalculates progress automatically

### Goals = Filters Over Logs

- Goal = category + metric + unit + target + period
- One goal tracks one primary metric
- Multiple goals per category allowed (e.g., "miles/week" + "sessions/week")
- One log can increment multiple matching goals
- Goal matching: `category_id + unit + period`
- Archived goals (`active: false`) are excluded from progress, never auto-reactivate
- Logs remain intact when goals are archived

### Units (MVP)

| Unit | Example use |
|------|-------------|
| count | sessions, habits, reps |
| minutes | reading, meditation |
| hours | study, work |
| miles | running, cycling |
| km | running, cycling |
| grams | protein, fat, carbs |
| calories | nutrition |

### Log Write Shape

All new logs include structured fields:

```
{ count: 1 }                                          // session/habit
{ distance: 3, distance_unit: "miles", count: 1 }     // run
{ duration: 30, duration_unit: "minutes", count: 1 }   // timed activity
{ calories: 500, protein: 30, fat: 20, carbs: 60 }    // nutrition (unchanged)
```

Old logs (pre-structured) remain compatible — read path handles both shapes.

### Periods

- `daily` — progress resets each day
- `weekly` — Mon–Sun window

## UI Model

### Input

| Input | Role | Priority |
|-------|------|----------|
| Tap tile | Increment goal (writes structured log) | Primary |
| Action modal | Log nutrition, gym, runs (opens from `+` button or chat) | Primary |
| Create form | Add new goal (name, target, unit, period) | Primary |
| Chat | Parse natural language → open modal | Secondary |

### Display

- DailyCard: goal tiles + doughnut + totals + feed (single card for all daily state)
- Weekly: progress bars for weekly goals
- Feed: today's log entries grouped by type

## What RoutineMe Is NOT

- Not a chatbot (chat is input, not product)
- Not social (no sharing, no collaborative)
- Not AI-first (AI assists, doesn't drive)
- Not a planner (tracks what happened, not what should happen)
