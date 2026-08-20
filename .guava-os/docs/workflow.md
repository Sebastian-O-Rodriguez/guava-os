# Workflow

guava-os plans; project sessions dispatch; subagents execute; GitHub authorizes.

```text
operator ↔ guava-os (manager) → Linear issues (role label, scope, acceptance)
        ↓
project session (dispatcher) → load open issues → subagent per role
        ↓
subagent: implement → verify → commit GUA-### → dev/<role>
        ↓
QA review → merge dev/<role> → staging → (2nd review) → production
        ↓
pm comment + move status → Linear refresh
```

## Manager loop

1. `guava-os work --all` — nothing open → close.
2. Plan: decompose into scoped deliverables (one issue = one outcome, one role
   label, tight acceptance).
3. Write Linear via `pm` (create/update/link/deps).
4. On approval, the issue is ready for a project session to dispatch.

## Dispatch loop (project)

1. `guava-os work` — no open issues → close.
2. Load open issues (role + scope + acceptance).
3. Fan out each to an OMP subagent of its role (decide tree per role in
   `~/dev/guava-os/docs/workflow/roles/`).
4. Subagent implements, `verify`, commits, and the result comment moves status
   to In Review.

## Promotion

Two review gates, GitHub-enforced: QA (dev/<role> → staging), then operator
(staging → production).