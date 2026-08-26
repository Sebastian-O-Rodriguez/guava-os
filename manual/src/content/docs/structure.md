---
title: Repository structure
description: Layout of the guava-os repository.
---

# Repository structure

```text
guava-os/
├── ADR_001.md             # source of truth — system boundaries & ownership
├── AGENTS.md              # repo routing (top)
├── .omp/                  # OMP harness wiring
│   ├── AGENTS.md          # manager loop
│   ├── RULES.md           # hard rules
│   ├── mcp.json           # Linear MCP (last-resort fallback)
│   ├── hooks/pre/session-gate.ts   # runs `guava-os work --all` on open
│   └── skills/            # symlinks → ~/.agents/skills/
├── .guava-os/             # the control-plane CLI + config
│   ├── src/               # cli, linear-client, sync, triage, work, register, doctor, …
│   ├── tests/             # vitest suite
│   ├── registry/projects.yml   # governed projects
│   ├── config.json        # team/project/domains/domainAgents/types/readiness/invariants
│   ├── bin/guava-os       # CLI shim
│   └── package.json       # "type": "module"
├── docs/                  # architecture, workflow, governance
│   ├── architecture/      # operating contract, linear-conventions, sync-convergence, routing
│   └── governance/
├── manual/                # this manual (Astro Starlight site)
│   └── src/content/docs/  # routing + cross-cutting + roles + skills
└── (gorp/                 # retired — historical, not run)
```

- **Skills** (the 24 authored) live in `~/.agents/skills/`, not the repo.
- **Authorization**: GitHub branch protection + CI (`.github/workflows/ci.yml`).
- **Workflow state**: Linear (issues + comment threads).