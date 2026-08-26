# `status` — executable queue by domain

Groups open work by domain. Read-only, stdin-driven.

```bash
cat issues.json | guava-os status
cat issues.json | guava-os status --json
```

## Categories

- **EXECUTABLE** — Todo, one domain label + `ready-for-work`, active parent, unblocked.
- **NOT_PROMOTED** — Backlog (exists, not scheduled).
- **BLOCKED** — unresolved `blocks` dependency.
- **INVALID** — protocol violation (missing domain label, readiness gap, inactive
  parent, orphan).
- **PARENTS** — container health.

`(none)` for a domain means no executable work — not an error.

## Exit

`0` if any executable work exists; `1` if none (the `work` command's gate uses
the same signal against live Linear).