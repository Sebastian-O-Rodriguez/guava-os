---
name: sprint
description: Plan or review the current sprint. Creates task breakdown with agent assignments.
---

## Sprint Planning

Read the following files:

- `CLAUDE.md` — Product spec
- `.gorp/plans/roadmap.md` — Current roadmap
- `.gorp/plans/current-sprint.md` — Active sprint (if exists)

Then either:

**If starting a new sprint**: Propose a task breakdown following this format:

- Tasks grouped by wave (parallel where possible)
- Each task has: ID, agent, title, acceptance criteria
- Dependencies clearly stated
- Write result to `.gorp/plans/current-sprint.md`

**If reviewing**: Read `.gorp/journal/` for agent reports, summarize progress,
identify blockers, and update task statuses in `current-sprint.md`.

Arguments: `$ARGUMENTS` (e.g., "plan phase-1", "review", "status")
