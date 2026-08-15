---
name: review
description: Acceptance review, boundary review, result review, retrospective — the guava-os review loop. guava-os decides; gorp enforces and records.
---

## Review

guava-os owns review decisions (operator-facing). gorp enforces that each
decision binds to the exact audited state and records it.

## Acceptance review

For each issue: read it, check every acceptance criterion against evidence,
comment the verdict, move status only when criteria are met.

## Boundary review

Changes must respect ADR_001 ownership: guava-os decides, gorp enforces,
workers execute, OMP runs. Reject work that crosses boundaries — Linear
access outside guava-os tooling, planning logic inside gorp, workers making
governance decisions.

## Result review

After execution: inspect the run evidence (audit trail, artifacts, gates),
then approve / reject / retry / promote. Decisions are hash-bound to the
reviewed state — re-review after any new worker output.

Decision surface (guava-os `wf` CLI — the ONLY path; no direct gorp for
decisions, GUA-146):

```bash
guava-os wf review <project> <graph> <node>                 # read-only evidence
guava-os wf approve <project> <graph> <node> --actor <a> --commit <sha> --reason <r>
guava-os wf reject <project> <graph> <node> --actor <a> --reason <r>
guava-os wf retry <project> <graph> <node> --actor <a> --reason <r>
guava-os wf promote <project> <graph> <node> --actor <a>
guava-os wf promote <project> <graph> <node> --actor <a> --override-baseline  # GUA-242 recovery
```

Being blocked on promotion? Check the block reason first: `wf review` shows
the gate/verdict, `gorp inspect` shows the full run. A promotion blocked on
target drift (`target-dirty` — working tree moved; `baseline` — refs/tree
diverged; `base-commit` — HEAD moved) means the target repo changed since the
run started. Recovery (GUA-242): re-approve ONLY after confirming the drift is
unrelated by running `wf promote --override-baseline` — this relaxes the
drift gates to a file-conflict check:
- **Drift touches worker files** → refused (`override-conflict`) — merge manually, never use the flag.
- **Drift is unrelated** (new commits on HEAD, unrelated uncommitted edits) → the
  reviewed commit cherry-picks onto the new target; unrelated dirty files are left
  untouched.
The flag is an explicit operator acknowledgment, never a looser default gate.

Non-fixture workers always stop for human review (review policy) — resume
with `wf orchestrate` after a decision; promotion unlocks the next
dependency; guava-os then updates Linear via `pm move <id> --status "Done"`.

## Retrospective

At sprint close: what shipped, what stalled, which estimates were wrong, what
board hygiene says. Feed outcomes into the next planning pass.

## Uses

- `pm get-issue`, `pm comment`, `pm move` — verdict + board update
- `wf review`, `wf approve`, `wf reject`, `wf retry`, `wf promote` —
  guava-os decisions; gorp enforces
- `wf orchestrate-status`, gorp `inspect` — read-only evidence
