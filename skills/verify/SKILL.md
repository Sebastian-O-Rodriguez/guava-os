---
name: verify
description: "Run quality gates — type check, test, scope check."
domain: qa
role: reviewer
order: 1
load_when: verification is required
guidance: typecheck + targeted tests | scope-check the diff | report commands + results

metadata:
  author: guava-os
  version: "0.2.0"
---

## Quality Verification

Run the quality gates before a worker commits and before QA approves.

Targets:

- `types` — `npx tsc --noEmit`
- `test` — `npx vitest run`
- `scope` — `git diff --name-only` and confirm every changed file is within the
  issue's allowed scope (no out-of-scope edits)
- (empty) — run all gates in sequence

Report results as a table:

| Gate | Status | Details |
|------|--------|---------|

Arguments: `$ARGUMENTS`

## Uses

- `npx tsc --noEmit` — types gate
- `npx vitest run` — test gate
- `git diff --name-only` — scope gate
