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

## Authority — read Gorp first

This file is a **tool adapter**, not architecture authority. Read the four
Gorp source-of-truth docs first:

1. `~/dev/gorp/VISION.md` — product intent
2. `~/dev/gorp/SYSTEM-MODEL.md` — ownership and flow
3. `~/dev/gorp/CURRENT-STATE.md` — what exists (canonical status)
4. `~/dev/gorp/ARCHITECTURAL-INVARIANTS.md` — non-negotiable rules

Then: Gorp runtime contracts and tests (`~/dev/gorp/runtime/control/`,
`~/dev/gorp/specs/runtime/`) → this project's docs → tool files like this one
→ historical docs. **When anything conflicts, Gorp wins.**

Rules for this and every Claude file here: do not redefine GOS architecture in
tool files; do not store project truth only in Claude files — when truth
changes, update canonical Gorp or project docs; keep Claude files thin and
tool-specific.

The `.claude/agents/*` files are project-owned Claude Code personas (the old
global persona layer was retired in the 2026-07 cleanup). Execution state is
owned by the Gorp control plane; it is never derived from an issue tracker.

## Stack

TypeScript + Vitest. Build / quality gates:

```bash
npx vitest run    # tests
npx tsc --noEmit  # type check
```
