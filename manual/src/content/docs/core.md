---
title: Core
description: "The small, stable layer every agent loads before domain work."
---

# Core

Loaded by every agent, and used *with* role-specific skills. The engine of the
core is `engineering-principles` (`## Invariants` → `## Execution protocol` →
`## Completion contract`), which the injector pulls verbatim.

### engineering-principles

_Core engineering red lines for every worker: prove it works, fix root causes, build the lever, sequence verifiable units, protect boundaries, keep the context window small. Apply to any implementation, refactor, migration, or review._

## Engineering Principles

The non-negotiables applied to every task. Distilled from pstack (poteto's 21
principles), mattpocock, and *The Pragmatic Programmer*. Prefer these over
code-gen habits. They are a checklist to run before declaring done.

## Core (always)

- **Prove it works** — verify against the real artifact: run it, read the
  value, inspect the diff. Never "it compiles" or self-report.
- **Fix root causes** — reproduce first; trace symptom → root; resist nil-guard
  patches that silence a crash.
- **Sequence verifiable units** — break work into small units each ending in a
  verifiable state; order commits/PRs so the sequence proves itself.
- **Build the lever** — for bulk or mechanical work, write the codemod /
  script / skill; the tool is the reviewable artifact, not a vague "done".
- **Subtract before you add** — remove dead weight and redundant validators
  first, then build on the simpler base.
- **Deliver small** — scope for a single verifiable unit, not the ambition.

## Design

- **Foundational thinking** — get core types and data structures right before
  logic; scaffold before feature.
- **Model the domain** — one structure over scattered conditionals.
- **Type-system discipline** — make illegal states unrepresentable; parse
  external data at boundaries; don't lie to the compiler.
- **Boundary discipline** — clamp at boundaries (CLI, config, network, API);
  keep business logic in pure functions inside.
- **Idempotence & clean migration** — converge to the same end state regardless
  of partial runs; migrate callers then delete the old API (no compatibility
  layer).
- **Redesign from first principles** — bolt-on rarely beats treating a new
  requirement as foundational from day one.

## Delegation & economy

- **Guard the context window** — route bulk to subagents; keep summaries in the
  main thread, not raw payloads.
- **Never block on the human** — proceed, present the result, course-correct
  after; reserve confirmation for irreversible actions.
- **Encode lessons in structure** — a lint, type, check, or script, not more
  prose.

## Invariants

- Stay inside contracted scope.
- Follow existing repository patterns.
- Make the smallest correct change.
- Test changed behavior.
- Verify before claiming completion.
- Never fabricate test or command results.

## Execution protocol

1. Inspect relevant implementation and tests.
2. Establish expected behavior with a test.
3. Implement the smallest change.
4. Run targeted verification.
5. Verify acceptance criteria.
6. Commit only task-related changes.

## Completion contract

Return:
- changed files
- acceptance criterion → evidence
- verification commands + results
- scope deviations
- blockers
- commit SHA

## Uses

- Default checklist for any implementation, refactor, migration, or review
- Discipline the `dispatch` role loads before executing any ticket
- Review axis "standards" in code review

### tdd

_Test-driven development: write a failing test first, make it green, refactor. Use for any feature or bug fix that has a cheap local test path._

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

### diagnosing-bugs

_Disciplined root-cause loop for hard bugs and regressions: reproduce, isolate, hypothesize, instrument, fix, regression-test. Use when the cause isn't obvious._

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

### writing-for-agents

_Author documents agents reach by pointer — skills, AGENTS.md/CLAUDE.md, runbooks, context docs — so they're loadable, scannable, and machine-actionable. Use when writing or reviewing any agent-facing doc._

## Writing for Agents

A document an agent reaches by pointer must be skimmable and machine-actionable
(mattpocock `writing-for-agents`, distilled).

## Rules

- **Frontmatter first**: name + a one-line "what this is + when to use it".
- **Lead with the rule**, then the why, then a minimal example.
- **Imperative, fragment-per-line**; no narrative filler, no hedging.
- One concept per heading; a table over a paragraph when it's a matrix.
- **State the trigger AND the non-goal** (when NOT to use it).
- Every instruction must be executable without dialog: name the file, the
  command, the acceptance, the output.
- **Shared vocabulary**: define domain terms once; don't re-explain basics.

## Canonical structure

