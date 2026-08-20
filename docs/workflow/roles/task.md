# Role: task (implement)

`task` is the general implementer. It takes a scoped issue and produces working,
verified code on `dev/task`.

```mermaid
flowchart TD
    S[task: read the issue] --> U[understand ## Scope + ## Acceptance]
    U --> I[implement in isolated worktree]
    I --> V[verify: types + test + scope]
    V -->|fail| I
    V -->|pass| C["commit GUA-### → dev/task"]
    C --> H[handoff: pm comment result + pm move In Review]
```

## Steps

1. **Read** `pm get-issue <id>` — Why / Scope / Acceptance / Dependencies.
2. **Implement** in an isolated worktree; stay inside the issue's `## Scope`.
3. **Verify** — `verify` skill (types, test, scope-check the diff).
4. **Commit** — subject `GUA-### <outcome>`, push to `dev/task`.
5. **Hand off** — `pm comment <id>` with changed files + commit + verification,
   then `pm move <id> --status "In Review"`.

Patterns: test-first, thin handlers, one concern per change. Anti-patterns:
skipping the diff scope-check, reaching for new deps, implementing without
reading the existing layer.