# Pre-hooks

> Authority: `.claude/hooks/pre/` → this doc. Deterministic OMP session gates —
> pure code, zero AI. Each hook is one script, one concern.

## The three hooks

| Hook | Repos | Event | Behavior |
|---|---|---|---|
| `session-report` | guava-os (control plane) | `session_start` | Runs `gos work --all`, reports per-project status. **Never blocks** — the planning surface must run even when nothing is ready. |
| `dispatch-gate` | governed project repos | `session_start` + `tool_call` | Runs `gos work` from the project cwd. If no `ready-for-work` issues, blocks exec tools (`bash`/`edit`/`write`/`task`/`eval`) and reports "close session". Unregistered cwd → gate inactive. |
| `context-gate` | any repo that fans out workers | `session_start` + `tool_call` (`task` only) | Requires `# CONTEXT-MARKER <sha256>` in the payload (stamped by `manual/scripts/inject.mjs`); blocks raw `task` calls. |

## Why they are separate

- **Planning** (guava-os) never blocks — no ready work is exactly when planning is needed.
- **Execution** (project repos) blocks only when there is nothing dispatchable — idle-session prevention.
- **Dispatch integrity** (`context-gate`) is orthogonal to board state — it enforces assembled context on every `task` fan-out.

## Overrides

- `GUAVA_OS_ALLOW_NO_WORK=1` — bypass `dispatch-gate`.
- `GUAVA_OS_ALLOW_RAW_DISPATCH=1` — bypass `context-gate`.

## Discovery & wiring

OMP 18.x auto-discovers project hooks only from `.claude/hooks/pre/` and
`.claude/hooks/post/` (and `.codex/hooks/`); `.omp/hooks/` is **not** scanned.
Hooks must be regular files, not symlinks — OMP's hook loader skips symlinks.

guava-os ships the canonical hook sources; governed project repos **copy** them:

- `guava-os/.claude/hooks/pre/session-report.ts` (guava-os only)
- `guava-os/.claude/hooks/pre/context-gate.ts` (guava-os + project repos)
- `guava-os/.guava-os/hooks/dispatch-gate.ts` (copied into project repos only —
  not required in guava-os, so planning never blocks)