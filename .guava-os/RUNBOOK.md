# Runbook

Operational guide for the guava-os control plane.

## Bootstrap a project

```bash
guava-os register <id> --repo ~/dev/repos/<id> --remote <url>
guava-os doctor
```

## Daily loop

1. **Gate** — `guava-os work --all` (manager) or `guava-os work` (project). If
   nothing, the session closes.
2. **Plan** — `planning` skill: decompose into scoped, role-labeled deliverables.
3. **Write** — `pm create`/`pm update`/`pm link`/`pm move` (the `linear` skill).
4. **Dispatch** — the project session fans out open issues to subagents by role.
5. **Review** — QA (tests + acceptance vs diff), then operator, via GitHub merge.

## Commands

| Command | Purpose |
|---|---|
| `guava-os work` / `--all` | session gate — open work by role; exit 1 = none |
| `guava-os pm …` | all Linear read/write |
| `guava-os status` / `validate` / `next` | board health (stdin) |
| `guava-os doctor` | repo setup checks |

## Authorisation

GitHub branch protection + required review + CI. See
`docs/architecture/github-authorization.md`.

## Troubleshooting

**`work` exits 1 (no work)** — expected; the session gate closes. If you expect
work, check issue status (must be `Todo`), role label (exactly one of the six),
and deps (unblocked).

**`validate` errors** — `V400 missing_role_label` (add one role label), `V401
multiple_role_labels` (keep exactly one), `V303 parent_not_active` (move parent
to Todo/In Progress), `V305 subtask_overflow` (split across parents).

**`pm` fails on link/create** — use the canonical `GUA-###` identifier, never a
plan alias. Auth comes from `LINEAR_API_KEY` (env or `.env`).