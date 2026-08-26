---
name: code-review
description: "Two-axis diff review — Standards (repo conventions + code smells) and Spec (did it implement the originating issue) — plus adversarial challenge with a synthesized verdict. Use when reviewing a PR, branch, or work-in-progress changes."
domain: qa
role: reviewer
order: 2
load_when: a diff review is required
guidance: two axes: standards + spec | cite file+line | separate nit from blocking

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Review changes since a fixed point along two independent axes and synthesize a verdict. The axes stay separate so one can't mask the other; adversarial input strengthens confidence.

## Axes

- **Standards** — does the code follow the repo's documented conventions AND avoid baseline code smells?
- **Spec** — does the code faithfully implement the originating issue/spec (no missing requirements, no scope creep)?

A change can pass one and fail the other. Standards-pass/Spec-fail = the wrong thing done cleanly; Spec-pass/Standards-fail = the right thing done against conventions. Never merge or rerank findings across axes.

## Standards axis — smell baseline

These apply even when a repo documents nothing. A documented repo standard always overrides a baseline flag; each smell is a judgement call, not a hard violation.

| Smell | Signal → fix |
|-------|--------------|
| Mysterious Name | name doesn't reveal purpose → rename |
| Duplicated Code | same logic shape in >1 hunk/file → extract shared |
| Feature Envy | reaches into another object's data more than its own → move method |
| Data Clumps | same few fields travel together → bundle into a type |
| Primitive Obsession | primitive stands in for a domain concept → give it a small type |
| Repeated Switches | same switch/if-cascade recurs → polymorphism or shared map |
| Shotgun Surgery | one change edits many files → gather into one module |
| Divergent Change | one module edited for unrelated reasons → split |
| Speculative Generality | abstraction/params/hooks the spec doesn't need → delete |
| Message Chains | long `a.b().c().d()` → hide walk behind one method |
| Middle Man | class mostly delegates → cut it |
| Refused Bequest | subclass ignores most inherited behavior → use composition |

## Spec axis

Find requirements that are:

1. **Missing or partial** — asked for but absent/incomplete.
2. **Scope creep** — implemented but never asked for.
3. **Wrong** — implemented but doesn't match the spec.

Quote the spec line for each finding.

## Process

1. Pin the fixed point (`git diff <fixed>...HEAD`, three-dot vs merge-base). Fail fast on a bad ref or empty diff.
2. Locate the spec: issue refs in commit messages → user-passed path → `docs/`/`specs/` → ask. If none, Spec axis reports "no spec available".
3. Identify standards sources (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, etc.).
4. Run both axes in parallel (sub-agents or co-reviewers) so context doesn't cross-pollinate.
5. Synthesize a verdict; do not auto-apply changes.

## Synthesizing the verdict

Categorize every finding as a pragmatic senior engineer:

- **Act on** — real correctness/security/maintainability issues blocking a PR.
- **Consider** — legitimate, but might not outweigh the cost now.
- **Noted** — valid but low-impact/context-dependent.
- **Dismissed** — wrong, nitpicky, or missing context (say why, so the author can override).

Agreement across independent reviewers is high-confidence signal; lone findings are worth reading but weigh lower. Deduplicate findings multiple reviewers describe differently.

## Uses

- Reviewing a PR, branch, or WIP diff against its originating issue
- Adversarial "tear this apart" reviews from independent angles
- Pre-merge sanity checks combining conventions and spec fidelity

## Source

Distilled from `mattpocock/skills` — `engineering/code-review` — and `cursor/plugins` pstack — `interrogate`.