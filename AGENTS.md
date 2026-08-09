# Guava-OS

## Purpose

guava-os is the control plane over gorp: it plans, manages Linear, and
orchestrates. gorp (`gorp/`) executes. guava-os is also gorp's first governed
consumer — gorp builds guava-os, a compounding loop.

## Owners

- **guava-os** (`.guava-os/`) — decisions: planning, Linear integration,
  orchestration, review/promotion workflow, project registry.
- **gorp** (`gorp/`) — enforcement: execution graphs, worker dispatch,
  worktree isolation, gates, audit.

## Authority Hierarchy

`ADR_001.md` wins every conflict. Read order: `ADR_001.md` →
`docs/architecture/guava-os-gorp-contract.md` → playbooks → skills
(`.omp/skills/`) → tools / runtime.

## Choose your playbook

- Planning, Linear, review → `.guava-os/PLAYBOOK.md`
- Execution, dispatch, gates, audit → `gorp/PLAYBOOK.md`
