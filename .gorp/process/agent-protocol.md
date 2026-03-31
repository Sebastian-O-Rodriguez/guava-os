# Agent Communication Protocol

## Dispatch (Robo → Agent)

Robo dispatches work by running agents via Claude Code CLI:

```bash
# Interactive
claude --agent <name>

# Headless
claude -p "<dispatch prompt>" --agent <name> --output-format json

# Isolated
claude --worktree feat/<task> --agent <name>
```

### Dispatch Prompt Structure

```
## Task
ID: [from sprint table]
Title: [task title]
Agent: [agent name]

## Scope
Files to modify: [list]
Files to read first: [list]

## Acceptance Criteria
- [ ] criterion 1
- [ ] criterion 2

## Rules
- Only modify files within scope
- Don't touch CLAUDE.md, .gorp/plans/roadmap.md
- Conventional commits with scope
- Write journal entry when done
```

## Report (Agent → Robo)

Agents write reports to `.gorp/journal/<agent>-YYYY-MM-DD.md`:

```markdown
## Task [ID] — [Title]

Status: done | in-progress | blocked
Files: modified file list
Tests: X passing, Y% coverage
Summary: what was done
Blockers: issues encountered (if any)
```

## Blocker Escalation

```markdown
## BLOCKED — [one-line summary]

Severity: low | medium | high | critical
Affected tasks: [IDs]
Context: what was tried, what failed
Suggested fix: best guess
```

Robo surfaces blockers to CTO immediately for high/critical.

## Journal

One file per agent per day. Append-only during the day.
Format: `.gorp/journal/<agent>-YYYY-MM-DD.md`
