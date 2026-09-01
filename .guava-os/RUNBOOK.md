# Runbook

Operational guide for the guava-os control plane.

## Bootstrap a project

```bash
gos register <id> --repo ~/dev/repos/<id> --remote <url>
gos doctor
```

## Daily loop

1. **Gate** — `gos work --all` (manager) or `gos work` (project). If
   nothing, the session closes.
2. **Plan** — `planning` skill: decompose into scoped, domain-labeled deliverables.
3. **Write** — `pm create`/`pm update`/`pm link`/`pm move` (the `linear` skill).
4. **Dispatch** — the project session fans out open issues to subagents by domain.
5. **Review** — QA (tests + acceptance vs diff), then operator, via GitHub merge.

## Commands

| Command | Purpose |
|---|---|
| `gos work` / `--all` | session gate — open work by domain; exit 1 = none |
| `gos pm …` | all Linear read/write |
| `gos status` / `validate` / `next` | board health (stdin) |
| `gos doctor` | repo setup checks |

## Authorisation

GitHub branch protection + required review + CI. See
`docs/architecture/github-authorization.md`.

## Troubleshooting

**`work` exits 1 (no work)** — expected; the session gate closes. If you expect
work, check issue status (must be `Todo`), domain label (exactly one) + `ready-for-work`, and deps (unblocked).

**`validate` errors** — `V400 missing_domain_label` (add one domain label),
`V404 readiness_label_count` (exactly one readiness label), `V303
parent_not_active` (move parent to Todo/In Progress), `V305 subtask_overflow`
(split across parents).

**`pm` fails on link/create** — use the canonical `GUA-###` identifier, never a
plan alias. Auth comes from `LINEAR_API_KEY` (env or `.env`).