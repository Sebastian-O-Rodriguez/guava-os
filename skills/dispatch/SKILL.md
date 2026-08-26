---
name: dispatch
description: "Project-session dispatcher — load this repo's ready-for-work Linear issues and delegate each to its domain's OMP agent. guava-os planned; the subagents execute."
domain: pm
role: manager
order: 5

metadata:
  author: guava-os
  version: "0.4.0"
---

## Dispatch

A project session is a **dispatcher**, not an executor. Planning and scoping
happened upstream in guava-os. This session: loads the project's
`ready-for-work` issues and delegates each to its domain's OMP agent.

## Loop
1. **Gate** — `guava-os work` (this project). Nothing ready → close the session.
2. **Load** — read open issues (`pm search --status Todo`); each dispatchable
   issue carries one **domain** label (`pm` / `qa` / `security` / `backend` /
   `frontend` / `devops` / `ai-ml`), one **type** label, and the
   **`ready-for-work`** readiness label. Never fan out an issue without
   `ready-for-work` (anything else → stop and surface, don't dispatch).
3. **Assemble Context** — compile the worker context with
   `manual/scripts/inject.mjs`. The worker receives:
   - Task contract (why, scope, out_of_scope, acceptance)
   - Behavior (implement / judge — terminal action + authorization)
   - Domain routing decision tree
   - Engineering invariants (small stable core)
   - Execution protocol
   - Activated domain guidance (concise bullets)
   - Available skills for progressive retrieval (`skill://<name>`)
   - Completion contract (evidence required)
4. **Dispatch** — fan out each ready issue to its domain's OMP agent
   (`agent: config.domainAgents[domain]` — e.g. qa→reviewer,
   security→security-reviewer, frontend→designer, rest→task), passing the
   assembled context as the task payload and an `outputSchema`.
5. **Isolate** — each subagent edits in an isolated worktree (`isolated: true`).
6. **Hand off** — on completion, verify the completion contract, write the
   result comment, and move status (`pm comment` + `pm move In Review`).

## Domain → agent

The mapping is `domainAgents` in `.guava-os/config.json` — one domain, one
OMP agent (model + disposition + tools), one behavior. No separate role label:

| Domain | OMP agent | Behavior |
|---|---|---|
| `pm` | task | implement |
| `qa` | reviewer | judge |
| `security` | security-reviewer | judge (read-only) |
| `backend` | task | implement |
| `frontend` | designer | implement |
| `devops` | task | implement |
| `ai-ml` | task | implement |

## Context Assembly

Before dispatching a subagent, assemble its task payload using `inject.mjs`:
```bash
node ~/dev/guava-os/manual/scripts/inject.mjs task-payload.json
```
Full skills are **never** inlined into default prompts; they are advertised under
`# AVAILABLE SKILLS` for progressive on-demand retrieval (`read skill://<name>`).

## Uses
- `guava-os work` — session gate (ready work for this project)
- `guava-os triage` — set readiness labels before dispatch (run by planning/operator)
- `manual/scripts/inject.mjs` / `context-assembly` — compile task context
- `task` — dispatch a subagent per ready issue (agent = domain agent)
- `pm comment` / `pm move` — result handoff (via the `linear` skill)
- `skill://behavior` — the injected behavior (implement / judge)