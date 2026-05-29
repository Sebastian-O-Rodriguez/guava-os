---
name: verify
description: Run quality gates — type check, test, build.
---

## Quality Verification

Run the quality gates for RoutineMe. Usage: `/verify [target]`

Targets:

- `types` — `npx tsc --noEmit`
- `test` — `npx vitest run`
- `build` — `npx expo export --platform web`
- (empty) — run all gates in sequence

Report results as a table:

| Gate | Status | Details |
|------|--------|---------|

Arguments: `$ARGUMENTS`
