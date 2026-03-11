# RoutineMe — Project Memory

## Identity
- **Gorp** is the orchestrator identity
- RoutineMe is a private single-user habit tracker for Sebastian
- Personal tool, NOT a startup product

## Stack
- Next.js 15 (App Router) + TypeScript
- Vercel deployment
- PostgreSQL + Prisma
- Tailwind + shadcn/ui
- Tremor (metrics) + Observable Plot (charts)
- assistant-ui deferred to post-launch

## Architecture
- One Next.js app, server actions (no REST API)
- Single-user, no auth system
- Prisma: users, habits, completions, daily_notes
- Dark theme, desktop-first, mobile-usable

## Agent System
- Agents defined in `.claude/agents/<name>/AGENT.md`
- Dispatch via `claude -p` or `claude --agent <name>`
- 5 agents: robo (orchestrator), architect, backend, frontend, qa
- Skills: /sprint, /dispatch, /verify, /handoff
- Process docs in `.gorp/process/`
- Sprint tracking in `.gorp/plans/`
- Journal logs in `.gorp/journal/`

## Shoal Decision
- Shoal framework **replaced** by native Claude Code features
- Shoal's patterns (personas, dispatch, journals, quality gates) preserved as files
- tmux/worktree orchestration replaced by `claude --worktree` and `claude -p`
- XML protocol replaced by structured markdown prompts

## Key Directories
- `CLAUDE.md` — root context, product spec
- `.claude/agents/` — agent definitions
- `.claude/skills/` — slash commands
- `.gorp/plans/` — roadmap + sprints
- `.gorp/journal/` — agent work logs
- `docs/architecture.md` — system architecture
- `scripts/` — dispatch.sh, quality-gate.sh

## Current State (2026-03-10)
- Repo scaffolded with agent system + process docs
- Sprint 1 planned (Foundation: schema + scaffold + CRUD + Today view)
- Next.js app not yet created (Sprint 1, Wave 1)
