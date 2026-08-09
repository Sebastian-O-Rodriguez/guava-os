# Guava OS Vision

## Purpose

Guava OS (GOS) exists to build software.

Not one project.

Not itself.

Every project built with GOS should improve GOS.

Every improvement to GOS should benefit future projects.

The system compounds engineering capability over time.

---

# Core Philosophy

GOS does not replace the engineering ecosystem.

It composes it.

The best existing tools already solve many problems well.

GOS governs how those tools are used together.

Where possible, GOS adopts instead of invents.

Governance is built.

Runtimes are reused.

---

# Primary Components


## guava-os

guava-os is the control plane — the layer where the operator iterates,
creates plans, and decides what happens next.

guava-os owns decisions: planning, task decomposition, orchestration,
governance workflow (review/promotion decisions), project registry, and
project management via Linear (Linear is the provider; guava-os owns the
interface; agents never depend on Linear directly).

Approved plans are delegated down to Gorp for execution. guava-os controls
Gorp. guava-os is also a consumer of Gorp: Gorp builds and improves guava-os,
closing the compounding loop.

---
## Gorp

Gorp is the execution engine.

It takes an operator-approved plan and runs the governed execution pipeline
mechanics:

* gate
* review (enforcement — hash binding, fail-closed)
* promote (gate enforcement — fail-closed cherry-pick)
* audit

Gorp owns enforcement: fail-closed gates, hash binding, audit chain,
worktree isolation, worker dispatch through the adapter seam, and
execution-state transitions. Gorp does not own planning, governance
decisions, or Linear.

Gorp dispatches workers — OMP agents, selected via personas — to execute
engineering work. Workers execute; they never approve or promote.

---
## Herdr

Herdr manages multiple OMP sessions. Each pane represents one active project
runtime. Herdr is the operator session model (planned).
---

## Operator Interface

The Operator Interface is the primary way humans interact with GOS.

The operator:

* creates projects
* plans work
* starts execution
* reviews work
* approves promotion
* manages capabilities

The interface remains thin.

Decisions belong in guava-os; enforcement belongs in Gorp.

---

## OMP

OMP is the primary engineering runtime.

It provides:

* interactive software development
* planning
* coding
* editing
* debugging
* subagents
* Git workflows
* engineering execution

GOS does not attempt to replace these capabilities.

GOS governs their use.

---

# Projects

The project is the primary unit of work.

Every project contains:

* source code
* documentation
* architecture
* business context
* tests
* project-specific conventions
* project capability specializations
* governance history

Projects are where engineering happens.

---

# Capabilities

Capabilities are reusable engineering knowledge.

A capability represents how the organization effectively uses a technology, workflow, or engineering practice.

Examples:

* React
* Playwright
* dbt
* Terraform
* SQL optimization
* forecasting
* CI patterns
* deployment workflows

Capabilities are reusable assets.

Projects consume them.

Projects may specialize them.

Projects may improve them.

---

# Project Specialization

Projects extend capabilities without replacing them.

Global knowledge remains global.

Project-specific knowledge remains local.

This separation prevents one project from redefining organizational knowledge.

---

# The Compounding Loop

Every project begins with existing organizational capability.

During execution, projects discover improvements.

Improvements become candidate capabilities.

Candidate capabilities require:

* evidence
* validation
* review
* approval

Approved improvements become part of the Global Capability Library.

Future projects immediately benefit.

Knowledge compounds through governance.

---

# Governance

Governance applies to every reusable artifact.

Including:

* capabilities
* engineering patterns
* workflows
* validation approaches
* documentation
* implementation guidance
* reusable tooling

Nothing becomes global automatically.

Every promotion is governed.

---

# Operating Model

The operator works in guava-os, the control plane. Approved plans flow down to Gorp, which dispatches workers.

```text
guava-os (control plane)
    ↓
Gorp (executor)
    ↓
OMP workers (dispatched via personas)
    ↓
Project
```

guava-os decides what happens next; Gorp enforces the execution mechanics.

Workers execute engineering work but never approve or promote.

Projects deliver value.
---

# Design Principles

* Reuse existing tools before building new ones.
* Keep governance separate from execution.
* Keep projects independent.
* Keep reusable knowledge global.
* Eliminate duplicate sources of truth.
* Build only what creates lasting leverage.
* Prefer composition over replacement.
* Simplicity beats cleverness.
* Every new subsystem must justify its existence.

---

# Success

GOS succeeds when:

* projects ship faster over time
* engineering quality improves across projects
* knowledge compounds instead of disappearing
* capabilities become more effective through use
* new projects inherit previous experience
* governance remains simple and auditable

The goal is not to build another coding agent.

The goal is to build every future project better because GOS exists.

GOS is a governed engineering operating system built by composing the best available tools into a single, continuously improving workflow.
