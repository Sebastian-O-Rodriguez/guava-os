> **`DUPLICATE` — DEPRECATED (Wave A closeout, 2026-07-14).** Drifted copy of
> canonical Gorp doctrine (`~/dev/gorp/doctrine/conventions.md`). Not
> authoritative. The GUA/Linear issue semantics below are `ADAPTER_SPECIFIC`
> legacy. See `~/dev/gorp/reference/history/DOCUMENTATION-AUTHORITY-MAP.md`.

# Conventions

## Git

- **Branches**: `feat/GUA-{id}-{slug}`, `fix/GUA-{id}-{slug}`, `chore/GUA-{id}-{slug}`
- **Commits**: `type(scope): description [GUA-{id}]`
- **Scopes**: `app`, `db`, `ui`, `infra`, `docs`
- **One branch per parent issue** — all subtasks commit to same branch
- **Never push directly to main** — feature branches + PRs

## Labels

- `architect` — schema, contracts, system design
- `backend` — API routes, queries, mutations, tests
- `frontend` — components, pages, UI, interactions

## Issue Semantics

- **Parent issues** — containers for scope, owned by robo for decomposition. Builders NEVER claim parent issues.
- **Subtasks** — agent-level executable work, labeled with ONE persona. Builders execute subtasks ONLY.
- **Subtask eligibility** — executable ONLY when ALL: (1) status is `Todo`, (2) persona label matches agent, (3) parent status is `Todo` or `In Progress`, (4) all blockers resolved. `Backlog` is NOT executable.
- **Auto-select** — agents MUST claim the highest-priority eligible subtask immediately. No permission questions when valid work exists. Tie-break: priority → oldest updatedAt → lowest issue number.
- **No executable work** — if no eligible Todo subtasks exist for the persona: report `No executable work available for [persona].` with blocking reason. Do NOT recommend Backlog work, propose future work, or drift into advisory behavior. Stop and wait for robo/human orchestration.
- **Priority mapping (LOCKED)**:
  - Linear 1 / Urgent = **P0** — drop everything
  - Linear 2 / High = **P1** — current sprint
  - Linear 3 / Medium = **P2** — next sprint
  - Linear 4 / Low = **P3** — later
  - Never reinterpret Linear priority labels.

## Code

- TypeScript strict mode
- No `any` types

## Quality

Run before every PR:

```bash
npx vitest run
```
