# Repository Layout & Operating Model (CANONICAL)

> **Authority:** `ADR_001.md` → this doc. This is the single canonical
> explanation of where GOS repositories live and how they are operated.
> Other docs (AGENTS.md, playbooks, RUNBOOK, skills) point here instead of
> duplicating it.

## Layout

```text
~/dev/guava-os               canonical stable GOS runtime (the ONLY checkout agents use)
~/dev/guava-archives/        durable history/archive storage (not a git repo)
~/dev/repos/<project>/       project repos — their own cwd / working root
<temp>/guava-os-*            temporary GOS dev clones (create on demand, remove after merge)
```

| Path | Role | Rules |
|---|---|---|
| `~/dev/guava-os` | The stable runtime: guava-os tooling + gorp + skills + registry, all tracked on clean `main`. | **Never develop here.** Only merged/approved state. All agents execute from it. Push only from here. |
| `~/dev/guava-archives/` | Durable offline backup storage. Currently holds `gorp-history.bundle` (the archived pre-merge gorp git history; the same history also lives read-only at `github.com/Sebastian-O-Rodriguez/gorp.git`). | Never delete; never commit into guava-os. |
| `~/dev/repos/<project>/` | Project working roots (guavabi, bell-diagnostic, …). | Agents work here; each project is its own repo (registered in `.guava-os/registry/projects.yml`). |
| Temporary dev clones | Scratch copies for GOS self-development. | Create on demand (`git clone ~/dev/guava-os <tmpdir>`), remove after merge. **There is no permanent guava-os-dev checkout.** |

## Operating Model

1. **Project work runs from the project's own repo root.** Agent sessions for a
   project operate in `~/dev/repos/<project>/`; the project is the cwd/working root.
2. **guava-os is shared stable infrastructure.** Its tooling (`guava-os pm|wf|sprint`
   via `.guava-os/bin/guava-os`) is invoked from the guava-os checkout — that is where
   the CLI resolves `gorp/` and loads skills. Do not run it from inside a project repo
   expecting it to resolve there.
3. **Do not develop in the stable checkout.** All GOS changes land here only as
   reviewed, merged, tested commits on `main`.
4. **GOS dev changes use a temporary isolated clone** (GOS-23/GOS-24/GOS-26):
   clone → branch → change → test → merge to stable `main` → stable checkout
   fast-forwards → **delete the temp clone**.
5. **Dev runs use an isolated state root.** Production gorp state defaults to
   `~/.local/state/gorp` (or `GORP_STATE_HOME`). Scratch/dev runs set
   `GORP_STATE_HOME` to a scratch dir **for that session only** — no persistent
   shell exports, no proof-state leftovers.
6. **Registry isolation when testing registry changes.** Copy
   `.guava-os/registry/projects.yml` and point `GORP_PROJECT_REGISTRY` at the copy
   for the test session. Never write the production registry from a dev run.
7. **Merge/test before stable rollout.** Every change passes guava-os `tsc` +
   vitest and gorp `typecheck` + vitest before it is considered for merge.
8. **Archives are write-once.** `~/dev/guava-archives/` content is durable
   history; nothing ephemeral goes there.

## Restore / Archive Reference

- gorp history (pre-merge, 51 commits, `8b3f58e..465ce81e`):
  - remote archive: `https://github.com/Sebastian-O-Rodriguez/gorp.git`
    (main `465ce81e`, tag `v0.1-foundation`) — read-only.
  - local bundle: `~/dev/guava-archives/gorp-history.bundle`
  - restore: `git clone ~/dev/guava-archives/gorp-history.bundle <dir>`

## Related

- GOS-23 stable-checkout rule · GOS-24 isolated dev environment ·
  GOS-26 invocation pinning (board: Linear project `guava-os`).
- Registry: `.guava-os/registry/PROJECTS-SCHEMA.md`.