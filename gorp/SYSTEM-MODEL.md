# GOS System Model

## Canonical Flow

```text
Human Operator
    ↓
Herdr (operator session model, planned)
    ↓
guava-os (control plane — decisions)
    ↓
Gorp (execution engine — enforcement)
    ↓
OMP Workers (dispatched via personas)
    ↓
Project Repository
    ↓
Candidate Capability Improvements
    ↓
Review and Validation
    ↓
Global Capability Library
```

guava-os decides what happens next. Gorp enforces the execution mechanics.
OMP workers execute. Projects deliver value.

## guava-os (control plane)

guava-os is the control plane — the environment where the human operator
iterates, evaluates, and creates plans. Approved plans are delegated down to
Gorp for governed execution.

guava-os owns decisions: planning, task decomposition, orchestration,
governance workflow (review/promotion decisions), project registry, and
project management via Linear (Linear is the provider; guava-os owns the
interface; agents never depend on Linear directly).

guava-os houses personas (`.guava-os/personas/<name>/`) that map to OMP
roles, bridging operator intent to worker dispatch.

## Gorp

Gorp is the execution engine — it takes an operator-approved plan and runs
the enforcement mechanics:

```
gate → review (hash binding) → promote (fail-closed) → audit
```

Gorp dispatches workers (OMP agents, selected via personas) to perform
engineering work.

Gorp owns enforcement:

* execution contracts
* execution graphs and transition rules (enforced by the transition table)
* sandboxing and validation gates (fail-closed)
* hash binding (review decisions bind to the exact sandbox commit)
* promotion gate enforcement (fail-closed cherry-pick)
* audit chain (integrity evidence; no external anchor)
* worker dispatch through the source-neutral adapter seam
* worktree isolation
* retries and recovery mechanics

Gorp does **not** own or provide:

* planning, orchestration, or governance decisions (guava-os owns those)
* Linear access (guava-os owns that)
* an engineering runtime
* workers, tools, or plugins
* prompt assembly
* agent memory
* a coding agent
* project identity or the project registry (guava-os owns those)

## Herdr

Herdr manages multiple OMP sessions. Each pane represents one active project
runtime. Herdr is the operator session model (planned).

## Operator Interface

The Operator Interface is the primary way humans interact with GOS. It lives
within the guava-os control plane.

Through it the operator creates projects, plans work, starts execution,
reviews work, approves promotion, and manages capabilities.

The interface remains thin: it does not own enforcement state or duplicate
Gorp logic. Decisions belong in guava-os; enforcement belongs in Gorp.

## OMP

OMP agents are the workers Gorp dispatches to perform engineering work.
Selected via personas, they operate inside isolated git-worktree sandboxes
and provide: interactive software development, planning, coding, editing,
debugging, subagents, and Git workflows.

Workers execute engineering work but never approve or promote — that is
operator-only and hash-bound. Workers never fetch Linear. GOS governs their
use through Gorp's execution contracts.

## Worker Runtimes

Engineering runtimes reach Gorp only through the worker-adapter seam and its
contracts. No runtime is required by the architecture; runtimes are composed,
replaceable, and must never own approval, promotion, or governance state.
Runtime lock-in is prohibited. (What is integrated today is recorded in
`CURRENT-STATE.md`, not here.)

## Project Repositories

Project repositories own:

* product source code
* project architecture
* project documentation
* requirements and business context
* tests
* project conventions
* local capability specialization
* project-specific evidence

Project repositories do not contain independent Gorp runtimes.

## Global Capability Library

The Global Capability Library owns reusable engineering knowledge: global
skills, tool-use knowledge, patterns, anti-patterns, recipes, validation
methods, examples, evidence, versions, and promotion history.

Projects consume global capabilities, specialize them locally, and may propose
improvements. Nothing becomes global automatically; every promotion is
governed and evidence-backed.

## Dependency Direction

Dependencies flow toward the enforcement engine.

```text
Operator interfaces → guava-os decisions → Gorp contracts
Engineering runtimes → Gorp contracts
Projects             → guava-os project registry
Capabilities         → guava-os governance lifecycle
```

Gorp must not depend on one operator interface, one engineering runtime, or
one project.

## Prohibited Duplication

The system must not contain:

* a second enforcement runtime
* a second project identity system
* a second scope-enforcement authority
* worker-owned approval
* interface-owned enforcement state
* project-owned copies of global capability truth
* local-only critical system knowledge
* a GOS-built replacement for what composed tools already do well
* direct agent → Linear access (agents use guava-os skills only)
