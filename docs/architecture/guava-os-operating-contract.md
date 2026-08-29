# guava-os Operating Contract

> **Authority:** ratified by ADR_001 (Amendment 2, 2026-08-20). When code or
> documentation conflicts with this contract or ADR_001, ADR_001 wins.
>
> This contract ratifies ADR_001 Amendment 2 (2026-08-20).

## Purpose

Define the ownership seam between the control plane (guava-os), the
orchestration substrate (OMP), the authorization layer (GitHub), and the
project-management provider (Linear). One owner per concern; no shared
ownership; no custom execution engine.

## Ownership table

| Concern | Owner |
|---|---|
| Operating model, governance model, capability model, promotion model, architectural principles | GOS (ADR_001) |
| Planning, task decomposition | guava-os |
| Orchestration (deciding what runs next, driving OMP subagents) | guava-os |
| Governance workflow (review, promotion decisions — operator-facing) | guava-os |
| Project registry | guava-os |
| Linear integration (project management via Linear) | guava-os |
| Cross-project awareness | guava-os |
| Roles (OMP agent types) | guava-os |
| Worker dispatch (subagents) | OMP |
| Worktree isolation | OMP |
| DAG fan-out (parallel / pipeline) | OMP |
| Process supervision, retries, recovery | OMP |
| Authorization (branch protection, required review, required CI) | GitHub |
| Audit trail | GitHub (git history, PRs, CI logs) |
| Workflow state of record | Linear |
| Engineering runtime | OMP |
| Operator session/terminal/workspace layer | Herdr |

## Decision vs enforcement

**guava-os owns decisions** — what happens next, operator-facing: planning,
task decomposition, orchestration, review/promotion decisions, project
registry, Linear project management, roles.

**GitHub owns enforcement** — deterministic, non-bypassable mechanics: branch
protection, required pull-request review, required status checks. A worker
cannot push to `staging` or `production` except through a reviewed, CI-green
merge.

**OMP provides isolation and execution** — isolated worktrees, subagent
dispatch, process supervision. OMP never decides what runs and never grants
merge authority.

**Linear records workflow state** — an issue is the unit of work, the worker's
task contract, and the handoff record. Status carries workflow; `blocks`
carries the dependency DAG.

## Workflow (canonical loop)

1. **Plan** — guava-os reads Linear and decomposes work into scoped
   deliverables (one issue = one observable outcome, one domain + one type +
   one readiness label, tight acceptance criteria).
2. **Write Linear** — issues created/updated with the task contract and
   `blocks` dependencies.
3. **Select ready work** — zero-indegree issues (unblocked, `Todo`,
   `ready-for-work`).
4. **Dispatch** — guava-os fans out ready issues to OMP subagents (`task` /
   `eval agent()`), each in an isolated worktree, typed by `outputSchema`.
5. **Workers push** — each worker verifies, commits (`GUA-### <outcome>`), and
   pushes to `dev/<domain>`.
6. **QA review** — a QA subagent (or CI) reviews the diff against acceptance,
   runs tests, then approves (PR to `staging`) or rejects (comment on the
   issue, status back to In Progress).
7. **Promote to staging** — merge `dev/<domain>` → `staging` (required review
   + required CI).
8. **Promote to production** — a second review gate merges `staging` →
   `production`.
9. **Refresh Linear** — move issues to `Done`; the comment thread is the
   handoff record.

Independent work is simultaneously eligible. The DAG (Linear `blocks`) is the
only ordering constraint; OMP runs 0-indegree work in parallel.

## Branching model

```
production   ← protected: PR from staging + required review + required CI
    ↑
staging      ← protected: PR from dev/* + QA review + required CI
    ↑
dev/backend   dev/frontend   ...   (one per domain; workers push here)
```

- Per-domain dev branches isolate concurrent workers; cross-domain conflicts
  resolve at the staging merge.
- Every commit subject carries the canonical `GUA-###` identifier.
- Two promotion gates: staging review, then production review.

## Inputs / Outputs

**To guava-os:** operator intent (plans, approvals, review decisions); Linear
backlog.

**To OMP:** scoped deliverable task contracts (from Linear issues), typed by
`outputSchema`.

**To GitHub:** branches and pull requests, gated by protection rules.

**To Linear:** issue state (status, comments, dependencies) — the handoff
record.

## Forbidden responsibilities

**guava-os must not:** act as an execution runtime; rebuild an execution
engine; bypass GitHub review; own authorization.

**OMP must not:** decide what runs; grant merge authority; read or write
Linear; make governance decisions.

**Workers (OMP subagents) must not:** merge to staging/production; approve or
promote; read or write Linear; make governance decisions.

**GitHub must not:** plan; make governance decisions; own project management.

## Registry interface

The project registry (`guava-os` at `.guava-os/registry/projects.yml`) is owned
by guava-os. It records project identity, `repo_path`, `git_remote`, and the
Linear project mapping. No other component owns or mutates it.

## Roles

Roles are the seven OMP agent types: `task`, `reviewer`, `scout`, `designer`,
`sonic`, `librarian`, `security-reviewer`. An issue carries no role label — its
**domain** label selects the OMP agent via the `domainAgents` map in
`.guava-os/config.json` (`qa`→`reviewer`, `security`→`security-reviewer`,
`frontend`→`designer`, else→`task`), plus one **type** label and one
**readiness** label. Roles do not own governance, approval, or promotion —
those are operator/QA-gated via GitHub.

## Project management (Linear)

**guava-os owns project management via Linear.** Linear is the provider;
guava-os owns the interface; agents never depend on Linear directly.

```
Agent → guava-os Skills → guava-os Tooling → Linear (provider)
```

Prefer `Agent → guava-os Tooling → Linear`; Linear MCP is a last-resort fallback. Linear network access lives in the
guava-os tooling layer. Linear is the workflow state of record: status, the
task contract, and the handoff comment thread.

## Amendment

This contract ratifies the operator decisions of 2026-08-20 (ADR_001
Amendment 2): OMP is the orchestration substrate; GitHub owns authorization;
Linear is the workflow state of record; per-domain branching with two
promotion gates.
