# Gotchas & Rules

Team workflow pitfalls. For codebase gotchas (fish templates, hatchling, MCP pool, etc.), see root `CLAUDE.md`.

## Hard Rules

- **Don't push directly to main.** Always use feature branches + PRs.
- **Don't modify the roadmap.** `.shoal/plans/roadmap.md` is user-maintained. Robo reads it, never writes it.
- **Don't add dependencies without approval.** New deps need architect + user sign-off.
- **Don't skip tests to unblock.** If tests fail, fix them. Don't comment them out or mark xfail without justification.
- **Don't change API contracts unilaterally.** API surface changes require architect review.
- **Don't modify CI/CD without user approval.** Pipeline changes are high-blast-radius.

## Journal Everything

If it's not journaled, it didn't happen. Journal:
- Task start and completion
- Blockers encountered and how they were resolved
- Design decisions and their rationale
- Anything the next agent (or future you) would need to know

## Common Failure Modes

### "Tests pass locally but CI fails"
- Check Python version (3.12+ required)
- Run `just ci` locally — it mirrors the CI pipeline exactly
- Integration tests need tmux running

### "mypy complains about a type I can't figure out"
- All function signatures need explicit types — mypy --strict
- Use `asyncio.to_thread()` for blocking calls in async contexts
- Check `py.typed` marker is present

### "Ruff and I disagree"
- Ruff wins. Don't add `# noqa` without a comment explaining why.
- Check `pyproject.toml` for the active rule sets before fighting the linter.

### "I broke the pre-commit hook"
- Don't use `--no-verify`. Fix the issue.
- `uv run pre-commit run --all-files` to see what's failing

### "Merge conflict in sprint file"
- Robo owns `current-sprint.md`. Let robo regenerate it.
- Don't hand-edit sprint files — update via robo.

## Async Pitfalls

- **Never call blocking subprocess functions in async contexts.** Use the `async_*` wrappers in `core/tmux.py` and `core/git.py`.
- **Never use `time.sleep()` in async code.** Use `asyncio.sleep()`.
- **Database access**: Always use `async with get_db() as db:` — never create raw connections.
