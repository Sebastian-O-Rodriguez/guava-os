# Team Conventions

These conventions govern how agents work as a team. For codebase style (line length, imports, type hints), see root `CLAUDE.md`.

## Branch Naming

- Feature: `feat/<short-description>`
- Fix: `fix/<short-description>`
- Docs: `docs/<short-description>`
- Chore: `chore/<short-description>`
- Refactor: `refactor/<short-description>`

Always branch from `main`. Use git worktrees for isolation.

## PR Conventions

- One PR per sprint task
- Title matches conventional commit format: `type: short description`
- Body includes: summary (what + why), test plan, link to sprint task ID
- Request QA review before merge

## Documentation Standards

- Code changes that affect public API: update docstrings
- New features: update relevant docs in `docs/` or root reference files
- Architectural changes: update `ARCHITECTURE.md`
- Don't create README files or markdown docs unless explicitly requested
- Keep docs concise — prefer examples over prose

## Agent Communication

### Journal Format

All significant actions, decisions, and blockers go in session journals via `append_journal`. Format:

```
**[STATUS]** Brief description

Details if needed. Keep it scannable.
```

Statuses: `DONE`, `BLOCKED`, `IN PROGRESS`, `DECISION`, `QUESTION`

### Blocker Format

```
**[BLOCKED]** <one-line summary>

- Severity: low | medium | high | critical
- Affected tasks: <sprint task IDs>
- Context: <what you tried, what failed>
- Suggested resolution: <your best guess>
```

## File Organization

- New modules go in the appropriate `src/shoal/` subdirectory
- Tests mirror source structure: `tests/test_<module>.py`
- Config files: `~/.config/shoal/`
- State files: `~/.local/state/shoal/`
- Prefer editing existing files over creating new ones
