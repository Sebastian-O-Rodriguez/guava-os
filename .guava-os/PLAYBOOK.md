# guava-os Playbook

The control-plane operating loop. guava-os understands projects, plans work,
manages Linear, and orchestrates OMP subagents. It never executes directly —
OMP subagents execute, GitHub authorizes (ADR_001 Amendment 2).

Authority: `ADR_001.md` → `docs/architecture/guava-os-operating-contract.md` →
this playbook → skills (`.omp/skills/`) → tools (`.guava-os/src/`).

Layout & operating model (where checkouts live, dev isolation rules):
`docs/architecture/repo-layout.md`.

## Bootstrap Order

Every governed project MUST complete the bootstrap before any execution:

1. **Create a minimal repo** — a real git repository on this machine.
   `guava-os register` creates it if missing (`git init`), but the operator may
   also clone it by hand. A bare path or a registry entry with no corresponding
   directory is NOT sufficient.
2. **Register with canonical git remote** — `guava-os register <id> --repo
   <path> --remote <url>`. Records `git_remote` in
   `.guava-os/registry/projects.yml` and sets the local `origin` remote.
   `guava-os doctor` verifies the registry remote matches local `origin`.
3. **Execute** — now issues are ready to dispatch to OMP subagents.

## Branching model

```
production   ← protected: PR from staging + required review + required CI
    ↑
staging      ← protected: PR from dev/* + QA review + required CI
    ↑
dev/task   dev/designer   ...   (one per role; workers push here)
```

- Workers push to `dev/<role>` — never to staging/production.
- Every commit subject carries `GUA-### <outcome>`.
- Promotion is two-gated: QA review to staging, then a second review to
  production. GitHub enforces both via branch protection.

## Loop

1. **Understand** — operator intent + live Linear state + target repo docs.
   Skill: `planning`.
2. **Plan** — decompose into scoped deliverables: one issue = one observable
   outcome, one role label, tight acceptance, explicit out-of-scope. Scope
   for the worker (`default`/`smol` tier), not the ambition. Skill: `planning`.
3. **Write Linear** — create/update issues, dependency links, statuses. The
   issue description IS the worker's task contract and the subagent prompt.
   Skill: `linear`.
4. **Select ready work** — zero-indegree issues (unblocked, `Todo`, one role
   label). Skill: `planning`.
5. **Dispatch** — fan out ready issues to OMP subagents (`task`/`eval agent()`),
   each in an isolated worktree, typed by `outputSchema`. Skill: `dispatch`.
6. **Workers push** — verify (`verify` skill), commit (`GUA-### <outcome>`),
   push to `dev/<role>`. Skill: `dispatch`.
7. **QA review** — review diff vs acceptance, run tests, approve (merge
   `dev/<role>` → `staging`) or reject (comment + status back). Skill:
   `review`.
8. **Promote to production** — a second, separate review gate merges `staging`
   → `production`. Skill: `review`.
9. **Refresh Linear** — move issues to `Done`; the comment thread is the
   handoff record. Skill: `linear`.

> **Independent work = simultaneously eligible, run in parallel.** Zero-indegree
> issues are dispatched together via OMP `parallel`/`pipeline`. `blocks` edges
> are hard result-dependencies only (GOS-44); never serialize independent work.

## Ownership

- guava-os owns: planning, decomposition, orchestration (OMP subagents), Linear
  integration, review/promotion workflow, project registry, roles.
- OMP owns: runtime, subagent dispatch, worktree isolation, DAG fan-out,
  process supervision.
- GitHub owns: authorization (branch protection, required review, required CI).
- Linear owns: workflow state of record (the issue + comment thread).
- Agents reach Linear only through guava-os tooling — never Linear MCP directly.

## Skills

| Skill | Owns |
|---|---|
| `planning` | read pattern, sprint shape, board health, ready-work selection |
| `linear` | all Linear operations + result handoff protocol |
| `dispatch` | OMP subagent dispatch, DAG fan-out, verify, push |
| `review` | QA review + promotion (dev → staging → production) |
| `verify` | quality gates (types/test/scope) |
| `handoff` | session continuity (Linear issue is the state) |
