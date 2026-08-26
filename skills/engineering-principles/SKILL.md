---
name: engineering-principles
description: "Core engineering red lines for every worker: prove it works, fix root causes, build the lever, sequence verifiable units, protect boundaries, keep the context window small. Apply to any implementation, refactor, migration, or review."
domain: core
role: any
order: 1

metadata:
  author: guava-os
  version: "0.1.0"
---

## Engineering Principles

The non-negotiables applied to every task. Distilled from pstack (poteto's 21
principles), mattpocock, and *The Pragmatic Programmer*. Prefer these over
code-gen habits. They are a checklist to run before declaring done.

## Core (always)

- **Prove it works** — verify against the real artifact: run it, read the
  value, inspect the diff. Never "it compiles" or self-report.
- **Fix root causes** — reproduce first; trace symptom → root; resist nil-guard
  patches that silence a crash.
- **Sequence verifiable units** — break work into small units each ending in a
  verifiable state; order commits/PRs so the sequence proves itself.
- **Build the lever** — for bulk or mechanical work, write the codemod /
  script / skill; the tool is the reviewable artifact, not a vague "done".
- **Subtract before you add** — remove dead weight and redundant validators
  first, then build on the simpler base.
- **Deliver small** — scope for a single verifiable unit, not the ambition.

## Design

- **Foundational thinking** — get core types and data structures right before
  logic; scaffold before feature.
- **Model the domain** — one structure over scattered conditionals.
- **Type-system discipline** — make illegal states unrepresentable; parse
  external data at boundaries; don't lie to the compiler.
- **Boundary discipline** — clamp at boundaries (CLI, config, network, API);
  keep business logic in pure functions inside.
- **Idempotence & clean migration** — converge to the same end state regardless
  of partial runs; migrate callers then delete the old API (no compatibility
  layer).
- **Redesign from first principles** — bolt-on rarely beats treating a new
  requirement as foundational from day one.

## Delegation & economy

- **Guard the context window** — route bulk to subagents; keep summaries in the
  main thread, not raw payloads.
- **Never block on the human** — proceed, present the result, course-correct
  after; reserve confirmation for irreversible actions.
- **Encode lessons in structure** — a lint, type, check, or script, not more
  prose.

## Invariants

- Stay inside contracted scope.
- Follow existing repository patterns.
- Make the smallest correct change.
- Test changed behavior.
- Verify before claiming completion.
- Never fabricate test or command results.

## Execution protocol

1. Inspect relevant implementation and tests.
2. Establish expected behavior with a test.
3. Implement the smallest change.
4. Run targeted verification.
5. Verify acceptance criteria.
6. Commit only task-related changes.

## Completion contract

Return:
- changed files
- acceptance criterion → evidence
- verification commands + results
- scope deviations
- blockers
- commit SHA

## Uses

- Default checklist for any implementation, refactor, migration, or review
- Discipline the `dispatch` skill loads before executing any ticket
- Review axis "standards" in code review