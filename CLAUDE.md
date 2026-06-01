# Guava-OS

Linear-driven multi-agent execution CLI for Claude Code. Developer infrastructure — never runs in production.

## Startup Invariant (MANDATORY)

Before proposing or executing work:

1. Query Linear (Guava AI team, RoutineMe project)
2. Derive execution state ONLY from Linear
3. Validate dependency chain
4. Validate persona eligibility
5. Validate issue is unclaimed or stale
6. Validate branch naming convention (`feat/GUA-{id}-{slug}`)
7. THEN begin execution

Local markdown plans are ARCHIVAL ONLY. Never derive task assignments, status, or priorities from `.gorp/archive/*`.

## Issue Hierarchy (MANDATORY)

- **Parent issues are containers** — they define scope, not executable work.
- **Builders (architect, backend, frontend) execute SUBTASKS ONLY.** Never claim a parent issue.

## Subtask Eligibility (MANDATORY)

A subtask is executable ONLY when ALL conditions are true:

1. Status is **`Todo`** (not Backlog, not any other status)
2. Has a persona label matching the agent (`architect`, `backend`, `frontend`)
3. Parent issue status is `Todo` or `In Progress`
4. All blocking issues are resolved (status = `Done`)

**`Backlog` is NOT executable.** If the highest-priority subtask is in Backlog, do not claim it. Report: `BLOCKED — subtask [GUA-XX] not promoted to Todo`.

**Auto-select rule**: If valid executable subtasks exist, the agent MUST pick the highest-priority one and begin immediately. Do NOT ask the human what to work on. Tie-breaking order: (1) highest priority, (2) oldest `updatedAt`, (3) lowest issue number.

### Validation Examples

| Scenario | Result |
|----------|--------|
| Agent finds parent issue GUA-5 in Todo | **SKIP** — parent issues are containers, not executable |
| Agent finds subtask GUA-25 in Backlog, priority P0 | **SKIP** — `BLOCKED — subtask GUA-25 not promoted to Todo` |
| Agent finds subtask GUA-30 in Todo, label matches, parent in Todo, no blockers | **CLAIM** — all eligibility conditions met |
| Valid executable subtask exists for agent's persona | **CLAIM immediately** — no permission question to human |
| No eligible Todo subtasks exist for agent's persona | **STOP** — report "No executable work available" with reason |
| Matching subtask exists but blocked by dependency | **STOP** — report blocker only, do not propose alternative work |

### No Executable Work (MANDATORY)

If no eligible Todo subtasks exist for the agent's persona:

1. **DO NOT** recommend, suggest, or claim Backlog work
2. **DO NOT** propose future work, advisory analysis, or scope expansion
3. **Report exactly**: `No executable work available for [persona].`
4. **Include blocking reason** (one of):
   - `Waiting for promotion to Todo`
   - `Dependency unresolved: [GUA-XX]`
   - `No matching persona subtasks in project`
5. **Stop.** Wait for robo/human orchestration.

## Priority Mapping (LOCKED)

| Linear Priority | Label   | Meaning              |
|-----------------|---------|----------------------|
| 0               | None    | Unset                |
| 1               | Urgent  | P0 — drop everything |
| 2               | High    | P1 — current sprint  |
| 3               | Medium  | P2 — next sprint     |
| 4               | Low     | P3 — later           |

Never reinterpret Linear priority labels. Use the mapping above verbatim.

## Authority Hierarchy

| Priority | Source | Owns |
|----------|--------|------|
| 0 | **Human** | Priorities, constraints, scope, escalation resolution |
| 1 | **Linear** | Execution state, priorities, claims, blockers, dependencies |
| 2 | **CLAUDE.md** | Repo identity, stack, startup invariant |
| 3 | **AGENT.md** | Persona constraints, boundaries, patterns |
| 4 | **`.gorp/process/*`** | Execution protocol, conventions, approvals |
| 5 | **`.gorp/archive/*`** | Dead/historical — never execution truth |

## Tracking

- **Linear** — sole execution source of truth
- **Team**: Guava AI
- **Project**: RoutineMe
- **Issue prefix**: `GUA-`

## Agent System

| Agent     | Role                                              |
| --------- | ------------------------------------------------- |
| robo      | Scope gatekeeper, fallback orchestrator           |
| architect | Schema design, API contracts, component structure |
| backend   | API routes, Supabase queries, mutation scripts    |
| frontend  | React components, pages, dashboard UI             |
| qa        | Quality gates, code review, deploy                |

## Routing Table

| Topic | Canonical Source |
|-------|-----------------|
| Execution protocol | `.gorp/process/agent-protocol.md` |
| Conventions (git, code) | `.gorp/process/conventions.md` |
| Approval matrix | `.gorp/process/approval-matrix.md` |

## Quality Gates

```bash
npx vitest run    # Tests
npx tsc --noEmit  # Type check (guava-os tsconfig)
```
