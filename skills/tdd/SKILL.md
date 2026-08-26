---
name: tdd
description: "Test-driven development: write a failing test first, make it green, refactor. Use for any feature or bug fix that has a cheap local test path."
domain: core
role: any
order: 2

metadata:
  author: guava-os
  version: "0.1.0"
---

## TDD

Red-green-refactor loop (mattpocock + pstack + Beck, distilled).

## Loop

1. **RED** — write the smallest failing test that names the behavior (not the
   structure). Run it; watch it fail for the right reason.
2. **GREEN** — minimal code to make it pass. Don't over-build.
3. **REFACTOR** — clean up with the test as the safety net.

## What makes a good test

- Names an observable behavior, not a plumbing step.
- Deterministic, isolated, no network/clock.
- Fails for the right reason; asserts the contract, not the source text.
- Covers boundaries: happy path, edge, error, transition, precedence.

## When NOT to

- No cheap local test path → use a verification skill / feature map
  (see `engineering-principles`: prove it works).
- Throwaway prototype → skip.

## Uses

- Feature work and bug fixes
- Paired with `verify` and `engineering-principles`

## Source

mattpocock `engineering/tdd`, pstack `tdd`.