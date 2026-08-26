---
name: technical-writing
description: "Layered doc standard (Diátaxis structure + concise style) for docs, RFCs, READMEs, PR descriptions, and commit messages. Use for any prose deliverable."
domain: core
role: any
order: 5

metadata:
  author: guava-os
  version: "0.1.0"
---

## Technical Writing

Diátaxis structure + concise style (pstack `technical-writing`, distilled).

## Diátaxis — pick the type BEFORE writing

- **Tutorial** — learning-oriented; step by step.
- **How-to guide** — task-oriented; solve a problem.
- **Reference** — information-oriented; complete, terse.
- **Explanation** — understanding-oriented; background/rationale.

One doc = one type. Don't blend tutorial with reference.

## Style

- Trim: fragments over sentences; cut hedging ("might", "perhaps", "just").
- Active voice, present tense; concrete nouns, exact names.
- Code blocks carry language tags; errors/paths verbatim.
- Conventional Commits: `type(scope): subject` ≤ 50 chars; body = why, not what.
- PR description: what + why + how to verify + out-of-scope.

## Uses

- README / RFC / docs authoring, PR descriptions, commit messages
- Pair with `writing-for-agents` (content) and `diagrammatic-writing` (layout)

## Source

pstack `technical-writing` (Diátaxis + Google dev style + STE).