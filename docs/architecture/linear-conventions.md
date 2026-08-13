# guava-os Linear Conventions

> **Authority:** `ADR_001.md` > `docs/architecture/guava-os-gorp-contract.md` >
> this doc. These conventions define how guava-os uses Linear as its
> project-management provider.

## Principle

Linear native fields carry workflow. Labels carry metadata only. Never use
labels for workflow state.

## Native fields (workflow)

| Field | Carries |
|---|---|
| Status | Workflow state (Todo, In Progress, Done, Canceled, Backlog). |
| Assignee | Who is responsible. |
| Priority | Urgency (0=None .. 1=Urgent). |
| Project | Which project the issue belongs to. |
| Parent | Parent issue (sprint/epic container). |
| Dependencies | blocks / blocked-by relations. |
| Cycle | Sprint cycle (if used). |
| Milestone | Project milestone (if used). |

## Labels (metadata only)

Labels classify the *kind* of work, never its state.

| Label | Meaning |
|---|---|
| `architect` | Architecture / boundary work persona. |
| `backend` | Backend implementation persona. |
| `frontend` | Frontend implementation persona. |
| `qa` | Quality / verification persona. |
| `migration` | Code/data migration. |
| `adr` | Architecture decision record work. |

**Never use labels for workflow state.** No `ready`, `review`, `blocked`,
`pickup`, `in-progress`, `done`. Workflow belongs in **Status**.

## Issue template

Every issue must have:

- **Title** — `GOS-N — <short outcome>`. One issue = one outcome.
- **Description** — structured:
  - `## Why this exists` (purpose)
  - `## Current owner` / `## Target owner`
  - `## Boundary being established` (answers: what architectural boundary does this establish?)
  - `## Scope` (bullet list)
  - `## Out of scope` (bullet list)
  - `## Acceptance criteria` (numbered, observable)
  - `## Dependencies` (blocked by: GOS-N)
- **Project** — `guava-os` (platform work never goes in a consumer project).
- **Parent** — the sprint container issue.
- **Labels** — exactly one persona label (`architect` / `backend` / `frontend` / `qa`); metadata labels (`migration`, `adr`) as needed.
- **Status** — `Todo` on creation; transitions reflect real workflow state.
- **Dependencies** — Linear `blocks` / `blocked-by` relations mirroring the dependency graph.

## Naming

- Issue IDs: `GOS-N` (assigned by the sprint; `N` is the logical order number).
- Branch names: `sebastian/gua-<linear-id>-<slug>` (Linear auto-generates).
- Sprint container: `ADR_001 Repository Realignment` (parent issue).

## Identity (canonical IDs)

- **Before Linear creation** (planning phase): local shorthand aliases (`S0`,
  `S1`, `R1`…) are allowed for drafting the plan.
- **After Linear creation**: the canonical identifier Linear assigns (`GUA-###`)
  is the **sole identity** of the issue. Every dependency (`blocks`/`blocked-by`),
  report, sprint document, and graph/gorp handoff MUST refer to issues by
  `GUA-###` (or the issue UUID) — never by plan aliases or free text.
- Tooling enforces this on the write path: `pm link` / `pm create --parent`
  reject non-canonical references (GOS-38).
- `pm create` / `pm get-issue` / `pm search` surface the canonical `GUA-###`
  identifier in their output so planning can adopt it immediately (GUA-96).


## Parent/child structure

- A sprint may be a **container** (parent with children) or a **standalone
  dependency chain** (chain head wired by native `blocks`). Using a final
  deliverable as a fake sprint container is forbidden.
- Container: one parent issue per sprint; every child carries exactly one
  persona label; parents carry no persona label (they group, never execute).
- Chain: top-level deliverables wired by `blocks`; the chain head is
  executable; `sprint generate --parent <chain-head>` produces the chain
  document.
- Standalone deliverables (no parent, no children) are valid executable work
  (GUA-111) — they do not need a container parent.

## Dependencies

- Linear native `blocks` / `blocked-by` relations.
- Dependencies mirror the critical path; no cycles.
- gorp enforces execution order from the dependency graph.

### Hard dependency vs preferred order (GOS-44)

A `blocks` / `blocked-by` relation means **"downstream work consumes the
upstream result"** — a *hard* result-dependency. It is NOT a sequencing
preference.

- **Use a hard relation only when the downstream deliverable actually needs
  the upstream output** (its code, artifact, decision, or data) to proceed.
  Apply the "results-needed" test: *would the downstream task fail without
  the upstream deliverable's result?* If no — it is not a dependency.
- **Never model "do roughly before" / nice-to-have ordering as a `blocks`
  edge.** Preferred order is a planning preference, not a dependency. Adding
  an edge for soft ordering needlessly serializes independent work (it forces
  gorp to pipeline tasks that could run in parallel).
- **Independent work stays independent.** To group work without implementing
  it sequentially, put deliverables as parallel children of a container (or as
  unblocked standalones) — the scheduler runs 0-indegree tasks in parallel.
- A hard edge that turns out to be wrong or prematurely added can now be
  removed cleanly: `pm unlink <id> --blocks <ids> / --blocked-by <ids>`
  (GOS-41).

## Acceptance criteria

- Numbered, observable, grep-checkable where possible.
- Each criterion must be pass/fail, not subjective.
- Examples: "`grep -ri X` returns nothing outside `reference/history/`";
  "`npx vitest run` green"; "contract doc merged".

## Workflow

| Status | Meaning |
|---|---|
| Backlog | Not yet scheduled. |
| Todo | Ready; all blocked-by deps are Done. |
| In Progress | Being worked. |
| Done | Acceptance criteria met; verified. |
| Canceled | Withdrawn (merged, descoped, or superseded). |

Status transitions: Backlog → Todo → In Progress → Done (or → Canceled from
any state). No label changes for workflow — Status is the single source.

## Audit: existing sprint (GUA-44 + children)

| Issue | Persona label | Metadata labels | Status-driven | Violation |
|---|---|---|---|---|
| GUA-44 (parent) | none | none | yes | none |
| GUA-45 (GOS-1) | architect | none | yes | none |
| GUA-47 (GOS-2) | architect | none | yes | none |
| GUA-61 (GOS-17) | architect | none | yes | none |
| GUA-53 (GOS-8) | architect | none | yes | none |
| GUA-62 (GOS-18) | architect | none | yes | none |
| GUA-49 (GOS-3) | architect | none | yes | none |
| GUA-65 (GOS-21) | architect | none | yes | none |
| GUA-63 (GOS-19) | backend | none | yes | none |
| GUA-64 (GOS-20) | architect | none | yes | none |
| GUA-50 (GOS-4) | backend | none | yes | none |
| GUA-51 (GOS-5) | backend | none | yes | none |
| GUA-52 (GOS-6) | backend | none | yes | none |
| GUA-46 (GOS-16) | backend | none | yes | none |
| GUA-55 (GOS-10) | backend | none | yes | none |
| GUA-56 (GOS-11) | backend | none | yes | none |
| GUA-58 (GOS-13) | backend | none | yes | none |
| GUA-54 (GOS-9) | architect | none | yes | none |
| GUA-57 (GOS-12) | architect | none | yes | none |
| GUA-59 (GOS-14) | architect | none | yes | none |
| GUA-60 (GOS-15) | qa | none | yes | none |

No violations. All issues use native Status for workflow; labels are persona
metadata only. No workflow-state labels exist in the sprint.
