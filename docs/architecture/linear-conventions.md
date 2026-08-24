# guava-os Linear Conventions

> **Authority:** `ADR_001.md` > `docs/architecture/guava-os-operating-contract.md` >
> this doc. These conventions define how guava-os uses Linear as its
> project-management provider and workflow state of record.

## Principle

Linear native fields carry workflow. Labels carry metadata and routing. Never use
labels for workflow state. An issue carries **one role label** (picking the OMP subagent)
and **one domain label** (activating domain guidance and routing).

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

## Labels — 7 OMP roles + 7 domain tags

An issue carries **one role label** and **one domain label**.

### Roles (how it is executed — OMP agent type)

| Label | OMP agent | Does |
|---|---|---|
| `task` | task | implement a scoped change |
| `reviewer` | reviewer | QA — review diff vs acceptance, run tests |
| `scout` | scout | locate/report (read-only) |
| `designer` | designer | UI/UX implementation |
| `sonic` | sonic | fast mechanical edits |
| `librarian` | librarian | research libraries/APIs from source |
| `security-reviewer` | security-reviewer | security audit (read-only) |

### Domains (what is being built — skill domain)

| Domain | What it covers |
|---|---|
| `pm` | Product management, planning, scoping |
| `qa` | Quality assurance, testing, verification |
| `security` | Security authoring and review |
| `backend` | APIs, databases, servers |
| `frontend` | UI components, styling, animations |
| `devops` | CI/CD, IaC, infrastructure, deployment |
| `ai-ml` | Vector databases, RAG, prompt engineering, analytics |

Never use labels for workflow state (no `ready`, `blocked`, `in-progress`).
## Issue template

Every issue must have:

- **Title** — `GUA-N — <short outcome>`. One issue = one outcome.
- **Worker-fit size** — small enough for one subagent turn: a bounded `## Scope`,
  one observable outcome, tight numbered acceptance. If it needs more than one
  turn, split it.
- **Description** — structured (this IS the subagent's complete picture):
  - `## Why this exists` (purpose)
  - `## Scope` (tight paths)
  - `## Out of scope`
  - `## Acceptance criteria` (numbered, observable)
  - `## Dependencies` (blocked by: GUA-N)
- **Project** — the owning project.
- **Parent** — the sprint container issue.
- **Labels** — one role label (`task`/`reviewer`/`scout`/`designer`/`sonic`/`librarian`/`security-reviewer`) + one domain label (`pm`/`qa`/`security`/`backend`/`frontend`/`devops`/`ai-ml`).
- **Status** — `Todo` on creation.
- **Dependencies** — Linear `blocks` / `blocked-by` mirroring the dependency graph.

## Branching model (ADR_001 Amendment 2)

```
production   ← protected: PR from staging + required review + required CI
staging      ← protected: PR from dev/* + QA review + required CI
dev/task     dev/designer  ...   (one dev branch per role; workers push here)
```

- Workers push to `dev/<role>` — never to staging/production.
- Promotion is two-gated: QA review to staging, then a second review to
  production. GitHub branch protection enforces both.

## Commit convention

- Every commit subject carries the canonical issue identifier:
  `GUA-### <short outcome>`.
- This lets QA map commits to issues and acceptance criteria (the dev branch is
  long-lived per role, so the branch name cannot carry the id).

## Identity (canonical IDs)

- **After Linear creation**, the canonical `GUA-###` identifier is the sole
  identity of the issue — for dependencies, reports, commit subjects, and
  handoff. Never plan aliases (`S0`/`R1`) after creation.
- `pm create` / `pm get-issue` / `pm search` surface `GUA-###`; `pm link` /
  `pm create --parent` reject non-canonical refs (GOS-38).

## Dependencies

- Linear native `blocks` / `blocked-by` relations; no cycles.
- A `blocks` edge means a **hard result-dependency** — downstream consumes the
  upstream result. Never use it for "roughly before" ordering (GOS-44); that
  needlessly serializes independent work.
- Independent work stays independent — group as parallel container children or
  unblocked standalones. Fix a wrong edge: `pm unlink <id> --blocks/--blocked-by`.

## Handoff protocol (clean handoff)

The Linear issue + comment thread is the **state of record**. A worker records
its result on the issue; the next session resumes by reading it.

1. **Start** — worker reads `pm get-issue <id>`, works in an isolated worktree.
2. **Finish** — worker moves to In Review and writes a result comment:
   - Changed files, commit SHA on `dev/<role>`
   - Verification evidence (test output / grep proof)
   - Acceptance criteria checked off
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
from any state). Status is the single source of workflow truth.