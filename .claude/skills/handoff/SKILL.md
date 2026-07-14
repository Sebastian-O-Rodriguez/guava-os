<!-- LEGACY / DEPRECATED (Wave A closeout, 2026-07-14).
     This skill encodes the SUPERSEDED Linear-first flow. Linear is DEPRECATED
     as execution authority and markdown sprint tables are non-authoritative;
     the authoritative model is the Gorp-native persisted execution graph
     (~/dev/gorp/runtime/control/). Retained as a legacy Claude-Code runtime
     artifact only. See ~/dev/repos/DOCUMENTATION-AUTHORITY-MAP.md. -->

---
name: handoff
description: Write or read session handoff context for continuity between sessions.
---

## Session Handoff

Preserve or restore context between Claude Code sessions.

**Write handoff** (`/handoff write`):

1. Query Linear for current In Progress and In Review issues
2. Summarize:
   - What was accomplished this session
   - What's in progress (with Linear issue IDs)
   - What's blocked (with reasons)
   - Next steps
   - Key decisions made
3. Write to `.gorp/archive/journal/handoff-<date>.md`

**Read handoff** (`/handoff read` or just `/handoff`):

1. Read the most recent handoff file from `.gorp/archive/journal/handoff-*.md`
2. Cross-reference with current Linear state (handoff may be stale)
3. Summarize for the current session

Arguments: `$ARGUMENTS`
