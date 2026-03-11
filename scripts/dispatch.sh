#!/bin/bash
# Parallel agent dispatcher for RoutineMe
# Usage: ./scripts/dispatch.sh <sprint-name>
#
# Reads current-sprint.md, finds pending tasks, dispatches agents in parallel.
# Each agent runs in an isolated worktree.

set -euo pipefail

SPRINT="${1:?Usage: dispatch.sh <sprint-name>}"
SPRINT_FILE=".gorp/plans/current-sprint.md"
JOURNAL_DIR=".gorp/journal"
DATE=$(date +%Y-%m-%d)

if [ ! -f "$SPRINT_FILE" ]; then
  echo "Error: $SPRINT_FILE not found"
  exit 1
fi

mkdir -p "$JOURNAL_DIR"

echo "=== Dispatching Sprint: $SPRINT ==="
echo "Date: $DATE"
echo ""

# Parse pending tasks from sprint file
# Expected format: | ID | Agent | Task | pending | Criteria |
grep -E '^\|.*\bpending\b' "$SPRINT_FILE" | while IFS='|' read -r _ id agent task status criteria _; do
  id=$(echo "$id" | xargs)
  agent=$(echo "$agent" | xargs | tr '[:upper:]' '[:lower:]')
  task=$(echo "$task" | xargs)
  criteria=$(echo "$criteria" | xargs)

  if [ -z "$agent" ] || [ -z "$task" ]; then
    continue
  fi

  # Validate agent name
  valid_agents="architect backend frontend qa"
  if ! echo "$valid_agents" | grep -qw "$agent"; then
    echo "  SKIP: unknown agent '$agent'"
    continue
  fi

  echo "Dispatching: $id → $agent — $task"

  # Build dispatch prompt
  prompt="## Task
ID: $id
Title: $task
Agent: $agent
Sprint: $SPRINT

## Acceptance Criteria
$criteria

## Rules
- Read CLAUDE.md first for product context
- Read .gorp/plans/current-sprint.md for full sprint context
- Only modify files within your task scope
- Write journal entry to .gorp/journal/${agent}-${DATE}.md when done
- Conventional commits: type(scope): description"

  # Dispatch in background with worktree isolation
  claude -p "$prompt" \
    --agent "$agent" \
    --output-format json \
    > "$JOURNAL_DIR/${agent}-${id}-dispatch.json" 2>&1 &

  echo "  PID: $! → $JOURNAL_DIR/${agent}-${id}-dispatch.json"
done

echo ""
echo "All agents dispatched. Monitor with: ls -la $JOURNAL_DIR/"
echo "Wait for completion with: wait"

wait
echo "=== All agents complete ==="
