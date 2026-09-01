# Workflow

guava-os plans; project sessions dispatch; subagents execute; GitHub authorizes.

```text
operator ↔ guava-os (manager) → Linear issues (domain/type/readiness labels, scope, acceptance)
        ↓
project session (dispatcher) → load open issues → subagent per domain
        ↓
subagent: implement → verify → commit GUA-### → dev/<domain>
        ↓
QA review → merge dev/<domain> → staging → (2nd review) → production
        ↓
pm comment + move status → Linear refresh
```

## Manager loop

1. `gos work --all` — nothing open → close.
2. Plan: decompose into scoped deliverables (one issue = one outcome, one domain
   + one type + one readiness label, tight acceptance).
3. Write Linear via `pm` (create/update/link/deps).
4. On approval, the issue is ready for a project session to dispatch.

## Dispatch loop (project)

1. `gos work` — no open issues → close.
2. Load open issues (domain + scope + acceptance).
3. Fan out each to an OMP subagent of its domain (via the `domainAgents` map in
   `.guava-os/config.json`).
4. Subagent implements, `verify`, commits, and the result comment moves status
   to In Review.

## Promotion

Two review gates, GitHub-enforced: QA (dev/<domain> → staging), then operator
(staging → production).