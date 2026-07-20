> **`CURRENT` / `ADAPTER_SPECIFIC` (labeled at Wave A closeout, 2026-07-14).**
> Documents the read-only Linear import/classifier CLI. Linear is an input
> format here, not the execution authority — the authoritative execution model
> is the Gorp-native persisted graph (see
> `~/dev/gorp/reference/architecture.md`).

# Guava OS Overview

Guava OS is a read-only CLI tool that inspects Linear execution graphs and reports queue state, protocol violations, and parent health for Guava's agent-operated projects.

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

## Authority Model

- **The Gorp control plane** owns execution state (the persisted execution graph); Linear is an input format only, never the execution authority
- **Human/CTO** owns strategy, promotion decisions, and escalation resolution
- **Guava OS CLI** owns validation and reporting — it tells you what the graph looks like, not what to do about it
- **Agents/builders** own code execution within assigned sub-issues

Guava OS does not have authority to change anything. It is an inspector, not a controller.

## Config

Project-specific settings live in `.guava-os/config.json`:
- Linear team/project/prefix
- Persona list and labels
- Active parent statuses
- Queue capacity limits
- File paths for AGENT.md and process docs

The config is checked into the repo and validated by `doctor`.
