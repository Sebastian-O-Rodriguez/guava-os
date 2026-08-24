# Guava-OS

## Purpose

guava-os is the control plane: it plans, manages Linear, and orchestrates work
through OMP subagents. GitHub owns authorization; Linear is the workflow state
of record. guava-os is also its own first governed consumer — a compounding
loop.

## Repository layout (canonical: `docs/architecture/repo-layout.md`)

- `~/dev/guava-os` is the canonical stable runtime (clean `main`) — agents
  execute from it; **never develop here**.
- `~/dev/guava-archives/` holds durable history/archive storage (gorp bundle —
  historical).
- Project repos are their own working roots; GOS dev changes use temporary
  isolated clones (create on demand, remove after merge).

## Owners

- **guava-os** (`.guava-os/`) — decisions: planning, Linear integration,
  orchestration (OMP subagents), review/promotion workflow, project registry.
- **OMP** — engineering runtime + orchestration substrate (subagents, isolated
  worktrees, DAG fan-out, process supervision).
- **GitHub** — authorization (branch protection, required review, required CI).
- **Linear** — backlog + workflow state of record.

## Authority Hierarchy

`ADR_001.md` wins every conflict. Read order: `ADR_001.md` →
`docs/architecture/guava-os-operating-contract.md` → playbooks → skills
(`.omp/skills/`) → tools.

## Choose your playbook

- Planning, Linear, review → `.guava-os/PLAYBOOK.md`
- Execution, dispatch (OMP subagents) → `dispatch` skill
