# FAQ

> **Authority note (2026-08).** This FAQ covers the classifier commands.
> `pm`, `sprint`, and `wf` call Linear and mutate state. See
> `.omp/skills/planning/SKILL.md` for the canonical operational loop.
## Why is the executable queue empty?

All sub-issues are in Backlog. They need to be promoted to Todo in Linear before agents can claim them. This is the normal state before a sprint starts.

Run `validate` — if it passes with 0 errors, the graph is valid. The queue is empty because nothing has been promoted, not because anything is broken.

## Why does validate pass but status show 0 executable?

These answer different questions.

- `validate` checks: "Are there structural problems in the graph?"
- `status` checks: "What can agents execute right now?"

A graph where all sub-issues are in Backlog has zero structural problems (validate passes) but zero executable work (status shows empty queue). Both are correct.


## Why must work be promoted manually?

The classifier commands are read-only. Promotion (Backlog → Todo) for
governed work flows through gorp's execution pipeline (`sprint generate` →
`wf plan` → gorp); manual promotion in Linear is also possible.

## Why is missing persona label an error (V400)?

A sub-issue without a persona label cannot be routed to any agent. No agent will ever claim it. It's dead weight in the execution graph — structurally present but operationally invisible.

This was promoted from warning to error because:
- It's not a soft issue — the sub-issue is genuinely not executable
- It's the same severity class as V401 (multiple labels) — both make routing impossible
- Leaving it as a warning would let operators proceed with un-routable work in the graph

Fix: add exactly one persona label (architect, backend, frontend, or qa) to the sub-issue in Linear.
## Why doesn't the classifier fetch Linear itself?

The classifier commands (`doctor`, `status`, `validate`, `next`) are stdin
processors. `pm search` fetches Linear data; pipe it to the classifers.

Benefits:
- No API keys or auth configuration in the classifiers
- No rate limiting concerns in the classifiers
- No network failure modes in the classifiers
- Testable with fixture files
- Clear separation: `pm` owns data access, classifiers own validation

## Why are the classifiers read-only?

The classifier commands are the validation surface — stdin in, report out.
Read-only ensures:

- No accidental mutations during validation
- Safe to run repeatedly without side effects
- Output is deterministic for the same input

Mutations, planning, and governed execution go through `pm`, `sprint`, and
`wf` — these are the active surface.

## What does "dependency relations not loaded" mean?

The classifier output declares `dependencyRelationsLoaded: false` when the
caller didn't provide dependency data. The BLOCKED category can't be
populated without it. For dependency-aware execution, use `sprint generate`.

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
