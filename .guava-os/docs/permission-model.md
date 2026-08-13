# Agent permission model — v1 (GOS-45 / GUA-178)

Prompt decides intent; permissions decide authority; **repo ownership = write
authority**. This is the first repo-scoped write-authority model. v1 is
deliberately small: **launcher + role manifest + path allowlist**. No
IAM/Kubernetes/Vault.

## Roles and writable roots

Defined in `.guava-os/registry/roles.yml` (single source of truth). Each role
maps to allowed **writable-root specifiers**, resolved to absolute repo paths
at launch against `.guava-os/registry/projects.yml`:

| Role | Writable roots | Meaning |
|---|---|---|
| `project-agent` | `self` | Only its own project repo (resolved from `--project`) |
| `gos-agent` | `guava-os` | The guava-os repo only |
| `reviewer` | *(none)* | Read/test only — no writes |
| `operator` | `*` | Every registry repo — the only cross-repo writer |

The manifest never hardcodes a filesystem path (except the `guava-os`
*registry id*, which the registry owns).

## Launch

```
guava-os launch --role <role> --project <registry-id> [--json]
```

1. Read the role manifest and project registry.
2. Resolve `--project` to a registry id → `repo_path` (Linear project names
   resolve too, via the existing registry lookup).
3. Bind the writable-root allowlist from the role.
4. For a single-owned-repo role (`project-agent`, `gos-agent`), create an
   isolated git worktree under the machine-local state root — never in the
   consumer working tree; the worktree dir joins the allowlist.
5. Emit the result: role, project, writable roots, worktree, and the stable
   GOS CLI path (`<repo>/.guava-os/bin/guava-os`).

## Enforcement (fail-closed)

`.guava-os/src/path-guard.ts` is the single enforcement primitive. A write is
allowed **iff** its absolute path is equal to, or strictly inside, at least one
writable root. Otherwise it is rejected **before anything is written** (no
partial write), with a classified error:

- `NO_WRITABLE_ROOTS` — the role has no writable roots (reviewer).
- `OUT_OF_SCOPE` — the path escapes the allowed roots.

Other repos are therefore read-only/invisible to a launched agent: they are
simply not in its allowlist. The guard is deterministic and lexical
(`path.resolve` + `path.relative`); it does not chase symlinks or mount
boundaries (documented v1 limitation; container/OS sandboxing is a non-goal,
consistent with gorp).

## Cross-repo defect flow

A `project-agent` has write authority over ONLY its own repo. When it detects
a defect in a foreign project's repo or in guava-os itself:

1. **Record** — the agent records evidence in its own worktree/handoff note:
   affected paths, observed vs expected behavior, repro steps, and any relevant
   hashes/versions. It does **not** patch the foreign repo.
2. **Handoff** — it creates a GOS issue (Linear ticket) under the owning
   project, attaching the evidence. The `operator` role owns approvals and
   cross-repo handoffs (the only cross-repo writer).
3. **Fix** — a GOS maintainer (or `gos-agent`) fixes the defect in the owning
   repo through its own governed path.
4. **Retry** — the project agent retries against stable GOS once the fix
   lands, never by reaching into the foreign checkout itself.

Repo ownership == write authority: the project agent cannot silently "help" by
patching a repo it does not own; evidence + handoff is the only permitted
response.

## v1 scope

Launcher + role manifest + path allowlist. Explicitly **not** included:
IAM/K8s/Vault, containers/OS sandboxing, symlink chasing, cross-host
coordination, or OS-level mount isolation.
