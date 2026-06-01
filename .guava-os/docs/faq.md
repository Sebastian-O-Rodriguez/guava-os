# FAQ

## Why is the executable queue empty?

All sub-issues are in Backlog. They need to be promoted to Todo in Linear before agents can claim them. This is the normal state before a sprint starts.

Run `validate` — if it passes with 0 errors, the graph is valid. The queue is empty because nothing has been promoted, not because anything is broken.

## Why does validate pass but status show 0 executable?

These answer different questions.

- `validate` checks: "Are there structural problems in the graph?"
- `status` checks: "What can agents execute right now?"

A graph where all sub-issues are in Backlog has zero structural problems (validate passes) but zero executable work (status shows empty queue). Both are correct.

## Why are blockers unavailable?

Linear's `list_issues` API returns issue data but not blocking/dependency relations. To get relations, the CLI would need to call `get_issue` for each issue individually — that's an N+1 query pattern that's deferred to a future phase.

Until then, the CLI cannot distinguish between "executable" and "would be executable if blocker X were resolved." Operators must manually verify dependency order in Linear for critical work.

## Why must work be promoted manually?

Guava OS is read-only. It cannot change Linear state. Promotion (Backlog → Todo) requires either:

- A human moving the issue in Linear
- A future Robo implementation with mutation authority (`guava-os robo --apply`, not yet built)

Today, all queue management is manual.

## Why is missing persona label an error (V400)?

A sub-issue without a persona label cannot be routed to any agent. No agent will ever claim it. It's dead weight in the execution graph — structurally present but operationally invisible.

This was promoted from warning to error because:
- It's not a soft issue — the sub-issue is genuinely not executable
- It's the same severity class as V401 (multiple labels) — both make routing impossible
- Leaving it as a warning would let operators proceed with un-routable work in the graph

Fix: add exactly one persona label (architect, backend, frontend, or qa) to the sub-issue in Linear.

## Why doesn't Guava OS fetch Linear itself?

Design decision: the CLI is a pure data processor with no network layer.

Benefits:
- No API keys or auth configuration in the CLI
- No rate limiting concerns
- No network failure modes
- Testable with fixture files
- Same CLI works regardless of how data is fetched
- Clear separation: callers own data access, CLI owns validation

The caller (Claude Code agent via MCP tools, or a human via Linear export) is responsible for fetching.

## Why is this read-only?

Guava OS in its current phase is an inspector, not a controller. Read-only ensures:

- No accidental mutations during validation
- Safe to run repeatedly without side effects
- Output is deterministic for the same input
- No risk of corrupting Linear state during development

Mutation authority (promoting, reclaiming, transitioning) is a separate capability that will be added incrementally with explicit operator opt-in.

## What does "dependency relations not loaded" mean?

The CLI declares its data capabilities in the output. `dependencyRelationsLoaded: false` means blocking relationship data was not provided, so the BLOCKED category cannot be populated. Sub-issues that have real blockers will incorrectly appear as EXECUTABLE.

This is not a bug — it's an honest declaration of what the CLI can and cannot determine from the data it received.

## What if doctor fails on "linear" and "labels"?

These checks fail when no Linear data is piped via stdin. If you're just checking repo setup, this is fine — the other 5 checks validate config, docs, and files.

For a full pre-execution check, provide Linear data:

```bash
echo '{"issues": [], "labels": ["architect", "backend", "frontend", "qa"]}' | .guava-os/bin/guava-os doctor
```

## Can I run validate and status on the same data?

Yes, and you should. Use the same JSON file for both:

```bash
cat issues.json | .guava-os/bin/guava-os validate
cat issues.json | .guava-os/bin/guava-os status
```

Validate first (check for errors), then status (check the queue). If validate fails, fix Linear before trusting status output.
