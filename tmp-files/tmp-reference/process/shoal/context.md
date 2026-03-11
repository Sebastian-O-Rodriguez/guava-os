# Project Context

<!-- TEMPLATE: customize for your project -->

## What Is This?

**Shoal** is a terminal-first orchestration tool for parallel AI coding agents. It manages agent sessions as tmux processes with shared infrastructure, persistent state, and programmatic supervision.

One-liner: A control plane for AI coding agents — spawn, monitor, and coordinate multiple agents from a single terminal.

## Tech Stack

- **Language**: Python 3.12+, async-first (`asyncio`, `aiosqlite`)
- **State**: SQLite with WAL mode — single file, zero config, ACID compliant
- **Process layer**: tmux 3.3+ for session persistence and pane management
- **Shell**: Fish shell (sole supported shell)
- **Editor**: Neovim (via nvim socket integration)
- **AI tools**: OpenCode (primary), Claude Code, Gemini Code Assist
- **MCP**: Model Context Protocol server pooling via asyncio Unix sockets
- **Build**: hatchling (not setuptools)
- **Package manager**: uv
- **Task runner**: just

## Architecture Highlights

- **Lifecycle service** (`services/lifecycle.py`): Single orchestrator for create/fork/kill/reconcile — both CLI and API delegate to it
- **Git worktrees**: Session isolation via `git worktree add`, not branches in main working tree
- **MCP pool**: Shared MCP servers via Unix socket proxying — one listener per type, per-connection spawning
- **Status detection**: Tmux pane scraping with regex patterns per tool
- **Template inheritance**: Single inheritance (`extends`) + additive composition (`mixins`)

For full architecture details, see `ARCHITECTURE.md` at the project root.

## Module Layout

```
src/shoal/
├── api/          # FastAPI server (REST endpoints)
├── cli/          # Typer CLI (session, mcp, config, remote, demo)
├── core/         # Business logic (config, db, state, tmux/git, journal, logging)
├── models/       # Pydantic models (config, session state, API schemas)
├── services/     # Lifecycle, MCP pool/proxy/server, status bar
├── integrations/ # Fish shell templates, tool-specific configs
└── dashboard/    # Terminal dashboard (Rich-based)
```

Entry points: `shoal` (CLI), `shoal-mcp-proxy`, `shoal-mcp-server`, `shoal-status`

## Current State

- **Version**: v0.17.0
- **Tests**: 618+, 80% coverage gate, mypy --strict
- **CI**: 5 parallel jobs (lint, typecheck, test, fish-check, security)
- **Platform**: macOS only (tmux + Unix sockets)
