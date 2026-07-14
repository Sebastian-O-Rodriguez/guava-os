---
name: verify
description: Run quality gates — type check, test, build.
---

> **`CURRENT` / `ADAPTER_SPECIFIC` (Claude Code) — labeled at Wave A closeout,
> 2026-07-14.** Quality-gate skill (typecheck, tests, build); makes no
> execution-authority claims. Note: the `expo export` step is a RoutineMe-era
> leftover and may not apply to this repo.

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
