# Concepts

Key terms used throughout guava-os documentation and output.

## Issue types

- **Parent** — a Linear issue with children. A container: defines scope, never
  executed. Carries no role label.
- **Sub-issue** — a Linear issue with `parentId`. The executable unit.
- **Standalone deliverable** — no `parentId`, no children, but Todo + exactly
  one role label + no unresolved blockers. Valid work.

## Roles

Roles are the seven OMP agent types. One issue carries exactly one **role label**
(selecting the OMP agent) and one **domain label** (selecting the skill domain).

| Role | OMP agent | Does |
|---|---|---|
| `task` | task | implement a scoped change |
| `reviewer` | reviewer | QA — review diff vs acceptance, run tests |
| `scout` | scout | locate/report (read-only) |
| `designer` | designer | UI/UX implementation |
| `sonic` | sonic | fast mechanical edits |
| `librarian` | librarian | research libraries/APIs from source |
| `security-reviewer` | security-reviewer | security audit (read-only) |

## Execution states

- **EXECUTABLE** — Todo, exactly one valid role label, active parent, no
  unresolved blockers.
- **NOT_PROMOTED** — exists but not scheduled (Backlog).
- **BLOCKED** — executable except an unresolved `blocks` dependency.
- **INVALID** — protocol violation: missing role label, multiple role labels,
  inactive parent, orphan.

VALID ≠ EXECUTABLE: `validate` asks "is the graph structurally correct?";
`status` asks "what can agents work on right now?"

## Queue

Executable issues for a given role, sorted by priority, then oldest
`updatedAt`, then issue id. Computed fresh every `status` run — never stored.

## Workflow

guava-os (manager) plans + scopes + writes Linear. A project session (a
**dispatcher**) loads its open issues and delegates each to a subagent of the
issue's role. Subagents implement, `verify`, commit (`GUA-###` → `dev/<role>`),
and hand off (`pm comment` + `pm move In Review`). GitHub authorizes merges
(`dev/<role>` → `staging` → `production`).