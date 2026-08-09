---
name: verify
description: Run quality gates — type check, test.
---

## Quality Verification

Run the quality gates for guava-os. Usage: `/verify [target]`

Targets:

- `types` — `npx tsc --noEmit -p .guava-os/tsconfig.json`
- `test` — `npx vitest run`
- (empty) — run all gates in sequence

Report results as a table:

| Gate | Status | Details |
|------|--------|---------|

Arguments: `$ARGUMENTS`

## Uses

- `npx tsc --noEmit -p .guava-os/tsconfig.json` — types gate
- `npx vitest run` — test gate
