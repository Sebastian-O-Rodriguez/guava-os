# Agent Team Workflow

For codebase rules, see [`../CLAUDE.md`](../CLAUDE.md).

## Process

All work goes through Shoal. See [`.shoal/project/process.md`](../.shoal/project/process.md) for the full workflow.

**Summary:** CTO sets direction -> Robo proposes sprint -> CTO confirms -> Agents execute with personas -> QA validates -> Robo reports.

## Personas

Defined in `.claude/personas/`:

| Role | File | When to use |
|------|------|-------------|
| Robo | `robo.md` | Sprint planning, dispatch, monitoring |
| Architect | `architect.md` | API design, schema changes, review gates |
| Backend | `backend.md` | NestJS features, Prisma, API endpoints |
| Frontend | `frontend.md` | React components, Next.js pages, widgets |
| QA | `qa.md` | Post-implementation validation |

## Templates

Defined in `.shoal/templates/`:

| Template | Scope |
|----------|-------|
| `pmlad-api` | `apps/api/`, `packages/db/` |
| `pmlad-web` | `apps/web2/`, `packages/ui/`, `packages/widgets/` |
| `pmlad-fullstack` | Full monorepo |
| `pmlad-robo` | Supervisor (no worktree) |

## Conventions

See [`.shoal/project/conventions.md`](../.shoal/project/conventions.md) for git, commit, sprint, and doc conventions.

## Plans

| File | Purpose |
|------|---------|
| `.shoal/plans/roadmap.md` | Points to canonical roadmap |
| `.shoal/plans/current-sprint.md` | Active sprint tasks |
| `.shoal/plans/sprints/` | Sprint docs (active + archived) |
| `.shoal/plans/reports/` | Sprint summaries |

## Approval Matrix

- **Auto:** Write code, run tests, create branches, journal writes
- **Robo decides:** Task re-prioritization, agent restarts
- **CTO required:** Roadmap changes, new deps, Prisma schema, API contracts, scope changes
