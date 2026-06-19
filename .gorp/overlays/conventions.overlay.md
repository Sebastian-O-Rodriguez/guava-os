# Conventions Overlay — guava-os

Extends global Gorp conventions (`doctrine/conventions.md`). Tighten-and-extend
only: this file may add or strengthen rules, never loosen a global guardrail.

## Stack-Specific Conventions

- guava-os is a read-only TypeScript CLI. It has **no network layer** and never
  authenticates; it consumes Linear issue JSON via stdin only.
- Type check: `tsc --noEmit`. Tests: vitest.

## Forbidden Patterns

- Do not add a network layer or any outbound calls to the CLI.

## Boundaries

- Treat `.gorp/process/` and `.gorp/specs/` as existing project material; do not
  remove or replace them as part of consuming Gorp.

(All other conventions inherit from global Gorp doctrine.)
