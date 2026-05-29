# Agent Execution Protocol

## Execution Source of Truth

**Linear** is the sole execution source of truth. No local markdown file owns execution state.

## Startup Invariant (MANDATORY)

Before proposing or executing work:

1. Query Linear (Guava AI team, RoutineMe project)
2. Derive execution state ONLY from Linear
3. Validate dependency chain
4. Validate persona eligibility
5. Validate issue is unclaimed or stale
6. Validate branch naming convention (`feat/GUA-{id}-{slug}`)
7. THEN begin execution

## Robo Initialization

Before work starts on a parent issue, robo MUST:

1. Read the parent issue from Linear
2. Create ≤3 subtasks, each labeled with ONE persona: `architect`, `backend`, or `frontend`
3. All subtasks commit to ONE branch: `feat/GUA-{parent-id}-{slug}`
4. Set subtask status to Todo

Without robo initialization → NO WORK STARTS.

## Subtask Eligibility (MANDATORY)

A subtask is executable ONLY when ALL conditions are true:

1. Subtask status is **`Todo`** (not Backlog, not any other status)
2. Subtask has a persona label matching the agent's persona
3. Parent issue status is `Todo` or `In Progress`
4. All blocking issues are resolved (status = `Done`)

**`Backlog` is NOT executable.** If the highest-priority subtask is in Backlog, do not claim it. Report: `BLOCKED — subtask [GUA-XX] not promoted to Todo`.

Parent issues are containers — builders NEVER claim parent issues.

**Priority mapping (LOCKED)**:
- Linear 1 / Urgent = P0 — drop everything
- Linear 2 / High = P1 — current sprint
- Linear 3 / Medium = P2 — next sprint
- Linear 4 / Low = P3 — later
- Never reinterpret Linear priority labels.

## Agent Pick Order

Agents scan Linear for subtasks matching their persona label that pass ALL eligibility conditions above.

Pick order (tie-breaking):
1. Highest priority (P0 → P3)
2. Oldest `updatedAt`
3. Lowest issue number

**Auto-select rule**: If valid executable subtasks exist, the agent MUST pick the highest-priority one and begin immediately. Do NOT ask the human what to work on — ever — when valid work exists.

## Pre-Claim Invariant Check

Before claiming ANY subtask, the agent MUST verify ALL:

1. Subtask passes all eligibility conditions (above)
2. Parent issue has ≤3 subtasks
3. Parent branch name is defined (`feat/GUA-{parent-id}-{slug}`)
4. Protocol comment exists on the parent issue

If ANY check fails → do NOT claim. Comment: `BLOCKED — invariant failed: [which check]`. Escalate to robo or human.

## Validation Examples

| Scenario | Result |
|----------|--------|
| Agent finds parent issue GUA-5 in Todo | **SKIP** — parent issues are containers, not executable |
| Agent finds subtask GUA-25 in Backlog, priority P0 | **SKIP** — `BLOCKED — subtask GUA-25 not promoted to Todo` |
| Agent finds subtask GUA-30 in Todo, label matches, parent in Todo, no blockers | **CLAIM** — all eligibility conditions met |
| Valid executable subtask exists for agent's persona | **CLAIM immediately** — no permission question to human |
| No eligible Todo subtasks exist for agent's persona | **STOP** — report "No executable work available" with reason |
| Matching subtask exists but blocked by dependency | **STOP** — report blocker only, do not propose alternative work |

## No Executable Work (MANDATORY)

If no eligible Todo subtasks exist for the agent's persona:

1. **DO NOT** recommend, suggest, or claim Backlog work
2. **DO NOT** propose future work, advisory analysis, or scope expansion
3. **Report exactly**: `No executable work available for [persona].`
4. **Include blocking reason** (one of):
   - `Waiting for promotion to Todo`
   - `Dependency unresolved: [GUA-XX]`
   - `No matching persona subtasks in project`
5. **Stop.** Wait for robo/human orchestration.

## Claim Protocol (Atomic)

1. Run pre-claim invariant check (all 7 pass)
2. Comment: `CLAIMED by [agent] — [date]`
3. Move status: Todo → In Progress
4. Begin work on parent branch

If claim conflict → abandon, pick next.

## Stale Claims

- Expires after 1 hour with no update
- Any persona-matching agent may reclaim
- Comment: `RECLAIMED — stale claim (>1h)`

## Submission

```
READY FOR QA
Branch: feat/GUA-{parent-id}-{slug}
Files: [changed files]
Tests: [pass/fail count]
```

Move subtask: In Progress → In Review

## QA Validation (Parent Level)

QA validates the FULL parent branch, not individual subtasks.

**QA PASS:**
```
QA PASS
Gates: tsc ✓ vitest ✓ build ✓
Merged to main: {commit hash}
Deployed: {confirmation}
```
→ All subtasks + parent → Done

**QA BLOCK:**
```
QA BLOCK
Failures:
- {specific failure}
```
→ Affected subtasks → In Progress

Max 2 rejection cycles. Third → robo escalates to human.

## Status Lifecycle

| Status      | Who Sets       | Conditions                    |
| ----------- | -------------- | ----------------------------- |
| Backlog     | Human          | Created, not prioritized. **NOT executable by agents.** |
| Todo        | Human or Robo  | Prioritized, dependencies met. **Eligible for agent claim.** |
| In Progress | Claiming agent | Atomic claim                  |
| In Review   | Builder agent  | Code complete on branch       |
| Done        | QA only        | QA pass + merged + deployed   |

## Deploy Rules

QA deploys ONLY when:
1. All quality gates pass
2. Code merged to `main`
3. `main` is clean
4. Local build succeeds
5. Then: `npx eas deploy --prod`

Human approval required for: schema migrations, Supabase console changes, new dependencies, first deploy of new systems.

## Agent Constraints

Agents MUST NOT:
- Create subtasks (robo only)
- Expand scope beyond subtask definition
- Switch personas mid-task
- Create branches outside `feat/GUA-{id}-{slug}` convention
- Bypass robo initialization
- Deploy (except QA)

## Queue Management

Builders do not manage their own queue. Robo promotes, reclaims, and cascades. Builders execute what is in Todo for their persona.

If a builder observes a queue anomaly (wrong status, missing subtask, incorrect label), report it — do not fix it. Queue state is robo's domain.

## Robo Execution

Robo is an operator. It executes protocol-valid queue actions autonomously (promotions, cascades, reclamations, parent lifecycle) and escalates only for defined escalation classes. See `.claude/agents/robo/AGENT.md` for the full control loop and escalation matrix.
