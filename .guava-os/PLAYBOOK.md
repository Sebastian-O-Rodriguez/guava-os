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
2. **Plan** — decompose into a sprint: a container parent + scoped children,
   OR a standalone dependency chain (top-level deliverables wired by
   `blocks`). Each deliverable: one persona label, measurable acceptance,
   explicit dependencies. Standalone deliverables are valid work (GUA-111);
   chains generate via `sprint generate --parent <chain-head>` (GUA-137).
   Work spanning several containers unifies into ONE document via multi-parent
   `sprint generate` (GOS-42). A `blocks` edge means a hard result-dependency,
   never "roughly before" preferred order (GOS-44). Skill: `planning`.
3. **Write Linear** — create/update issues, dependency links, statuses per
   GOS-21 (native fields first; labels for metadata only; one persona label).
   Wrong/early dependency edges are fixable: `pm unlink <id> --blocks/
   --blocked-by` removes them cleanly (GOS-41) — no hand-editing Linear.
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

> **Independent work = simultaneously eligible, not concurrent execution.**
> Zero-indegree tasks in one compiled graph are ready together and may be
> dispatched independently, but that is DAG eligibility — it is NOT a claim
> of proven concurrent OMP-worker execution. Concurrent/parallel worker
> execution is a separate, not-yet-built capability; do not plan or document
> the loop as if it exists (GOS reconcile).

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
