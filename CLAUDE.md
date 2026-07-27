# Guava-OS

Read-only classifier CLI for Linear issue graphs — developer infrastructure,
never runs in production. A **Gorp consumer**, registered in
`~/dev/gorp/registry/projects.yml`. The `.guava-os/` CLI reads Linear as an
input format only; it does not execute, mutate, or promote work.

## This file is entry only

- This file is an **entry point**, not a source of truth.
- **Do not add process here.**
- **Do not edit architecture here.**
- **Do not duplicate governance docs here.**

To change how work is governed, planned, or executed, update the **canonical
Gorp docs** — not this file.

## Canonical governance (Gorp — reference only)

Authority lives in Gorp; read it there, never copy it here.

- Overview — `~/dev/gorp/README.md`
- Architecture — `~/dev/gorp/reference/architecture.md`
- Roadmap — `~/dev/gorp/ROADMAP.md`
- Control-plane runtime — `~/dev/gorp/runtime/control/README.md`

The `.claude/agents/*` files are project-owned Claude Code personas (the old
global persona layer was retired in the 2026-07 cleanup).

## Authority Hierarchy

Entry-point ordering only — the substance lives in canonical Gorp (above):

| Priority | Source | Owns |
|----------|--------|------|
| 0 | **Human operator** | Priorities, scope, approvals, escalation |
| 1 | **Canonical Gorp** (`~/dev/gorp`) | Governance, execution model, specs — the source of truth |
| 2 | **This CLAUDE.md** | Project identity and stack (entry only) |
| 3 | **`.claude/agents/*`** | Project-owned Claude Code personas |

Execution state is owned by the Gorp control plane; it is never derived from an
issue tracker.

## Stack

TypeScript + Vitest. Build / quality gates:

```bash
npx vitest run    # tests
npx tsc --noEmit  # type check
```
