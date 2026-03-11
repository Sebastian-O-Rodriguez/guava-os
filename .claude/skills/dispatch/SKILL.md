---
name: dispatch
description: Dispatch a task to a specific agent with context, scope, and acceptance criteria.
---

## Agent Dispatch

Dispatch a task to an agent. Usage: `/dispatch <agent> <task-id>`

1. Read `.gorp/plans/current-sprint.md` to find the task
2. Read the agent's definition from `.claude/agents/<agent>/AGENT.md`
3. Compose a dispatch prompt including:
   - Task ID and title
   - Scope (files/directories to modify)
   - Acceptance criteria
   - Context files to read
   - Rules and boundaries
4. Execute via: `claude -p "<prompt>" --agent <agent> --output-format json`
5. Log dispatch to `.gorp/journal/<agent>-<date>.md`

Arguments: `$ARGUMENTS`
