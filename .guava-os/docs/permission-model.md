# Authorization

Authorization is a repository concern, owned by **GitHub** — not a local
permission model and not a custom execution engine (ADR_001 Amendment 2).

- Protected branches: `production`, `staging` (and one `dev/<role>` per role).
- Required pull-request review + required CI status checks.
- Workers never merge; they push to `dev/<role>` and QA/operator merge upstream.

See `docs/architecture/github-authorization.md` and
`docs/architecture/guava-os-operating-contract.md`.

> **Removed.** The v1 `launch` command + role manifest (`.guava-os/registry/roles.yml`
> writable-roots allowlist) was removed 2026-08-20; GitHub branch protection +
> OMP isolated worktrees replace it.