# guava-os Playbook

The control-plane operating loop. guava-os understands projects, plans work,
manages Linear, and reviews results. It never executes — gorp executes
(ADR_001).

Authority: `ADR_001.md` → `docs/architecture/guava-os-gorp-contract.md` →
this playbook → skills (`.omp/skills/`) → tools (`.guava-os/src/`).

Layout & operating model (where checkouts live, dev isolation rules):
`docs/architecture/repo-layout.md`.

## Bootstrap Order

Every governed project MUST complete the bootstrap before any gorp-facing
issue (execute / scaffold) is picked:

1. **Create a minimal repo** — a real git repository on this machine.
   `guava-os register` creates it if missing (`git init`), but the
   operator may also clone it by hand. A bare path or a registry entry with
   no corresponding directory is NOT sufficient.
2. **Register with canonical git remote** — `guava-os register <id> --repo
   <path> --remote <url>`. This records `git_remote` (GOS-31) in
   `.guava-os/registry/projects.yml` and sets the local `origin`
   remote. `guava-os doctor` verifies the registry remote matches the local
   origin.
3. **Execute / scaffold** — NOW a gorp-facing issue is ready. gorp fails
   closed with a canonical error naming the bootstrap order when a project
   is not registered, has no `repo_path`, or the repo directory does not
   exist.

> **Planning may precede registration, but NO gorp-facing execute/scaffold
> issue is ready until register + repo (with remote) hold.**

### Worked Example: RDI-style onboarding

```bash
# 1. Plan in Linear (issues created, dependencies linked) — can happen before step 2.

# 2. Create the repo and register it in one command:
guava-os register reusable-diagnostic-engine \
  --repo ~/dev/repos/reusable-diagnostic-engine \
  --remote https://github.com/Sebastian-O-Rodriguez/reusable-diagnostic-engine.git
#  => repo dir created (git init), registry entry appended, origin set

# 3. Verify:
guava-os doctor
#  => git-remote check should list the new project as "ok"

# 4. Now gorp execution / scaffold issues can be dispatched for this project.
```


## Loop

1. **Understand** — operator intent + live state: Linear board, project
   registry, target repo docs. Skill: `planning`.
2. **Plan** — decompose into a sprint: a container parent + scoped children,
   OR a standalone dependency chain (top-level deliverables wired by
   `blocks`). Each deliverable: one persona label, measurable acceptance,
   explicit dependencies. **Scope granularly — one issue = one observable
   outcome fit for a default/smol worker; split anything needing a stronger
   model.** Standalone deliverables are valid work (GUA-111);
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
