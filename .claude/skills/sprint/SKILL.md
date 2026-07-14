<!-- LEGACY / DEPRECATED (Wave A closeout, 2026-07-14).
     This skill encodes the SUPERSEDED Linear-first flow. Linear is DEPRECATED
     as execution authority and markdown sprint tables are non-authoritative;
     the authoritative model is the Gorp-native persisted execution graph
     (~/dev/gorp/runtime/control/). Retained as a legacy Claude-Code runtime
     artifact only. See ~/dev/repos/DOCUMENTATION-AUTHORITY-MAP.md. -->

---
name: sprint
description: Plan or review the current sprint. Creates task breakdown with agent assignments.
---

## Sprint Planning (Linear-First)

Usage: `/sprint [plan|review|status]`

### All modes — start by querying Linear:

1. List all issues in RoutineMe project (Guava AI team)
2. Group by status: Backlog, Todo, In Progress, In Review, Done
3. Identify parent issues and their subtasks
4. Check for blockers, stale claims, missing coverage

### `/sprint plan`

1. Query Linear for current state
2. Read `.gorp/context/architecture.md` and `.gorp/context/product-spec.md` for domain context
3. Propose parent issues and subtask breakdown
4. Each subtask: labeled with ONE persona, concrete acceptance criteria
5. Parent issues are containers — builders execute subtasks only
6. Priority mapping (LOCKED): Linear 1/Urgent=P0, 2/High=P1, 3/Medium=P2, 4/Low=P3
7. Create issues in Linear (do NOT write to local markdown files)
8. Set subtask status to **`Todo`** when ready for agent pickup. Use `Backlog` for subtasks not yet promotable. Agents cannot execute Backlog items.

### `/sprint review`

1. Query Linear for all In Progress and In Review issues
2. Check for stale claims (>2h no activity)
3. Check for blocked issues
4. Report status summary

### `/sprint status`

1. Query Linear issues grouped by status
2. Show completion percentage
3. List blockers and next actions
4. For each agent persona, report executable work availability:
   - If eligible Todo subtasks exist → list them
   - If none → report `No executable work available for [persona]` with blocking reason

**Do NOT read `.gorp/archive/*` for sprint state.**
Execution state comes from Linear only.

Arguments: `$ARGUMENTS`
