# Guava OS Overview

Guava OS is the control plane for Guava's agent-operated projects. Its
classifier commands (`doctor`, `status`, `validate`, `next`) inspect Linear
execution graphs and report queue state, protocol violations, and parent
health. Planning and project management use `pm`, `sprint`, and `wf`; governed
execution flows through gorp. See `.omp/skills/planning/SKILL.md` for the
canonical loop.

## What It Does

- **Validates repo setup** (`doctor`) — checks that config, AGENT.md files, process docs, and persona labels are in place
- **Shows execution queue** (`status`) — groups sub-issues by persona, showing what agents can claim right now
- **Detects violations** (`validate`) — finds structural problems in the issue graph that would cause agents to fail
- **Generates launch directives** (`next`) — compiles the graph into one operator-ready launch directive per persona (branch name plus context notes)

## What the Classifier Commands Do NOT Do

These apply to `doctor`, `status`, `validate`, `next`. Planning/mutation
commands (`pm`, `sprint`, `wf`) call Linear and drive execution.

- Fetch data from Linear (they read stdin; `pm search` handles fetching)
- Mutate Linear issues, statuses, labels, or assignments (`pm` handles mutations)
- Promote sub-issues from Backlog to Todo (gorp handles promotion)
- Reclaim stale work
- Dispatch or control agents (gorp dispatches workers)
- Deploy code
- Write to the filesystem
- Make autonomous decisions
- Provide a dashboard or GUI

## Current Architecture

```
Linear (source of truth)
    ↓
guava-os pm search / sprint generate / wf plan
    ↓
gorp compile-graph → orchestrate → gate → review → promote
    ↓
OMP worker dispatch (persona-aware, sandboxed)
```

The classifier commands (`doctor`, `status`, `validate`, `next`) are the
read-only validation surface — stdin in, stdout out. The full governed
pipeline uses `pm`, `sprint`, and `wf` to plan, then hands off to gorp for
execution.


## Authority Model

- **Guava OS** is the control plane — it owns validation, reporting, and the plan/approve gate before any work reaches execution
- **Gorp** is the executor — it owns the governed execution graph, dispatch, review gates, and promotion of approved work
- **Human/CTO** owns strategy, promotion decisions, and escalation resolution
- **Agents/builders** own code execution within assigned sub-issues, dispatched by Gorp via OMP personas

Guava OS does not have authority to change anything. It is an inspector and gate, not a controller of execution state.

## Config

Project-specific settings live in `.guava-os/config.json`:
- Linear team/project/prefix
- Persona list and labels
- Persona definitions in `.guava-os/personas/<name>/persona.md` (replacing the deprecated `.claude/agents/` layout; maps to OMP roles)
- Active parent statuses
- Queue capacity limits
- File paths for AGENT.md and process docs

The config is checked into the repo and validated by `doctor`.
