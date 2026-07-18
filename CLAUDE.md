# Guava-OS

Read-only classifier CLI for Linear issue graphs — developer infrastructure,
never runs in production. A **Gorp consumer**, bound to canonical Gorp at
`~/dev/gorp` via `.gorp/gorp.yml`. The `.guava-os/` CLI reads Linear as an input
format only; it does not execute, mutate, or promote work.

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
- Runtime adapter contract — `~/dev/gorp/runtime/adapters/CONTRACT.md`

Persona authority is canonical Gorp (`~/dev/gorp/personas/*`). The
`.claude/agents/*` files are the Claude Code bindings for those personas, not
their authority.

## Authority Hierarchy

Entry-point ordering only — the substance lives in canonical Gorp (above):

| Priority | Source | Owns |
|----------|--------|------|
| 0 | **Human operator** | Priorities, scope, approvals, escalation |
| 1 | **Canonical Gorp** (`~/dev/gorp`) | Governance, execution model, personas, specs — the source of truth |
| 2 | **This CLAUDE.md** | Project identity and stack (entry only) |
| 3 | **`.claude/agents/*`** | Claude Code persona bindings (defer to canonical Gorp personas) |

Execution state is owned by the Gorp control plane; it is never derived from an
issue tracker.

## Stack

TypeScript + Vitest. Build / quality gates:

```bash
npx vitest run    # tests
npx tsc --noEmit  # type check
```
