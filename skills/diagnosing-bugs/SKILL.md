---
name: diagnosing-bugs
description: "Disciplined root-cause loop for hard bugs and regressions: reproduce, isolate, hypothesize, instrument, fix, regression-test. Use when the cause isn't obvious."
domain: core
role: any
order: 3

metadata:
  author: guava-os
  version: "0.1.0"
---

## Diagnosing Bugs

Phase-gated loop (mattpocock + pstack runtime forensics, distilled). Gate each
phase before the next; don't skip ahead.

## Loop

1. **Reproduce** — a script/command that exhibits the bug on demand. No repro,
   no fix.
2. **Isolate** — shrink the input/surface; bisect to a minimal case.
3. **Hypothesize** — one falsifiable cause, ordered by likelihood.
4. **Instrument** — logs/metrics/trace to confirm or refute, with evidence.
5. **Fix** — at the root (`engineering-principles`: fix-root-causes).
6. **Regression-test** — lock it; confirm the repro no longer triggers.

## Anti-patterns

- Speculative fixes without a repro.
- Patching the symptom (nil-guard) instead of the cause.
- Changing multiple variables at once.

## Uses

- Hard or transient bugs, perf regressions
- Complements `tdd` (test-first) and `engineering-principles`

## Source

mattpocock `engineering/diagnosing-bugs`, pstack `runtime-forensics` playbook.