1. Purpose (one line) · 2. Trigger / when to use · 3. Steps or rules
4. Anti-patterns · 5. Uses (exact commands/skills) · 6. Source.

## Uses

- Authoring SKILL.md, AGENTS.md, runbooks, handoff docs
- Reviewing agent docs — `diagrammatic-review` for layout, this for content

## Source

mattpocock `productivity/writing-for-agents`.

### technical-writing

_Layered doc standard (Diátaxis structure + concise style) for docs, RFCs, READMEs, PR descriptions, and commit messages. Use for any prose deliverable._

## Technical Writing

Diátaxis structure + concise style (pstack `technical-writing`, distilled).

## Diátaxis — pick the type BEFORE writing

- **Tutorial** — learning-oriented; step by step.
- **How-to guide** — task-oriented; solve a problem.
- **Reference** — information-oriented; complete, terse.
- **Explanation** — understanding-oriented; background/rationale.

One doc = one type. Don't blend tutorial with reference.

## Style

- Trim: fragments over sentences; cut hedging ("might", "perhaps", "just").
- Active voice, present tense; concrete nouns, exact names.
- Code blocks carry language tags; errors/paths verbatim.
- Conventional Commits: `type(scope): subject` ≤ 50 chars; body = why, not what.
- PR description: what + why + how to verify + out-of-scope.

## Uses

- README / RFC / docs authoring, PR descriptions, commit messages
- Pair with `writing-for-agents` (content) and `diagrammatic-writing` (layout)

## Source

pstack `technical-writing` (Diátaxis + Google dev style + STE).

### diagrammatic-writing

_Compose documents where spatial layout (hierarchy, margins, position, proximity) carries the argument, not just linear prose. Use for architecture docs, plans, reports, and any dense agent-authored document._

## Diagrammatic Writing

Write so the page's graphic structure encodes meaning, not just the words
(Johanna Drucker, *Diagrammatic Writing*). A document is a semantic field:
position, hierarchy, and proximity are part of the argument, never decoration.

## The moves (a bounded vocabulary)

Relate an element to its neighbors with one deliberate spatial move:

- `above` / `below` — rank, sequence, dependency
- `next to` — coordinate, peer, sibling
- `in front of` / `behind` — foreground vs background emphasis
- `embrace` / `surround` / `support` — containment, framing, definition
- `juxtapose` — contrast or compare without a connector
- `interlineate` — annotate between the lines of another block
- `attach` — bind a label/note to its referent

## Rules

- Pick exactly one move per relationship; left decorative, position misleads.
- Headings are nodes, not labels — the outline IS a diagram.
- Use indentation, margins, lists, tables, and whitespace before arrows or
  mermaid. ASCII/markdown structure is the first and cheapest diagram.
- Choose structure by shape: hierarchy → heading tree; matrix → table; genuine
  graph → mermaid; sequence → ordered list.
- No orphan elements: every block sits in a named relation to its neighbors.
- Break linear prose when the meaning is spatial — don't flatten a structure
  into a paragraph.

## Uses

- Architecture/ADR and planning documents
- Sprint plans, review reports, handoff notes
- Any document an agent authors for a human to *navigate*, not just read
- `skills.md` / `structure.md` style indexes and tables

### diagrammatic-review

_Audit a document's spatial structure against diagrammatic-writing criteria: does the layout (hierarchy, position, proximity) carry or contradict the argument? Use to review docs, plans, reports, and indexes._

## Diagrammatic Review

Judge whether a document's mise-en-page (spatial arrangement) is doing work or
fighting it. Drucker's criterion: form and content are one — a layout that
contradicts its argument is a defect, not a style choice.

## Criteria

- **Hierarchy carries rank** — do headings/nesting match logical importance, or
  are coequal ideas stacked under unrelated parents?
- **Proximity = relation** — related items adjacent, unrelated items separated?
- **Position is deliberate** — is each placement a meaning (above = rank,
  next-to = peer, support = contain) or arbitrary?
- **No orphans** — any block with no named relation to its neighbors?
- **One move per relationship** — is any element trying to be two things?
- **Linear vs spatial coherence** — does reading top-to-bottom tell the same
  story the layout implies, or do they conflict?

## Verdict

Report per document:

- `pass` — layout supports the argument, or
- a finding list: `section / element` + the violated criterion + the concrete
  re-placement (what moves where and why).

Be specific. Never say "restructure" without naming the moves.

