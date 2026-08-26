---
name: to-tickets
description: "Break a plan, spec, or conversation into tracer-bullet tickets with explicit blocking edges, written as Linear issues or a local file. Use after planning, before dispatch."
domain: pm
role: manager
order: 2

metadata:
  author: guava-os
  version: "0.1.0"
---

## To Tickets

Turn a plan into small tickets with dependency edges (mattpocock `to-tickets` +
`to-spec`, distilled; fits `planning`).

## Rules

- One ticket = one observable outcome, sized for a single worker turn.
- Declare blocking edges explicitly (native `blocks` / `blocked-by`). A hard
  result-dependency only — never "do roughly before" (GOS-44).
- Each ticket: Why / Scope / Out-of-scope / numbered pass-fail Acceptance.
- Resolve edges before creating; execution order = zero-indegree first.
- Use canonical Linear IDs after creation (`linear` skill / `pm`), never aliases.

## Steps

1. Extract outcomes from the plan (verbs, observable).
2. Sequence by real dependencies (results-needed test).
3. `pm create` each ticket via the `linear` skill; `pm link` the edges.
4. Verify: `validate` (no orphan/overflow) + `status` (0-indegree ready).

## Uses

- After planning, before dispatch; Linear ticket creation
- Input to the `dispatch` skill for fan-out

## Source

mattpocock `engineering/to-tickets` + `to-spec`.