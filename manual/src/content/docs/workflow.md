---
title: Workflow
description: "Ordered workflows: context injection → Core → domain branch, then the per-role skill order."
---

# Workflow

## High-level (every agent)

```mermaid
flowchart TD
    INJ[script / context injection] --> CORE[Core skills]
    CORE -->|agent knows its type| PM[PM · manager session]
    CORE --> QA[QA · reviewer]
    CORE --> SEC[Security · security-reviewer]
    CORE --> BE[Backend · task]
    CORE --> FE[Frontend/Designer · designer]
    CORE --> DO[DevOps · task]
    CORE --> AI[AI/ML · task]
```

**Core skills, in order:** `engineering-principles` → `tdd` → `diagnosing-bugs` →
`writing-for-agents` → `technical-writing` → `diagrammatic-writing` →
`diagrammatic-review`. An agent loads core first, then follows its domain branch
to the ordered role workflow.

## Per-role (example: Backend)

```mermaid
flowchart TD
    P[engineering-principles] --> T[tdd]
    T --> D[diagnosing-bugs]
    D --> Lt[writing-for-agents] --> Tw[technical-writing] --> Dw[diagrammatic-writing] --> Dr[diagrammatic-review]
    Dr --> A[api-design] --> Py[python-backend] --> Sq[sql-postgres] --> Sup[supabase] --> SupPg[supabase-postgres-best-practices]
```

The role pages under `roles/` carry each domain's full ordered chain plus the
full skill content — self-contained starting places.

## The operating loop (PM → workers → GitHub → Linear)

```mermaid
flowchart TD
    PLAN[PM: engineering-principles + grilling] --> TICK[to-tickets + linear: pm create/link]
    TICK --> DISPATCH[dispatch: fan issue to role agent]
    DISPATCH --> WORK[worker: core skills + role skills → verify → commit GUA-### → dev/role]
    WORK --> Q[QA: verify + code-review + review]
    Q -->|approve| PROMOTE[promote dev/role → staging → production]
    Q -->|reject| WORK
    PROMOTE --> REFRESH[handoff: pm comment + move Done]
    REFRESH --> PLAN
```

## Promotion gates

```mermaid
flowchart LR
    DV[dev/*] -->|QA review + CI| ST[staging]
    ST -->|operator review + CI| PR[production]
```