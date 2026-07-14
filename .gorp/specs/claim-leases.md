# Claim Leases

> **`DUPLICATE` — DEPRECATED (Reconciliation, 2026-07-14).** Drifted copy of
> `~/dev/gorp/specs/claim-leases.md` (Linear-coupled, itself to be reconciled).
> Not authoritative. See `DOCUMENTATION-AUTHORITY-MAP.md`.

Defines ownership and lease semantics for agent work claims.

## Concept

A **claim** is a bounded assertion of ownership over a sub-issue by an agent.
Claims are not permanent — they have a lease duration and expire if not renewed by activity.

## Claim Lifecycle

```
EXECUTABLE → CLAIMED → ACTIVE → SUBMITTED → RELEASED
                 ↓
             EXPIRED (stale)
                 ↓
             EXECUTABLE (reclaimed by Robo)
```

State mapping:

| Claim State | Guava OS State | Linear Status |
|-------------|---------------|--------------|
| (no claim) | EXECUTABLE | Todo |
| CLAIMED | CLAIMED | In Progress (just transitioned) |
| ACTIVE | CLAIMED | In Progress (activity observed) |
| SUBMITTED | IN_REVIEW | In Review |
| RELEASED | DONE | Done (QA passed) |
| EXPIRED | EXECUTABLE (after reclaim) | Todo (after Robo reclaims) |

## Claim Properties

| Property | Type | Source |
|----------|------|--------|
| `issue_id` | string | Linear issue identifier |
| `persona` | string | Claiming agent's persona |
| `claimed_at` | ISO timestamp | When claim was made (Linear status change to In Progress) |
| `last_activity` | ISO timestamp | Most recent commit on branch or comment on issue |
| `lease_duration` | hours | From config: `invariants.stale_hours` (default: 48) |
| `expires_at` | ISO timestamp | `max(claimed_at, last_activity) + lease_duration` |

## Lease Rules

1. A claim is valid as long as `now < expires_at`.
2. Activity extends `expires_at` to `activity_time + lease_duration`.
3. Expired claims are reclaimed by Robo: returned to EXECUTABLE, assignee removed.
4. Same issue reclaimed > `RECLAIM_LIMIT` times → escalation (V502).
5. Only one agent may hold a claim on a sub-issue at a time.
6. Claim contention (two agents claim simultaneously): first `claimed_at` timestamp wins. Loser abandons and picks next.

## Pre-Claim Validation (Eligibility Gate)

Before granting a claim, the runtime must verify all 5 conditions:

| # | Condition | Violation if Failed |
|---|-----------|-------------------|
| 1 | Issue is a sub-issue (has parent) | V100: `parent_claimed` |
| 2 | Issue status is EXECUTABLE (Todo, all conditions met) | V101: `backlog_claimed` or V303: `parent_not_active` |
| 3 | Agent persona matches issue persona label | V102: `persona_mismatch` |
| 4 | Parent is active (status in `config.active_parent_statuses`) | V303: `parent_not_active` |
| 5 | No unresolved blockers (when dependency data available) | V301: `unresolved_blocker` |

Queue capacity (MAX_TODO_PER_PERSONA) is a promotion constraint, not a claim constraint. A builder claims from the Todo queue; Robo controls what enters the Todo queue.

## Activity Signals

| Signal | Source | Extends Lease | Available |
|--------|--------|---------------|-----------|
| Commit on expected branch (`feat/{prefix}-{id}-*`) | git log | Yes | Phase 2 |
| Comment on issue by claiming agent | Linear comment | Yes | Phase 2 |
| Status change by claiming agent | Linear status | Yes | Phase 2 |
| File edit in repo | git (not tracked) | No — too noisy | — |

## Reclamation Protocol

When a claim expires:

1. Robo verifies no recent activity (double-check before reclaiming).
2. Robo removes assignee from issue.
3. Robo transitions issue: In Progress → Todo.
4. Robo comments: `[RECLAIM] GUA-XX stale {hours}h, no activity. Returned to Todo.`
5. Issue enters EXECUTABLE state — available for any matching-persona agent.

If same issue is reclaimed > RECLAIM_LIMIT (default: 2):

1. Robo does NOT reclaim again.
2. Robo escalates:
   ```
   ESCALATION REQUIRED
   Class: repeated reclamation
   Issue: GUA-XX
   Detail: Reclaimed {count} times. Possible structural blocker.
   Awaiting human decision.
   ```

## Explicit Release (Voluntary Abandon)

An agent may voluntarily release a claim before completion:

1. Agent comments: `RELEASED — [reason]`
2. Agent transitions: In Progress → Todo
3. Issue returns to EXECUTABLE state.

This is not a reclamation — it does not increment the reclamation counter. It is the agent acknowledging it cannot complete the work.

## Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Lease duration per-persona? | **No.** Single `stale_hours` for all personas. | Simplicity. Per-persona tuning is premature optimization. Revisit if data shows systematic differences. |
| Agents can explicitly release? | **Yes.** Via comment + status change. | Prevents agents from sitting on work they can't complete. Does not count as reclamation. |
| Track claim history? | **Not in Phase 1.** Phase 2+ telemetry. | Stateless runtime. History is a separate concern. |
| Pair-programming (two agents, one branch)? | **Not supported.** One claim per sub-issue. | Multi-agent coordination adds complexity with no current need. |
