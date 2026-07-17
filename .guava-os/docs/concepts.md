> **`CURRENT` / `ADAPTER_SPECIFIC` (labeled at Wave A closeout, 2026-07-14).**
> Documents the read-only Linear import/classifier CLI. Linear is an input
> format here, not the execution authority — the authoritative execution model
> is the Gorp-native persisted graph (see
> `~/dev/gorp/reference/architecture.md`).

# Concepts

Key terms used throughout Guava OS documentation and output.

## Issue Types

### Parent Issue

A Linear issue that has sub-issues. Parents are containers — they define scope but are never directly executed by agents. Parents are identified by having at least one other issue with `parentId` pointing to them.

### Sub-Issue

A Linear issue with `parentId` set, linking it to a parent. Sub-issues are the executable units. Agents claim and work on sub-issues, never parents.

### Standalone Issue

A Linear issue with no `parentId` and no children. Outside the execution graph. Reported but not classified into execution categories.

## Execution States

### EXECUTABLE

A sub-issue that meets ALL conditions for an agent to claim it:

1. Linear status is **Todo**
2. Has exactly one **persona label**
3. Persona label is in config
4. Parent issue is in an **active status** (Todo or In Progress)
5. No unresolved blockers (currently not enforceable — see Limitations)

Executable sub-issues appear in persona queues in `status` output.

### NOT_PROMOTED

A sub-issue in **Backlog** status. It has not been promoted to Todo. Agents cannot claim Backlog work. Promotion is done manually in Linear (or by Robo when available).

NOT_PROMOTED is not an error. It means the sub-issue exists but isn't scheduled for execution yet.

### BLOCKED

A sub-issue that would be EXECUTABLE except it has an unresolved blocking dependency. Another issue must reach Done before this sub-issue can be claimed.

**Current limitation**: dependency relation data is not available to the CLI. The BLOCKED category is always empty. Sub-issues with unresolved blockers appear as EXECUTABLE. Operators must manually verify dependency order.

### INVALID

A sub-issue that violates protocol rules. Examples:
- Missing persona label (agents can't route it)
- Multiple persona labels (ambiguous routing)
- Parent not in active status
- Orphan (parent not found in dataset)

INVALID sub-issues are excluded from the executable queue. They must be fixed in Linear.

## Critical Distinction: VALID vs EXECUTABLE

A sub-issue can be **valid** (no violations) but **not executable** (in Backlog).

```
VALID = no protocol violations detected
EXECUTABLE = valid AND status is Todo AND parent active
```

`validate` passing with 0 errors does NOT mean work is ready to execute. `status` showing 0 executable does NOT mean the graph is broken. These are different questions:

- `validate` asks: "Is the graph structurally correct?"
- `status` asks: "What can agents work on right now?"

A graph where all sub-issues are in Backlog will pass validate (0 errors) but show 0 executable in status. This is correct — the graph is valid but no work has been promoted.

## Linear Concepts (as used by Guava OS)

### Backlog

Linear status for issues that exist but aren't scheduled. Guava OS classifies these as NOT_PROMOTED. Agents must not claim Backlog work.

### Todo

Linear status for issues ready to be claimed. When a sub-issue is in Todo and passes all eligibility conditions, Guava OS classifies it as EXECUTABLE.

### Active Parent

A parent issue whose status is in the `active_parent_statuses` config list (default: Todo, In Progress). Sub-issues under inactive parents cannot be EXECUTABLE — they are INVALID.

### Persona

An agent role (architect, backend, frontend, qa). Each persona has an AGENT.md defining its behavior. Sub-issues are routed to personas via Linear labels.

### Persona Label

A Linear label matching a configured persona name. Each sub-issue must have exactly one persona label to be executable. Zero labels = not routable. Multiple labels = ambiguous.

## Queue

The list of EXECUTABLE sub-issues for a given persona, sorted by:
1. Priority (Urgent first)
2. Oldest `updatedAt`
3. Lowest issue number

The queue is computed fresh on every `status` run. It is not stored.

## Violation

A structural problem in the issue graph detected by `validate`. Each violation has a code (V302, V400, etc.), a severity (error or warning), and a detail message. See the validate guide for the full list.
