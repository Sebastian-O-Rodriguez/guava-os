# Repository Layout & Operating Model (CANONICAL)

> **Authority:** `ADR_001.md` → this doc. This is the single canonical
> explanation of where GOS repositories live and how they are operated.
> Other docs (AGENTS.md, playbooks, skills) point here instead of duplicating
> it.

## Layout

```text
~/dev/guava-os               canonical stable GOS runtime (the ONLY checkout agents use)
~/dev/repos/<project>/       project repos — their own cwd / working root
<temp>/guava-os-*            temporary GOS dev clones (create on demand, remove after merge)
```

| Path | Role | Rules |
|---|---|---|
| `~/dev/guava-os` | The stable runtime: guava-os tooling + skills + registry, all tracked on clean `main`. | **Never develop here.** Only merged/approved state. All agents execute from it. Push only from here. |
| `~/dev/repos/<project>/` | Project working roots (guavabi, bell-diagnostic, …). | Agents work here; each project is its own repo (registered in `.guava-os/registry/projects.yml`). |
| Temporary dev clones | Scratch copies for GOS self-development. | Create on demand, remove after merge. **There is no permanent guava-os-dev checkout.** |

## Operating Model

1. **Project work runs from the project's own repo root.** Agent sessions for a
   project operate in `~/dev/repos/<project>/`; the project is the cwd/working
   root.
2. **guava-os is shared stable infrastructure.** Its tooling (`guava-os
   pm|doctor|status|validate|next|launch|register` via `.guava-os/bin/guava-os`)
   is invoked from the guava-os checkout — that is where the CLI resolves
   skills. Do not run it from inside a project repo expecting it to resolve
   there.
3. **Do not develop in the stable checkout.** All GOS changes land here only as
   reviewed, merged, tested commits on `main`.
4. **Self-changes land via branch model.** Convention: `dev/<domain>` (one per
   domain; `docs/architecture/linear-conventions.md`). PR to `staging`, then
   `production`.
5. **Merge/test before stable rollout.** Every change passes `tsc --noEmit` +
   vitest before it is considered for merge.
6. **Durable archives.** `~/dev/guava-archives/` content is durable history;
   nothing ephemeral goes there.

## Branching (per project)

```
production   ← protected: PR from staging + required review + required CI
staging      ← protected: PR from dev/* + QA review + required CI
dev/backend   dev/frontend
```

See `docs/architecture/linear-conventions.md` and
`docs/architecture/guava-os-operating-contract.md`.

## Related

- Registry: `.guava-os/registry/PROJECTS-SCHEMA.md`.
- Workflow derivations: `docs/architecture/linear-conventions.md`.