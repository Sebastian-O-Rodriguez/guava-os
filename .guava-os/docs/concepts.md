# Concepts

Key terms used throughout Guava OS documentation and output.

## Issue Types

### Parent Issue

A Linear issue that has sub-issues. Parents are containers — they define scope but are never directly executed by agents. Parents are identified by having at least one other issue with `parentId` pointing to them.

### Sub-Issue

A Linear issue with `parentId` set, linking it to a parent. Sub-issues are the executable units. Agents claim and work on sub-issues, never parents.

### Standalone Deliverable

A Linear issue with no `parentId` and no children, but eligible for execution
when: status Todo, exactly one persona label, and no unresolved native
blockers. Standalone deliverables are valid work (GUA-111) — they do not
require a parent container.
## Execution States

### EXECUTABLE

A sub-issue that meets ALL conditions for an agent to claim it:

1. Linear status is **Todo**
2. Has exactly one **persona label**
3. Persona label is in config
4. Parent issue is in an **active status** (Todo or In Progress)
5. No unresolved native Linear blockers (enforced when dependency data is available)

Executable sub-issues (and standalone deliverables) appear in persona queues in `status` output.

### NOT_PROMOTED

NOT_PROMOTED is not an error. It means the issue exists but isn't scheduled
for execution yet. Promotion is done via gorp's governed execution pipeline
or manually in Linear.

### BLOCKED

A sub-issue that would be EXECUTABLE except it has an unresolved blocking
dependency. The classifier populates BLOCKED when the caller provides
dependency data; `sprint generate` handles this for governed execution.

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

An agent role (architect, backend, frontend, qa). Personas are defined in `.guava-os/personas/<name>/persona.md` (replacing the deprecated `.claude/agents/` layout) and map to OMP roles (scout, designer, reviewer, librarian, task, sonic, plus model roles like smol). Each persona has a file defining its behavior. Sub-issues are routed to personas via Linear labels.

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

## Governed Execution (Gorp)

Gorp is the execution engine — it owns the governed execution pipeline:
compile-graph, orchestrate (enforcement), gate, review (enforcement),
promote. guava-os owns the decision layer: `wf plan`, `wf review`,
`wf approve/reject/retry`, `wf promote`. Workers are OMP agents dispatched
by gorp via persona-aware profiles.

guava-os is also a consumer of Gorp in a compounding loop: Gorp builds and improves guava-os itself.

**`sprint`** — An operator-approved unit of work planned into the execution graph.

**`node`** — One task in that graph, executed by a worker in an isolated sandbox.

**`promotion`** — The governed application of an approved, reviewed change to the target repository after gates pass.
