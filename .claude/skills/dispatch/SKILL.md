---
name: dispatch
description: Dispatch a task to a specific agent with context, scope, and acceptance criteria.
---

## Agent Dispatch (Linear-First)

Dispatch a task to an agent. Usage: `/dispatch <agent> <GUA-id>`

1. Query Linear for issue `GUA-{id}` — read title, description, status, labels, parent, blockers
2. Validate eligibility (ALL must pass):
   - Issue exists and status is **`Todo`** (not Backlog — Backlog is NOT executable)
   - **Issue is a subtask** (has a parent issue). Never dispatch parent issues — they are containers.
   - Issue has a persona label matching the target agent
   - Parent issue status is `Todo` or `In Progress`
   - All blocking issues are `Done`
   - Parent branch is defined
   - If any check fails, report: `BLOCKED — [which check failed]`. Do NOT dispatch.
3. Read the agent's definition from `.claude/agents/<agent>/AGENT.md`
4. Compose a dispatch prompt including:
   - Issue ID, title, and description from Linear
   - Branch: `feat/GUA-{parent-id}-{slug}`
   - Acceptance criteria from issue description
   - References to relevant context docs
5. Execute via: `claude -p "<prompt>" --agent <agent>`
6. Comment on the Linear issue: `DISPATCHED to [agent] — [date]`

**No executable work**: If the target issue fails eligibility, report `No executable work available for [agent].` with blocking reason. Do NOT suggest alternative issues, recommend Backlog work, or propose future tasks.

**Do NOT read `.gorp/archive/*` for task definitions.**
Execution state comes from Linear only.

Arguments: `$ARGUMENTS`
