---
name: grilling
description: "Relentlessly interview about a plan or design until every branch is resolved, building a shared domain language (CONTEXT.md / glossary) as you go. Use before implementing anything non-trivial."
domain: pm
role: manager
order: 1

metadata:
  author: guava-os
  version: "0.1.0"
---

## Grilling

The reusable interview primitive (mattpocock `grilling` / `grill-with-docs`,
distilled). Kills misalignment and verbosity before they cost code.

## Loop

1. Ask the one highest-value question on the unresolved branch.
2. Record the answer as a decision; update the shared `CONTEXT.md` / glossary.
3. Repeat until every branch resolves to a concrete, falsifiable decision.

## What to grill

Scope (in/out), data shapes, edge cases, failure behavior, acceptance
criteria, and naming/jargon — build the shared language as you go.

## Rules

- One question at a time; never assume; don't rush to solve.
- Every answer gets a name in the shared vocabulary (reduces later verbosity).
- Stop when more questions add no design resolution.

## Uses

- Pre-implementation alignment, domain modeling, ADR drafting
- Feeds `to-tickets` with a resolved, unambiguous plan

## Source

mattpocock `productivity/grilling` + `engineering/grill-with-docs`.