> **`PROPOSAL` — NOT IMPLEMENTED (labeled at Wave A closeout, 2026-07-14).**
> Spec only; no runtime implements this. Linear references below are
> `ADAPTER_SPECIFIC` legacy — Linear is deprecated as execution authority.
> Authoritative runtime contracts: `~/dev/gorp/specs/runtime/`. See
> `~/dev/repos/DOCUMENTATION-AUTHORITY-MAP.md`.

# Gorp Launch Contract

## Purpose

Defines how Guava OS launches execution through Gorp.
Spec only — no implementation in Phase 2A.

## Overview

Gorp is the execution substrate. Guava OS generates directives; Gorp materializes them
into running sessions. This contract defines the interface between the two.

## Inputs

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `persona` | string | Directive | Agent persona to launch |
| `issue_id` | string | Directive | Linear issue being worked |
| `branch` | string | Directive | Git branch name for the work |
| `execution_context` | object | Directive + config | Merged context for the agent |
| `agent_md_path` | string | Config | Path to the agent's AGENT.md file |

### Execution Context Object

```json
{
  "issue_id": "GUA-17",
  "title": "Build action executor",
  "priority": { "value": 2, "label": "P1/High" },
  "parent_id": "GUA-6",
  "branch": "backend/gua-17-build-action-executor",
  "persona": "backend",
  "repo_root": "/path/to/repo",
  "agent_md": ".claude/agents/backend/AGENT.md",
  "report_path": ".guava-os/reports/GUA-17-backend-{timestamp}.json"
}
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Unique identifier for the execution session |
| `tmux_target` | string | tmux session:window.pane identifier |
| `execution_report_path` | string | Where the agent should write its report |
| `launched_at` | string | ISO 8601 timestamp |

## Lifecycle

```
1. Operator runs: guava-os next < issues.json
2. Operator selects directive
3. Operator invokes: gorp launch --persona backend --issue GUA-17
4. Gorp:
   a. Creates tmux session
   b. Checks out branch (or creates it)
   c. Injects execution context
   d. Launches agent with AGENT.md
   e. Returns session info
5. Agent executes, writes execution report
6. Operator reviews report
```

## Failure Modes

### No Executable Work

- **Trigger**: `guava-os next` returns empty directives
- **Behavior**: Gorp refuses to launch, prints message
- **Exit code**: 1

### Persona Mismatch

- **Trigger**: Requested persona doesn't match any directive
- **Behavior**: Gorp refuses to launch, prints available personas
- **Exit code**: 1

### Launch Timeout

- **Trigger**: tmux session fails to start within 10 seconds
- **Behavior**: Gorp cleans up partial state, reports failure
- **Exit code**: 1

### Duplicate Active Session

- **Trigger**: tmux session for this persona already exists
- **Behavior**: Gorp refuses to launch, prints active session info
- **Exit code**: 1
- **Resolution**: Operator must explicitly terminate existing session

## Explicit Non-Goals

- Orchestration loop (launch → monitor → relaunch)
- Automatic retries on failure
- Autonomous reassignment to different persona
- Background monitoring of session health
- Session multiplexing (multiple issues per persona)
- Automatic branch creation or git operations beyond checkout
- Gorp does NOT read Linear directly — it consumes directive output

## Session Naming Convention

```
guava-os-{persona}-{issue_id}
```

Example: `guava-os-backend-GUA-17`

## Integration Points

| System | Direction | Data |
|--------|-----------|------|
| Guava OS → Gorp | Directives (stdout or JSON file) |
| Gorp → tmux | Session creation, context injection |
| Gorp → Agent | AGENT.md path, execution context |
| Agent → Filesystem | Execution report |
| Filesystem → Operator | Report review |
