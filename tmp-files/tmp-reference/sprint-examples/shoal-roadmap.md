# Roadmap

> **Owner**: User-maintained. Robo reads this file but never modifies it.
> Agents reference this to understand project direction. Only the user updates it.

## Current Milestone: v0.17.0

**Goal**: Polish onboarding, documentation, and developer experience.

### Key Deliverables

- [ ] Audit and update reference docs for v0.17.0
- [ ] Server Composition Gateway investigation (FastMCP `mount()`)
- [ ] Documentation for new features (journal frontmatter, journal archive, local templates, HTTP transport)
- [ ] `shoal journal --archived <session>` CLI for reading archived journals
- [ ] Nerd Font toggle in `shoal ls` (config flag for glyph rendering)

## Backlog

- Server Composition Gateway: Per-session MCP aggregation via FastMCP `mount()`
- Oh-My-Pi (omp) integration: Tool definition, session template, MCP socket sharing
- Remote status bar: Fish status bar polls remote WebSocket for session status
- Expose hooks for configuration and runtime scripting

## Completed

See `CHANGELOG.md` for full release history (v0.4.0 through v0.16.0).

Highlights:

- v0.16.0: Remote sessions, journals, HTTP transport, project-local templates
- v0.15.0: FastMCP integration, Shoal MCP server, robo-orchestrator template
- v0.14.0: Template inheritance and mixins
- v0.13.0: Ruff lint expansion, security consolidation
- v0.12.0: Compiled regex detection, session CLI decomposition
