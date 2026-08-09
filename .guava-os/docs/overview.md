# Guava OS Overview

Guava OS is the read-only control plane for Guava's agent-operated projects. Its CLI inspects Linear execution graphs and reports queue state, protocol violations, and parent health. Operators iterate and create plans here; approved plans are delegated to Gorp (the executor) for governed execution.

## What It Is

A pure data processor. It takes Linear issue data as JSON input and produces deterministic, structured output about what work is executable, what is blocked or invalid, and whether the issue graph follows protocol rules.

It is the checkpoint between "human plans work in Linear" and "agents execute work."

## What It Does

- **Validates repo setup** (`doctor`) — checks that config, AGENT.md files, process docs, and persona labels are in place
- **Shows execution queue** (`status`) — groups sub-issues by persona, showing what agents can claim right now
- **Detects violations** (`validate`) — finds structural problems in the issue graph that would cause agents to fail
- **Generates launch directives** (`next`) — compiles the graph into one operator-ready launch directive per persona (branch name plus context notes)

## What It Does NOT Do

- Fetch data from Linear (the caller provides data via stdin)
- Mutate Linear issues, statuses, labels, or assignments
- Promote sub-issues from Backlog to Todo
- Reclaim stale work
- Dispatch or control agents
- Deploy code
- Write to the filesystem
- Make autonomous decisions
- Provide a dashboard or GUI

## Current Architecture


```
Linear (source of truth)
    ↓
Caller fetches issue data (MCP tools, export, API)
    ↓
JSON piped to stdin
    ↓
guava-os CLI (pure function: data in → report out)
    ↓
stdout: human-readable or JSON output
    ↓
Human decides: proceed / fix Linear / pivot
```

The CLI has no network layer. It reads stdin and local config files. It writes to stdout only.
guava-os sits above Gorp as the control plane: operators plan and validate here; approved plans flow down to Gorp for governed execution (plan → orchestrate → gate → review → promote). The CLI itself is a pure data processor — it never drives execution.


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
