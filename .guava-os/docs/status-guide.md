# `status` — executable queue by role

Groups open work by role (the six OMP agent types). Read-only, stdin-driven.

```bash
cat issues.json | guava-os status
cat issues.json | guava-os status --json
```

## Categories

- **EXECUTABLE** — Todo, exactly one role label, active parent, unblocked.
- **NOT_PROMOTED** — Backlog (exists, not scheduled).
- **BLOCKED** — unresolved `blocks` dependency.
- **INVALID** — protocol violation (missing/multiple role label, inactive parent,
  orphan).
- **PARENTS** — container health.

`(none)` for a role means no executable work — not an error.

## Exit

`0` if any executable work exists; `1` if none (the `work` command's gate uses
the same signal against live Linear).