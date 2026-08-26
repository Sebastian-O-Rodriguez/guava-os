# Project-Root Planning Routing (CANONICAL)

> How a registered non-GOS project routes a planning request into the shared
> guava-os playbook + skills from its own repo root — with no manual GOS-path
> steering. Authority: `ADR_001.md` → this doc (a companion to
> `docs/architecture/repo-layout.md`).

## Problem

`planning` and `linear` skills live in `~/dev/guava-os/.omp/skills/`; the
`pm` tooling resolves from the guava-os checkout. A project session (cwd =
`~/dev/repos/<project>`) does not see those skills: the OMP harness discovers
skills and slash-commands from `<cwd>/.omp/` and `~/.omp/agent/`, not from
`~/dev/guava-os/.omp/`. Without a bootstrap, an agent at a project root must
manually know and type the guava-os paths and tooling — the steering this doc
removes.

## Route

```
cd <project>
  → /planning request            (.omp/commands/planning.md — slash command)
  → AGENTS.md routing            (auto-loaded context at project root)
  → guava-os PLAYBOOK            (~/dev/guava-os/.guava-os/PLAYBOOK.md)
  → planning skill               (~/dev/guava-os/.omp/skills/planning/SKILL.md)
  → guava-os pm tooling          (run from the project root; binary at ~/dev/guava-os/.guava-os/bin/guava-os)
  → Linear-ready sprint
```

## Prerequisites (registration)

A project is routable once it is:

1. Registered in `~/dev/guava-os/.guava-os/registry/projects.yml` (repo_path
   present) — required for execution.
2. Has `.guava-os/config.json` (team, project, domains, domainAgents, invariants
   `max_subtasks_per_parent`).
3. Has the two bootstrap files below at its repo root.

## Bootstrap files

### 1. `AGENTS.md` (project root)

Auto-loaded by the harness from the project root (discovery walks ancestors of
cwd). Routes planning + tooling; no steering required.

```markdown
# <Project> — governed by guava-os

<Project> is a registered guava-os consumer. Planning and execution go through
the shared guava-os control plane (~/dev/guava-os).

## Planning requests
When asked to plan (a sprint, a request, /planning):
1. Read the guava-os playbook: ~/dev/guava-os/.guava-os/PLAYBOOK.md
2. Follow the planning skill: ~/dev/guava-os/.omp/skills/planning/SKILL.md
3. Read this repo's config (.guava-os/config.json) + live Linear state via
   guava-os tooling. Sprint scope comes from the repo's domain docs, not the
   agent's head.
4. Produce a Linear-ready sprint: canonical GUA-### ids (pm create prints
   them), one domain label per child, children per parent ≤
   max_subtasks_per_parent, DoR = `pm search --json | validate` exits 0.

## Tooling
Prefer guava-os tooling for Linear; Linear MCP is a last-resort fallback. Run the CLI from THIS
repo root so it loads this project's .guava-os/config.json (project, domains,
invariants); the binary lives in the guava-os checkout:
  ~/dev/guava-os/.guava-os/bin/guava-os pm <cmd>
```

### 2. `.omp/commands/planning.md` (project root)

A file-based OMP slash command — registers `/planning` in project sessions.
`$ARGUMENTS` forwards the caller's request text.

```markdown
---
description: Route a planning request through the guava-os planning skill
---
$ARGUMENTS

This is a planning request. Route it through guava-os (no manual path
steering, no Linear MCP):
1. Read ~/dev/guava-os/.guava-os/PLAYBOOK.md, then the planning skill
   ~/dev/guava-os/.omp/skills/planning/SKILL.md.
2. Read .guava-os/config.json + live Linear state for this project via
   guava-os tooling.
3. Produce a Linear-ready sprint: canonical GUA-### ids (from pm create
   output), one domain label per child, children per parent ≤
   max_subtasks_per_parent (3), DoR via (run from this repo root so the
   project config loads): `pm search --json | validate` where the binary is
   ~/dev/guava-os/.guava-os/bin/guava-os, exiting 0.
```

## Verification (dry run)

Deploy both files, then from the project root confirm:

- `/planning request` expands through the routing (no steering).
- A sprint plan is produced with canonical `GUA-###` ids, no alias leakage.
- Parent-limit behavior matches `max_subtasks_per_parent` (cap enforced).
- DoR validate exits 0. No MCP fallback.

## Related

- GOS-38 (canonical identity), GOS-39 (cap enforcement), GUA-96 (CLI
  canonical-id output).
- `docs/architecture/linear-conventions.md` (identity rule).
