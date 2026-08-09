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

## Sprint model

- A sprint is a Linear parent issue + children (native parent/child).
- Children per parent ≤ `max_subtasks_per_parent` (config).
- Every child: exactly one persona label; description with Why / Scope /
  Acceptance criteria (template: `docs/architecture/linear-conventions.md`).
- Workflow state = Status; labels carry metadata only (GOS-21).
- Two-artifact model: the Linear sprint is the board artifact; the gorp
  sprint document (operator-approved, schema-validated) is the execution
  input. Planning produces the first; operator approval + `wf plan` produces
  the second.

## Uses

- `pm search`, `pm get-sprint`, `pm get-project` — read-only board state
- `validate`, `status`, `next` — board health, ready-work directives
- `.guava-os/registry/projects.yml` — project registration check
- Writes: via the `linear` skill — planning decides what, linear writes
- Execution handoff: `wf plan` (approved sprint → gorp compile-graph); see
  the `execution` skill
