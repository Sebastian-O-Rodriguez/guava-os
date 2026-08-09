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

## Retrospective

At sprint close: what shipped, what stalled, which estimates were wrong, what
board hygiene says. Feed outcomes into the next planning pass.

## Uses

- `pm get-issue`, `pm comment`, `pm move` — verdict + board update
- `wf review`, `wf approve`, `wf reject`, `wf retry`, `wf promote` —
  guava-os decisions; gorp enforces
- `wf orchestrate-status`, gorp `inspect` — read-only evidence
