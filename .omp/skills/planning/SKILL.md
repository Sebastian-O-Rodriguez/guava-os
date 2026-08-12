---
name: planning
description: Sprint planning and board health — the guava-os default planning pattern. guava-os decomposes; gorp compiles; writes go through the linear skill.
---

## Planning

guava-os owns planning (ADR_001). gorp compiles execution graphs from
operator-approved sprints; gorp never plans.

## Read pattern — default, in order

1. `AGENTS.md` → playbooks (entry routing).
2. Authority docs, only as deep as the decision requires: `ADR_001.md` →
   `docs/architecture/guava-os-gorp-contract.md` → gorp docs →
   `gorp/specs/runtime/sprint.schema.json` (execution-bound planning).
3. `.guava-os/config.json` — team, default project, personas, statuses,
   invariants (e.g. `max_subtasks_per_parent`), branch pattern. Defines the
   shape any sprint must fit.
4. Tooling capability — `.guava-os/src/cli.ts` + `linear-client.ts` when
   unsure an operation exists (e.g. there is no `pm create-project`).
5. Live Linear state, read-only — never propose writes before observing:
   does the project exist? is there an active sprint parent? is the board
   empty?
6. `.guava-os/registry/projects.yml` — is the target repo registered?
   Required for gorp execution.
7. Target domain — repo README → status/sprint docs → conventions → current
   work state. Sprint scope comes from here, not from the agent's head.
8. Synthesize plan + friction → operator confirmation.
9. Execute writes via the `linear` skill.
10. Verify with the board read-back.

## Operational loop (canonical)

```
project root → OMP session → GOS planning → Linear → IssueGraph → executable
work → SprintDocument → gorp graph → persona-aware OMP worker → gates → human
review → approve/reject/retry → promote → Linear refresh
```

guava-os plans and decides; gorp compiles and executes; workers execute;
OMP runs; gorp never touches Linear (ADR_001). guava-os updates Linear from
execution results via `pm`.

## Work shapes (decide which before planning)

- **Container** = a Linear issue with ≥1 child (native parentId pointing at
  it). A container groups deliverables and is **never executable itself**.
  Sprint parents are containers.
- **Deliverable** = a Linear issue with **no children**. A deliverable is
  executable when: status Todo, exactly one persona label, and no unresolved
  native blockers. A deliverable may be a **child** (under a container) or
  **standalone** (no parent) — both are equally eligible. Standalone
  deliverables are VALID work (GUA-111); a clean board must never show
  executable work as zero.
- **Standalone dependency chain** = a set of top-level deliverables wired by
  native `blocks` edges. The chain head (unblocked issue) is executable; the
  rest are blocked until their dependency satisfies. `status` exposes the
  head; `sprint generate --parent <chain-head>` produces the chain document
  (GUA-137). Using a final deliverable as a fake sprint container is
  forbidden — chain mode replaces it.

## Sprint model

- A sprint is a Linear **container** parent + children (deliverables), OR a
  standalone dependency chain generated from a chain head.
- Children per container ≤ `max_subtasks_per_parent` (config). **Enforced** —
  `validate` raises V305 (`subtask_overflow`, error) when an active container
  exceeds the cap. The cap is per container: split work across multiple
  containers (each ≤ cap) rather than overloading one.
- Every deliverable: exactly one persona label; description with Why / Scope /
  Acceptance criteria (template: `docs/architecture/linear-conventions.md`).
- Workflow state = Status; labels carry metadata only (GOS-21).
- Two-artifact model: the Linear board is the planning artifact; the gorp
  SprintDocument (operator-approved, schema-validated) is the execution
  input. `sprint generate` produces the second; `wf plan` compiles it.

## SprintDocument generation (GUA-137)

- `sprint generate --parent <id>` infers shape from the parent:
  - parent has ≥1 child → **container mode**: tasks from its children
    (blocked children excluded, GOS-28).
  - parent has no children → **chain mode**: tasks = parent + transitive
    forward `blocks`-closure; dependencies carried so gorp pipelines them.
- `project.projectId` = the canonical GOS registry id from
  `.guava-os/registry/projects.yml` (`linear_project` field maps the Linear
  name), e.g. Linear `guava-bi` → registry id `guavabi`. Never the Linear
  project name (GUA-135).
- Invalid shapes fail loudly (empty container, missing/backlog parent) —
  never a silent empty SprintDocument.

## Persona → worker (GUA-123)

Each task carries `persona` (the issue's persona label) → graph node →
run-record `profile {persona, model}`. The OMP invocation is persona-aware
(via `GORP_OMP_MODEL` + `GORP_OMP_SYSTEM_PROMPT_APPEND`); persona/profile
definitions live in `.guava-os/personas/<name>/persona.md`.

## Identity (canonical IDs)

- Plan aliases (`S0`/`S1`/`R1`) are drafting shorthand only — allowed **before**
  Linear creation.
- Immediately on creation, adopt the canonical `GUA-###` identifier (printed by
  `pm create`) as the issue's sole identity. Use it for all dependencies,
  reports, the sprint document, and gorp handoff. Plan → create → rewrite
  aliases to the created `GUA-###` ids before linking dependencies.
- The write path rejects non-canonical refs (`pm link` / `pm create --parent`),
  so never pass a raw alias into tooling after creation.


## Uses

- `pm search`, `pm get-sprint`, `pm get-project` — read-only board state
- `validate`, `status`, `next` — board health, ready-work directives
- `.guava-os/registry/projects.yml` — project registration check
- Writes: via the `linear` skill — planning decides what, linear writes
- Execution handoff: `wf plan` (approved sprint → gorp compile-graph); see
  the `execution` skill
