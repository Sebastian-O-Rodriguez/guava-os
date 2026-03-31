# Shoal — Agent Orchestration Framework

Shoal is a terminal-first framework for orchestrating parallel AI coding agents. We use it to build PM Lad.

---

## What Shoal Does

- Spawns AI agent sessions in isolated git worktrees
- Shares MCP servers across sessions (memory, filesystem, GitHub)
- Detects agent status via tmux pane scraping
- Provides a Robo supervisor pattern for coordination
- Supports session templates with inheritance and mixins

## Key Concepts

| Concept      | Description                                                  |
| ------------ | ------------------------------------------------------------ |
| **Session**  | An AI agent running in a tmux pane with its own worktree     |
| **Template** | TOML config defining session layout, tool, env vars, windows |
| **Persona**  | Agent identity (Architect, Backend, Frontend, QA, Robo)      |
| **Robo**     | Supervisor agent that dispatches and monitors other agents   |
| **MCP Pool** | Shared MCP servers via Unix socket proxying                  |
| **Worktree** | Git worktree for file isolation between agents               |

## PM Lad Templates

These live in `pmlad/.shoal/templates/`:

| Template          | Tool     | Use for                                        |
| ----------------- | -------- | ---------------------------------------------- |
| `pmlad-api`       | opencode | Backend: NestJS, Prisma, API endpoints         |
| `pmlad-web`       | opencode | Frontend: Next.js, React, Tailwind             |
| `pmlad-fullstack` | opencode | Cross-cutting: packages, contracts, migrations |
| `pmlad-robo`      | claude   | Robo supervisor with Shoal MCP tools           |

## Personas

Defined in `pmlad/.claude/personas/`:

| Persona   | File           | Role                                                 |
| --------- | -------------- | ---------------------------------------------------- |
| Robo      | `robo.md`      | Orchestrator — sprint planning, dispatch, monitoring |
| Architect | `architect.md` | System design, contracts, review gates               |
| Backend   | `backend.md`   | NestJS services, Prisma, API endpoints               |
| Frontend  | `frontend.md`  | React components, Next.js pages, widgets             |
| QA        | `qa.md`        | Testing, coverage, validation                        |

## Shoal CLI Quick Reference

```bash
shoal new --template pmlad-api -n my-task    # Start backend agent session
shoal new --template pmlad-web -n ui-task    # Start frontend agent session
shoal new --template pmlad-robo -n robo      # Start robo supervisor
shoal ls                                      # List sessions
shoal status                                  # Quick status
shoal attach <name>                           # Attach to session
shoal kill <name>                             # End session
shoal template ls                             # List available templates
```

## Shoal Internal Docs

For Shoal framework development (not PM Lad usage):

| Doc             | Path                                                   | Purpose                                   |
| --------------- | ------------------------------------------------------ | ----------------------------------------- |
| Codebase rules  | [`shoal/CLAUDE.md`](shoal/CLAUDE.md)                   | Python code style, module layout          |
| Architecture    | [`shoal/ARCHITECTURE.md`](shoal/ARCHITECTURE.md)       | Design decisions, component relationships |
| Shoal roadmap   | [`shoal/ROADMAP.md`](shoal/ROADMAP.md)                 | Shoal framework development milestones    |
| Shoal changelog | [`shoal/CHANGELOG.md`](shoal/CHANGELOG.md)             | Release history                           |
| Robo guide      | [`shoal/docs/ROBO_GUIDE.md`](shoal/docs/ROBO_GUIDE.md) | Advanced robo patterns                    |
