# Pre-hooks

> Authority: `.omp/hooks/pre/` → this doc. Deterministic OMP session gates —
> pure code, zero AI. Each hook is one script, one concern.

## The three hooks

| Hook | Repos | Event | Behavior |
|---|---|---|---|
| `session-report` | guava-os (control plane) | `session_start` | Runs `gos work --all`, reports per-project status. **Never blocks** — the planning surface must run even when nothing is ready. |
| `dispatch-gate` | governed project repos | `session_start` + `tool_call` | Runs `gos work` from the project cwd. If no `ready-for-work` issues, blocks exec tools (`bash`/`edit`/`write`/`task`/`eval`) and reports "close session". Unregistered cwd → gate inactive. |
| `context-gate` | any repo that fans out workers | `tool_call` (`task` only) | Requires `# CONTEXT-MARKER <sha256>` in the payload (stamped by `manual/scripts/inject.mjs`); blocks raw `task` calls. |

## Why they are separate

- **Planning** (guava-os) never blocks — no ready work is exactly when planning is needed.
- **Execution** (project repos) blocks only when there is nothing dispatchable — idle-session prevention.
- **Dispatch integrity** (`context-gate`) is orthogonal to board state — it enforces assembled context on every `task` fan-out.

## Overrides

- `GUAVA_OS_ALLOW_NO_WORK=1` — bypass `dispatch-gate`.
- `GUAVA_OS_ALLOW_RAW_DISPATCH=1` — bypass `context-gate`.

## Canonical source & wiring

guava-os ships canonical hook sources; governed project repos **copy** them
into their own `.omp/hooks/pre/` (not symlink — OMP's hook loader only picks up
regular files, so symlinked hooks silently don't load):

- `guava-os/.omp/hooks/pre/session-report.ts` (guava-os only)
- `guava-os/.omp/hooks/pre/context-gate.ts` (copied into project repos)
- `guava-os/.guava-os/hooks/dispatch-gate.ts` (copied into project repos — this
  path is not auto-loaded in guava-os, so planning never blocks)
