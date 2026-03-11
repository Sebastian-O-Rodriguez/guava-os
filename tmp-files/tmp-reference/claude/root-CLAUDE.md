# CLAUDE.md — PM Lad Workspace

**Owner:** Sebastian Rodriguez, CTO, Guava AI Ltd.
**Updated:** 2026-03-10

---

## Project

**PM Lad** is an operational control system for property managers. Self-service SaaS — signup, create org, manage properties, residents, invoices, maintenance. No engineering support required.

- **Stack:** NestJS 10 + Next.js 15 + Prisma + PostgreSQL + Clerk
- **Domain:** `app.pmlad.com` (web), `api.pmlad.com` (API)
- **Status:** Production launch — Phases 1-7a complete, Phase 7 (Launch Validation) next

---

## Workspace Layout

```
pmlad-shoal/
├── CLAUDE.md            <- YOU ARE HERE (start here, always)
├── README.md            <- Brief overview, points here
├── shoal.md             <- Shoal framework context + TOC
├── pmlad/               <- THE PRODUCT (NestJS + Next.js monorepo)
│   ├── CLAUDE.md        <- Codebase rules (code style, change policy)
│   ├── .claude/         <- Agent personas
│   ├── .shoal/          <- Sprint plans, project docs, templates
│   ├── apps/api/        <- Backend (NestJS + Prisma)
│   ├── apps/web2/       <- Frontend (Next.js 15, canonical)
│   ├── packages/        <- Shared libs (types, ui, db, widgets)
│   └── docs/            <- Product docs, roadmap, architecture
└── shoal/               <- THE FRAMEWORK (Python CLI for agent orchestration)
    ├── CLAUDE.md        <- Shoal codebase rules
    ├── src/shoal/       <- Source code
    └── docs/            <- Shoal-specific docs
```

---

## Key Documents

### PM Lad (Product)

| Doc | Path | Purpose |
|-----|------|---------|
| Codebase rules | [`pmlad/CLAUDE.md`](pmlad/CLAUDE.md) | Code style, change policy, quality gates |
| Launch roadmap | [`pmlad/docs/roadmap/launch-roadmap.md`](pmlad/docs/roadmap/launch-roadmap.md) | Canonical planning reference |
| North star | [`pmlad/docs/pm-lad-north-star.md`](pmlad/docs/pm-lad-north-star.md) | Product vision |
| Architecture | [`pmlad/docs/architecture/operational-backbone.md`](pmlad/docs/architecture/operational-backbone.md) | Operational backbone |
| Role dashboards | [`pmlad/docs/product/role-dashboards.md`](pmlad/docs/product/role-dashboards.md) | Phase 4 spec |
| UI patterns | [`pmlad/docs/frontend/ui-patterns.md`](pmlad/docs/frontend/ui-patterns.md) | 3-layer UI rule, component guide |

### Process & Conventions

| Doc | Path | Purpose |
|-----|------|---------|
| Process | [`pmlad/.shoal/project/process.md`](pmlad/.shoal/project/process.md) | How we work (Shoal, personas, sprints) |
| Agent protocol | [`pmlad/.shoal/project/agent-protocol.md`](pmlad/.shoal/project/agent-protocol.md) | XML dispatch/report format for agents |
| Conventions | [`pmlad/.shoal/project/conventions.md`](pmlad/.shoal/project/conventions.md) | Git, commits, push, sprint format |
| Tech stack | [`pmlad/.shoal/project/stack.md`](pmlad/.shoal/project/stack.md) | Stack details + local dev |

### Sprint Planning

| Doc | Path | Purpose |
|-----|------|---------|
| Roadmap pointer | [`pmlad/.shoal/plans/roadmap.md`](pmlad/.shoal/plans/roadmap.md) | Points to canonical roadmap |
| Current sprint | [`pmlad/.shoal/plans/current-sprint.md`](pmlad/.shoal/plans/current-sprint.md) | Active tasks |
| Sprint archive | [`pmlad/.shoal/plans/sprints/`](pmlad/.shoal/plans/sprints/) | Past + maintenance sprints |
| Reports | [`pmlad/.shoal/plans/reports/`](pmlad/.shoal/plans/reports/) | Sprint summaries |

### Shoal (Framework)

| Doc | Path | Purpose |
|-----|------|---------|
| Shoal overview | [`shoal.md`](shoal.md) | What Shoal is, TOC for Shoal docs |
| Shoal codebase | [`shoal/CLAUDE.md`](shoal/CLAUDE.md) | Code style, module layout, invariants |
| Shoal architecture | [`shoal/ARCHITECTURE.md`](shoal/ARCHITECTURE.md) | Design decisions |

---

## How We Build PM Lad

We use **Shoal** to orchestrate AI coding agents. See [`shoal.md`](shoal.md) for Shoal context.

**The loop:**

1. CTO sets direction in the roadmap
2. Robo (supervisor agent) proposes a sprint breakdown
3. CTO confirms — sprint goes to `current-sprint.md`
4. Robo dispatches agents with personas (Backend, Frontend, Architect, QA)
5. Agents work in isolated Shoal sessions (git worktrees)
6. QA validates against acceptance criteria
7. Robo reports results

See [`pmlad/.shoal/project/process.md`](pmlad/.shoal/project/process.md) for full details.

---

## Rules (Project-Wide)

- **Agents are proposal engines.** They generate diffs and reports under CTO supervision.
- **Every task gets a persona.** No cowboy coding. See process.md.
- **Every plan includes persona breakdown.** Sprint proposals must have a task table with persona assignments grouped by execution wave. Plans without this are incomplete.
- **Keep docs short.** If a topic exceeds ~100 lines, split it into its own doc and link to it.
- **PM Lad roadmap is canonical.** All planning references `pmlad/docs/roadmap/launch-roadmap.md`.
- **Shoal roadmap is separate.** Shoal development tracked inside `shoal/` only.
- **Co-Author tag:** `Co-Authored-By: Gorp, Guava AI` on all commits.

---

## Launch Status

| Phase | Milestone | Status |
|:-----:|-----------|--------|
| 1 | Identity & User Model (Clerk) | Complete (2026-03-06) |
| 2 | Organization & Onboarding | Complete (2026-03-07) |
| 3 | Role System | Complete (2026-03-07) |
| 4 | Role Dashboards | Complete (2026-03-09) |
| 5 | Production Infrastructure (Azure) | Complete (2026-03-09) |
| 6 | Deployment Pipeline | Complete (2026-03-10) |
| 7a | UI Stack Revamp (shadcn/ui + Tremor + assistant-ui) | Complete (2026-03-10) |
| 7 | Launch Validation | **Next** |
