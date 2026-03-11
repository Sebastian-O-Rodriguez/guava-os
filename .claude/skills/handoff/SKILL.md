---
name: handoff
description: Write or read session handoff context for continuity between sessions.
---

## Session Handoff

Preserve or restore context between Claude Code sessions.

**Write handoff** (`/handoff write`):
Summarize current session state:
- What was accomplished
- What's in progress
- What's blocked
- Next steps
- Key decisions made

Write to `.gorp/journal/handoff-<date>.md`

**Read handoff** (`/handoff read` or just `/handoff`):
Read the most recent handoff file from `.gorp/journal/handoff-*.md`
and summarize it for the current session.

Arguments: `$ARGUMENTS`
