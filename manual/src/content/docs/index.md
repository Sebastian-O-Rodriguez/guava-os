---
title: "guava-os — Manual"
description: "Internal manual: routing, roles, skills, and workflow of the guava-os control plane."
---

# guava-os — Manual

guava-os is the **control plane**: it plans, scopes, and manages Linear across
projects, then orchestrates OMP subagents (**workers**) to execute. GitHub
authorizes merges; Linear is the workflow state of record. This manual is the
internal reference for how the system is built and how every agent enters work.

## Routing — every agent starts here

1. Read this file (overview + domain map).
2. Load **core** context → [`core`](core.md) — the principles every worker
   applies, regardless of domain.
3. Go to your **role** → [`roles/`](roles/) — your specific context + skills.
4. Reference: [`skills`](skills.md) (index) · [`onboarding`](onboarding.md)
   (new machine) · [`structure`](structure.md) (repo) · [`workflow`](workflow.md)
   (flow diagrams).

## Domain map

| Domain | Agent type | Skills |
|---|---|---|
| [PM](roles/pm.md) | manager session (guava-os) | planning · linear · dispatch · to-tickets · grilling · handoff |
| [QA](roles/qa.md) | `reviewer` | review · verify · code-review · test-strategy |
| [Security](roles/security.md) | `security-reviewer` | secure-coding · security-review |
| [Backend](roles/backend.md) | `task` / `sonic` | python-backend · sql-postgres · api-design |
| [Frontend / Designer](roles/frontend.md) | `designer` / `task` | react-nextjs · gsap · rive · reveal-presentation |
| [DevOps](roles/devops.md) | `task` | ci-cd · terraform · observability |
| [AI / ML](roles/ai-ml.md) | `task` | rag · prompt-engineering · pandas-data |

The seven OMP agent types are `task`, `reviewer`, `scout`, `designer`, `sonic`,
`librarian`, `security-reviewer`. The map above is the **domain** layer —
skills organized by what a worker builds; the `domainAgents` map in
`.guava-os/config.json` selects the OMP agent per domain.