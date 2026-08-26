---
name: planning
description: "Sprint planning and board health — the guava-os default planning pattern. guava-os decomposes into scoped Linear deliverables; OMP subagents execute; writes go through the linear skill."
domain: pm
role: manager
order: 3

metadata:
  author: guava-os
  version: "0.2.0"
---

## Planning

guava-os owns planning (ADR_001). Work is decomposed into scoped Linear
deliverables; OMP subagents execute them (dispatch skill); GitHub enforces
review and merge; Linear is the workflow state of record.

## Read pattern — default, in order

1. `AGENTS.md` → playbooks (entry routing).
2. Authority docs, only as deep as the decision requires: `ADR_001.md` →
   `docs/architecture/guava-os-operating-contract.md` →
   `docs/architecture/linear-conventions.md`.
3. `.guava-os/config.json` — team, project, domains, domainAgents, statuses, invariants
   (e.g. `max_subtasks_per_parent`), branch pattern. Defines the shape any
   sprint must fit.
4. Tooling capability — `.guava-os/src/cli.ts` + `linear-client.ts` when unsure
   an operation exists.
5. Live Linear state, read-only — never propose writes before observing.
6. `.guava-os/registry/projects.yml` — is the target repo registered?
7. Target domain — repo README → status/sprint docs → conventions → current
   work state. Sprint scope comes from here, not the agent's head.
8. Synthesize plan + friction → operator confirmation.
9. Execute writes via the `linear` skill.
10. Verify with the board read-back.

## Operational loop (canonical)

```
Linear backlog → guava-os planning → scoped deliverables (issues) →
ready-work selection → OMP subagents (dispatch skill) → dev/<domain> branch →
QA review → GitHub merge to staging → second review → production → Linear refresh
```

guava-os plans and decides; OMP executes via subagents; GitHub enforces
review/merge; workers execute; Linear is the workflow state of record.

## Work shapes (decide which before planning)

- **Container** = a Linear issue with ≥1 child (native parentId pointing at it).
  A container groups deliverables and is **never executable itself**. Sprint
  parents are containers.
- **Deliverable** = a Linear issue with **no children**. Executable when: status
  Todo, one domain label + `ready-for-work`, and no unresolved native blockers. Child or
  standalone — both equally eligible.
- **Standalone dependency chain** = a set of top-level deliverables wired by
  native `blocks` edges. The chain head (unblocked issue) is executable.

## Sprint model

- A sprint is a Linear **container** parent + children (deliverables), OR a
  standalone dependency chain.
- Children per container ≤ `max_subtasks_per_parent` (config). **Enforced** —
  `validate` raises V305 (`subtask_overflow`, error) when an active container
  exceeds the cap.
- Every deliverable: one domain label (plus one type + one readiness label);
  description with Why / Scope / Acceptance criteria (template:
  `docs/architecture/linear-conventions.md`).
- Workflow state = Status; labels carry metadata only (GOS-21).
- One artifact: the Linear issue **is** the task contract and the handoff
  record. There is no separate SprintDocument.

## Granular scoping — worker-fit deliverables

The point of guava-os is to create SMALL, well-scoped issues and let OMP
subagents run them in parallel. A worker (default/smol model tier) completes a
SINGLE-purpose task; it fails or runs empty on an over-broad one (the
GUA-67 / GUA-155 empty-turn + timeout failure mode). Scope for the worker, not
the ambition.

Rules:
- **One issue = one observable outcome**, doable in a single worker turn under
  the `default` (or `smol`) tier. If a task needs a stronger model than
  `default`, it is TOO BIG — split it. `default` is the max; `smol` for
  mechanical pieces; `slow` should be unnecessary when scoping is right.
- **Narrow scope**: every deliverable gets a tight `allowedPaths` and explicit
  "Out of scope". A worker without a bounded scope drifts into read-only
  exploration instead of editing.
- **Tight acceptance**: numbered, observable, pass/fail, checkable (e.g.
  "docs/foo.md contains X", "`npm test` green").
- **Big work = a container/chain of small deliverables**, run in parallel by
  OMP — never one giant issue chewed in a single worker run.
- **Decompose at planning, not execution.** Splitting an oversized ticket is a
  guava-os planning act, done before dispatch.

## MCP-assisted planning + issue scoping

For dependency-heavy sprints, research decisions through MCP tools **before**
scoping issues, so the plan rests on evidence rather than the agent's head.

1. **Research first via MCP.** Settle library / provider decisions before
   creating issues. Capture each decision as **version + license + domain** in
   the container or deliverable description.
2. **Granular domain deliverables.** One observable outcome per issue, sized
   for a single worker turn, exactly one domain label, pass/fail acceptance.
3. **Containers cap.** Group related deliverables under containers, each ≤
   `max_subtasks_per_parent`. End the dependency set with a **QA gate issue**.
4. **Forward dependency DAG.** Wire `blocks` edges so work flows forward to the
   QA gate. Every edge is a hard result-dependency (GOS-44); never serialize
   independent work — 0-indegree tasks run in parallel.
5. **Legacy reconciliation.** Cancel subsumed issues, re-link moved deps, keep
   the board ruthless.

## Hard dependency vs preferred order (GOS-44)

A `blocks` edge means **"downstream work consumes the upstream result"** — a
hard result-dependency. It is NOT a sequencing preference.

- Use an edge only when the downstream deliverable actually needs the upstream
  output to proceed. Apply the *results-needed* test: "would downstream fail
  without the upstream result?" If no → it is not a dependency.
- **Never use `blocks` for "do roughly before" ordering.** That needlessly
  serializes independent work (OMP pipelines edged tasks instead of running
  them in parallel).
- **Independent work stays independent.** For concurrent, non-sequenced work use
  container children or unblocked standalones — OMP runs 0-indegree tasks in
  parallel.
- Fix a wrong/early edge cleanly: `pm unlink <id> --blocks/--blocked-by`
  (GOS-41).

## Domain → agent

An issue's **domain** label selects the OMP agent via the `domainAgents` map
in `.guava-os/config.json` (`qa`→`reviewer`, `security`→`security-reviewer`,
`frontend`→`designer`, else→`task`). The `dispatch` skill dispatches.

## Identity (canonical IDs)

- Plan aliases (`S0`/`S1`/`R1`) are drafting shorthand only — allowed **before**
  Linear creation.
- Immediately on creation, adopt the canonical `GUA-###` identifier (printed by
  `pm create`) as the issue's sole identity. Use it for dependencies, reports,
  commit subjects, and execution handoff.
- The write path rejects non-canonical refs (`pm link` / `pm create --parent`),
  so never pass a raw alias into tooling after creation.

## Uses

- `pm search`, `pm get-sprint`, `pm get-project` — read-only board state
- `validate`, `status`, `next` — board health, ready-work directives
- `.guava-os/registry/projects.yml` — project registration check
- Writes: via the `linear` skill — planning decides what, linear writes
- `pm link` / `pm unlink` — add / remove dependency edges (GOS-41)
- Dispatch: see the `dispatch` skill
