---
name: writing-for-agents
description: "Author documents agents reach by pointer — skills, AGENTS.md/CLAUDE.md, runbooks, context docs — so they're loadable, scannable, and machine-actionable. Use when writing or reviewing any agent-facing doc."
domain: core
role: any
order: 4

metadata:
  author: guava-os
  version: "0.1.0"
---

## Writing for Agents

A document an agent reaches by pointer must be skimmable and machine-actionable
(mattpocock `writing-for-agents`, distilled).

## Rules

- **Frontmatter first**: name + a one-line "what this is + when to use it".
- **Lead with the rule**, then the why, then a minimal example.
- **Imperative, fragment-per-line**; no narrative filler, no hedging.
- One concept per heading; a table over a paragraph when it's a matrix.
- **State the trigger AND the non-goal** (when NOT to use it).
- Every instruction must be executable without dialog: name the file, the
  command, the acceptance, the output.
- **Shared vocabulary**: define domain terms once; don't re-explain basics.

## Canonical structure

1. Purpose (one line) · 2. Trigger / when to use · 3. Steps or rules
4. Anti-patterns · 5. Uses (exact commands/skills) · 6. Source.

## Uses

- Authoring SKILL.md, AGENTS.md, runbooks, handoff docs
- Reviewing agent docs — `diagrammatic-review` for layout, this for content

## Source

mattpocock `productivity/writing-for-agents`.