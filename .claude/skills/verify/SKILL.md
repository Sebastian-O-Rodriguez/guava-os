---
name: verify
description: Run quality gates — type check, lint, format, build, test.
---

## Quality Verification

Run the quality gates for RoutineMe. Usage: `/verify [target]`

Targets:
- `types` — `npx tsc --noEmit`
- `lint` — `npx eslint . --max-warnings 0`
- `format` — `npx prettier --check .`
- `build` — `npx next build`
- `test` — `npx vitest run`
- (empty) — run all gates in sequence

Report results as a table:
| Gate | Status | Details |
|------|--------|---------|

Arguments: `$ARGUMENTS`
