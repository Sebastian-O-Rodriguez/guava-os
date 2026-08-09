# guava-os Playbook

The control-plane operating loop. guava-os understands projects, plans work,
manages Linear, and reviews results. It never executes — gorp executes
(ADR_001).

Authority: `ADR_001.md` → `docs/architecture/guava-os-gorp-contract.md` →
this playbook → skills (`.omp/skills/`) → tools (`.guava-os/src/`).

Layout & operating model (where checkouts live, dev isolation rules):
`docs/architecture/repo-layout.md`.

## Loop

1. **Understand** — operator intent + live state: Linear board, project
   registry, target repo docs. Skill: `planning`.
2. **Plan** — decompose into a sprint: parent + scoped children, one persona
   label each, measurable acceptance, explicit dependencies. Skill: `planning`.
3. **Write Linear** — create/update issues, dependency links, statuses per
   GOS-21 (native fields first; labels for metadata only; one persona label).
   Skill: `linear`.
4. **Refresh graph** — re-sync the planning snapshot from Linear; validate
   board health; surface blocked and invalid work. Skill: `planning`.
5. **Select ready work** — pick executable issues per persona; generate
   launch directives. Skill: `planning`.
6. **Send approved request** — hand the operator-approved sprint to gorp for
   graph compilation. guava-os decides; gorp compiles. Skill: `execution`
   (boundary step — mechanics belong to the gorp playbook).
7. **Review result** — verify acceptance criteria against execution evidence;
   approve / reject / retry / promote decisions. Skills: `review`, then
   `linear` to update the board.
8. **Refresh graph** — re-sync and loop.

## Ownership

- guava-os owns: planning, decomposition, orchestration decisions, Linear
  integration, review/promotion workflow, project registry.
- gorp owns: execution graphs, dispatch, gates, audit — see
  `gorp/PLAYBOOK.md`.
- Agents reach Linear only through guava-os tooling — never Linear MCP
  directly (GOS-19/GOS-20).

## Skills

| Skill | Owns |
|---|---|
| `planning` | read pattern, sprint shape, board health, ready-work selection |
| `linear` | all Linear operations via pm tooling |
| `review` | acceptance review, boundary review, result review, retrospective |
| `execution` | handoff to gorp + execution flow (shared with gorp playbook) |
| `handoff`, `verify` | session continuity, quality gates (utilities) |
