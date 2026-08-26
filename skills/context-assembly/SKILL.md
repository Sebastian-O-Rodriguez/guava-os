---
name: context-assembly
description: "Assemble a worker's context as a compiler: small stable core + explicit task contract + activated guidance + progressive retrieval + measurable verification. Use to build the prompt a dispatched worker receives."
domain: pm
role: manager
order: 8
---

## Context Assembly

Assemble agent context around one principle: **small stable core, explicit task
context, progressive retrieval, measurable verification.** Full skills are
reference material, not default prompt. The worker starts with enough to execute
correctly, then loads deeper guidance only when the task needs it.

## How it works

Run `node manual/scripts/inject.mjs <task.json>` — it reads the task spec +
the skill store and emits a four-tier context:

1. **Core** — pulled from `engineering-principles` (`## Invariants`,
   `## Execution protocol`, `## Completion contract`). Always injected.
2. **Task contract** — objective, scope, exclusions, acceptance, state.
3. **Activated guidance** — short `guidance` bullets for the matched domain.
4. **Available skills** — `skill://<name>` + `load_when`, for progressive
   retrieval. The full SKILL.md body loads only when the agent decides it's
   needed (Anthropic "progressive disclosure"; OpenAI "map, not manual").

## Support data

- Domain decision tree: `manual/scripts/trees.mjs` (question → branch → ordered
  sub-chain), shared by `gen.mjs` (manual mermaid) and `inject.mjs` (routing map).
- Skill metadata: `domain` / `role` / `order` / `load_when` / `guidance` in each
  SKILL.md frontmatter.

## Rules

- Never inject full skill bodies by default — advertise, don't repeat.
- The core is stable and shared; keep it in `engineering-principles`, not in code.
- Verification is tracked in the completion contract: commands run, acceptance
  evidence, changed files, deviations, blockers, commit SHA.

## Uses

- `dispatch` hands each worker its context
- `manual/scripts/inject.mjs` builds it; `manual/scripts/gen.mjs` renders the manual