# Doctor UX Proposal: `--local-only`

## Problem

`guava-os doctor` without stdin reports Linear-dependent checks as failures,
confusing operators who only want to validate local setup.

## Recommendation

**Option B: `doctor --local-only`**

## Design

### Without flag (current behavior preserved)

```bash
guava-os doctor
```

Runs ALL checks. Linear-dependent checks fail if no stdin provided.
Exit 1 if any check fails.

### With flag

```bash
guava-os doctor --local-only
```

Runs ONLY filesystem/config checks. Skips:
- `linear` (data availability)
- `labels` (persona labels in Linear)

Exit 0 if all local checks pass.

## Check Classification

| Check | Type | Included in --local-only |
|-------|------|--------------------------|
| `config` | local | yes |
| `claude-md` | local | yes |
| `agents` | local | yes |
| `protocol` | local | yes |
| `gitignore` | local | yes |
| `linear` | remote-dependent | no |
| `labels` | remote-dependent | no |

## Why Not Option A

Option A (exit 0 when only stdin-dependent checks fail) introduces implicit
exit code semantics. An operator running `doctor` in CI would get exit 0
despite incomplete validation, with no indication that checks were skipped.

## Why Not Option C

Option C (current behavior) leaves the confusion. Operators repeatedly
ask why doctor fails when they haven't piped Linear data.

## Exit Semantics

| Scenario | Exit Code |
|----------|-----------|
| `doctor` — all pass | 0 |
| `doctor` — any fail | 1 |
| `doctor --local-only` — all local pass | 0 |
| `doctor --local-only` — any local fail | 1 |

## Human Output Difference

With `--local-only`, append to output:

```
(--local-only: 2 remote-dependent checks skipped)
```

## JSON Output Difference

Add `skipped` array to JSON output when `--local-only`:

```json
{
  "checks": [...],
  "skipped": ["linear", "labels"],
  "mode": "local-only"
}
```

## Implementation Notes

- Add `--local-only` to flag parsing in cli.ts
- Tag each check with `type: "local" | "remote-dependent"` in doctor.ts
- Filter checks before execution when flag is present
- No behavior change to existing `doctor` command (backwards compatible)
