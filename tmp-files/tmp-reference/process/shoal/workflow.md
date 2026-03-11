# Workflow & Process

## Branch Strategy

- All work happens on feature branches off `main`
- Each agent session gets its own git worktree (shoal handles this automatically)
- Branch names follow conventions in `conventions.md`
- One branch per sprint task — no multi-task branches

## Commit Format

Conventional commits enforced by gitlint. Full spec in `COMMIT_GUIDELINES.md`.

```
type: lowercase imperative description
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

## PR Rules

- One PR per sprint task
- Descriptive title in conventional commit format
- Body includes summary, test plan, and sprint task reference
- Must pass CI (`just ci` equivalent)
- QA review required before merge
- No force-pushes to shared branches

## Approval Matrix

### Auto-approve (agents do freely)
- Write and edit code in assigned task scope
- Run tests and linters
- Create feature branches and worktrees
- Write journal entries
- Read any project file

### Needs robo approval
- Merge to main
- Delete files or branches
- Change API contracts or public interfaces
- Modify CI/CD configuration
- Re-prioritize tasks within a sprint
- Restart failed agent sessions

### Needs user approval
- Roadmap changes or new milestones
- Add, remove, or upgrade dependencies
- Architectural pivots or major design changes
- Scope changes (adding/removing sprint tasks)
- Any action with cost/billing implications
- Anything ambiguous — when in doubt, escalate

## Sprint Cadence

1. **User sets direction**: Updates `.shoal/plans/roadmap.md` with current goals
2. **Robo proposes sprint**: Breaks roadmap items into tasks with persona assignments
3. **User confirms**: Reviews and approves the sprint breakdown
4. **Agents execute**: Each agent works their assigned tasks in isolated sessions
5. **Robo monitors**: Tracks progress, surfaces blockers, coordinates handoffs
6. **QA validates**: Reviews completed work against acceptance criteria
7. **Sprint closes**: Robo writes summary report to `.shoal/plans/reports/`

User sets the pace. Sprints can be as short as a single task or as long as a full milestone.

## Release Process

Releases use existing automation:
- `just release X.Y.Z` bumps version + creates tag
- GitHub Actions publishes on tag push
- See `CHANGELOG.md` for release history
