# guava-os Linear Conventions

> **Authority:** `ADR_001.md` > `docs/architecture/guava-os-operating-contract.md` >
> this doc. These conventions define how guava-os uses Linear as its
> project-management provider and workflow state of record.

## Principle

Linear native fields carry workflow. Labels carry routing + classification. An
issue carries:

- **one domain label** — which skills/agent apply
- **one type label** — the kind of work
- **one readiness label** — whether it is dispatchable (computed by `triage`)

## Native fields (workflow)

| Field | Carries |
|---|---|
| Status | Workflow state (Todo, In Progress, In Review, Done, Canceled, Backlog). |
| Assignee | Who is responsible. |
| Priority | Urgency (0=None .. 1=Urgent). |
| Project | Which project the issue belongs to. |
| Parent | Parent issue (sprint/epic container). |
| Dependencies | blocks / blocked-by relations (the execution DAG). |
| Cycle | Sprint cycle (if used). |
| Milestone | Project milestone (if used). |

## Labels — domain + type + readiness

### Domain (which knowledge + executor)

| Label | OMP agent | Behavior |
|---|---|---|
| `pm` | task | planning/scoping (manager-side) |
| `qa` | reviewer | judge |
| `security` | security-reviewer | read-only audit |
| `backend` | task | implement |
| `frontend` | designer | implement |
| `devops` | task | implement |
| `ai-ml` | task | implement |

The mapping is the `domainAgents` map in `.guava-os/config.json` — one domain,
one behavior (1:1). No separate "role" label: the domain implies both the skills
(activated guidance + routing tree) and the OMP agent (model + disposition +
tools).

### Type (what kind of work)

`Feature`, `Bug`, `Improvement`, `Chore`, `Spike`. `Spike` is an investigation
deliverable — terminal is a findings comment, not production code.

### Readiness (gate)

Exactly one, always present, set **only** by `gos triage`:

| Label | Meaning |
|---|---|
| `untriaged` | default on `pm create`; not yet checked |
| `ready-for-work` | triage passed — dispatchable |
| `needs-rescoping` | triage failed — needs attention |

Dispatch only fans out issues carrying `ready-for-work`.

## Issue template

Every issue must have:

- **Title** — `GUA-N — <short outcome>`. One issue = one outcome.
- **Description** — structured (this IS the worker's complete picture):
  - `## Why this exists`
  - `## Scope`
  - `## Out of scope`
  - `## Acceptance criteria` (numbered, observable)
  - `## Dependencies` (optional)
- **Project**, **Labels** — one domain + one type (+ `untriaged` on creation),
  and **Status** `Todo`.
- `pm create` refuses an empty or incomplete description (missing any of the
  required sections).

## Branching model (ADR_001 Amendment 2)

```
production   ← protected: PR from staging + required review + required CI
staging      ← protected: PR from dev/* + QA review + required CI
dev/<domain>   (one dev branch per domain; workers push here)
```

- Workers push to `dev/<domain>` — never to staging/production.
- Promotion is two-gated: QA review to staging, then a second review to
  production. GitHub branch protection enforces both.

## Commit convention

- Every commit subject carries the canonical issue identifier:
  `GUA-### <short outcome>`.
- This lets QA map commits to issues and acceptance criteria (the dev branch is
  long-lived per domain, so the branch name cannot carry the id).

## Identity (canonical IDs)

- **After Linear creation**, the canonical `GUA-###` identifier is the sole
  identity of the issue. Never plan aliases (`S0`/`R1`) after creation.
- `pm create` / `pm get-issue` / `pm search` surface `GUA-###`; `pm link` /
  `pm create --parent` reject non-canonical refs.

## Dependencies

- Linear native `blocks` / `blocked-by` relations; no cycles.
- A `blocks` edge means a **hard result-dependency** — downstream consumes the
  upstream result. Never use it for "roughly before" ordering; that needlessly
  serializes independent work.

## Close-out tickets and precondition commands

A **close-out ticket** closes a body of work (a branch, a sprint, a release)
rather than building new behavior. Its acceptance depends on the state of a
branch or history, so the description MUST carry a **precondition command** —
one deterministic, runnable shell command that the worker executes first and
that must pass before the ticket can be considered done.

Convention:

- The command lives under its own `## Precondition` heading (or, if the ticket
  already uses `## Acceptance criteria`, as its first item).
- It must be runnable in the target repo and fail closed: a non-zero exit or
  unexpected output means the precondition is not met.
- It must be scoped to the ticket: a close-out for one branch verifies that
  branch, never the whole repo.

Example — closing out `dev/backend` into `staging`:

```bash
git log main..origin/dev/backend
```

...must list only commits that reference the ticket's in-scope identifiers
(`GUA-###` in the subject). Any other commit means the branch carries
out-of-scope work and the close-out is blocked.

## Handoff protocol (clean handoff)

The Linear issue + comment thread is the **state of record**.

1. **Start** — worker reads `pm get-issue <id>`, works in an isolated worktree.
2. **Finish** — worker moves to In Review and writes a result comment: changed
   files, commit SHA on `dev/<domain>`, verification evidence, acceptance checked.
3. **Next session** — any agent resumes cold from `pm get-issue <id>`.

## Workflow

| Status | Meaning |
|---|---|
| Backlog | Not yet scheduled. |
| Todo | Ready; all blocked-by deps are Done. |
| In Progress | Being worked. |
| In Review | Result pushed to dev; awaiting QA. |
| Done | Acceptance met; merged; verified. |
| Canceled | Withdrawn (merged, descoped, or superseded). |

Transitions: Backlog → Todo → In Progress → In Review → Done (or → Canceled
from any state). Status is the single source of workflow truth; readiness is a
separate computed axis owned by `triage`.