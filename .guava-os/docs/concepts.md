# Concepts

Key terms used throughout guava-os documentation and output.

## Issue types

- **Parent** — a Linear issue with children. A container: defines scope, never
  executed. Carries no domain label.
- **Sub-issue** — a Linear issue with `parentId`. The executable unit.
- **Standalone deliverable** — no `parentId`, no children, but Todo + exactly
  one domain label + no unresolved blockers. Valid work.

## Domains

The seven OMP agent types are `task`, `reviewer`, `scout`, `designer`, `sonic`,
`librarian`, `security-reviewer`. An issue carries no role label — instead
it carries **one domain label** (selecting both the skill domain and, via the
`domainAgents` map, the OMP agent), **one type label**, and **one readiness
label**.

| Domain | OMP agent | Does |
|---|---|---|
| `pm` | task | planning/scoping (manager-side) |
| `qa` | reviewer | QA — judge diff vs acceptance |
| `security` | security-reviewer | security audit (read-only) |
| `backend` | task | implement a scoped change |
| `frontend` | designer | UI/UX implementation |
| `devops` | task | implement |
| `ai-ml` | task | implement |

## Execution states

- **EXECUTABLE** — Todo, one valid domain label, `ready-for-work`, active
  parent, no unresolved blockers.
- **NOT_PROMOTED** — exists but not scheduled (Backlog).
- **BLOCKED** — executable except an unresolved `blocks` dependency.
- **INVALID** — protocol violation: missing domain label, missing readiness
  label, incomplete description, inactive parent, orphan, subtask overflow.

VALID ≠ EXECUTABLE: `validate` asks "is the graph structurally correct?";
`status` asks "what can agents work on right now?"

## Queue

Executable issues for a given domain, sorted by priority, then oldest
`updatedAt`, then issue id. Computed fresh every `status` run — never stored.

## Workflow

guava-os (manager) plans + scopes + writes Linear. A project session (a
**dispatcher**) loads its open issues and delegates each to a subagent of the
issue's domain. Subagents implement, `verify`, commit (`GUA-###` → `dev/<domain>`),
and hand off (`pm comment` + `pm move In Review`). GitHub authorizes merges
(`dev/<domain>` → `staging` → `production`).