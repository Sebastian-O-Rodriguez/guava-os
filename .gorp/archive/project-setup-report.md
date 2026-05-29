# DEPRECATED

> This file is archival only.
> The orchestration system has been replaced by Linear-driven execution.
> Do NOT derive process, dispatch flow, or reporting patterns from this file.

# RoutineMe — Project Setup & Orchestration Report

> **Purpose**: This document explains how RoutineMe's Claude Code multiagent system is configured, so the same patterns can be replicated in another repo.

---

## 1. Directory Layout

```
ROUTINEME/
├── CLAUDE.md                          ← Product spec + agent system definition
├── .claude/
│   ├── settings.json                  ← Hooks (auto-format, safety guards)
│   ├── settings.local.json            ← Per-machine permission allowlist
│   └── agents/                        ← Agent definitions (one AGENT.md each)
├── .gorp/
│   ├── plans/                         ← Roadmap + current sprint
│   ├── process/                       ← Conventions, agent protocol, approval matrix
│   ├── docs/                          ← Tamagui style guide
│   ├── reports/                       ← This file
│   └── journal/                       ← Daily agent reports (append-only)
├── app/                               ← Expo Router pages + API routes
│   ├── _layout.tsx                    ← Root layout (auth + theme providers)
│   ├── auth.tsx                       ← Login/signup
│   ├── index.tsx                      ← Home screen
│   ├── dashboard.tsx                  ← Summary dashboard
│   └── api/                           ← Server API routes (all require auth)
├── components/                        ← UI components (nav, now, ui)
├── hooks/                             ← React hooks (layout, data fetching)
├── lib/                               ← Business logic, auth, chat, scripts
│   └── scripts/                       ← Deterministic mutation + query scripts
├── tests/                             ← Vitest test files
├── prisma/                            ← Schema + migrations (reference, not active ORM)
├── tamagui.config.ts                  ← Theme + token config
└── themes.ts                          ← Dark/light palettes
```

---

## 2. CLAUDE.md — The Product Spec

`CLAUDE.md` sits at the project root and is automatically loaded into every Claude Code conversation. It serves as **the single source of truth** for what the project is and how agents should behave.

### Structure

| Section             | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| **Product**         | One-liner description, target UX (<60s sessions)                 |
| **Stack**           | Tech choices (Expo, Tamagui, Supabase Auth, OpenRouter)          |
| **Architecture**    | Auth, API routes, Supabase, chat pipeline, scripts               |
| **Data Model**      | Tables with user_id, RLS                                         |
| **Views**           | Auth, Home, Dashboard + feature status table                     |
| **UX Rules**        | Tap = primary, chat = secondary, DB = source of truth            |
| **Non-Goals**       | Explicit exclusions                                              |
| **Agent System**    | Table of agents + their roles                                    |
| **Conventions**     | Commit format, branch naming, sprint tracking paths              |
| **Quality Gates**   | tsc, vitest, expo export                                         |
| **Launch Checklist**| Pre-deploy verification items                                    |

### Key Design Decisions

1. **Non-Goals are explicit** — prevents agents from scope-creeping
2. **Architecture section** defines auth, data isolation, chat pipeline
3. **Feature status table** — binary working/missing for each v1 feature
4. **Quality Gates** are concrete shell commands, not vague guidelines
5. **Launch checklist** — non-negotiable items before deploy

---

## 3. Agent Definitions (`.claude/agents/`)

Each agent lives in `.claude/agents/<name>/AGENT.md` and uses YAML frontmatter:

```yaml
---
name: robo
description: Sprint orchestrator that plans work, dispatches agents...
model: opus # or sonnet
tools: Read, Edit, Write, Bash, Grep, Glob, Agent
---
```

### Agent Roster

| Agent         | Model  | Has `Agent` tool? | Role                                                 |
| ------------- | ------ | ----------------- | ---------------------------------------------------- |
| **robo**      | opus   | Yes               | Orchestrator — plans, dispatches, monitors, reports  |
| **architect** | sonnet | No                | Schema design, API contracts, architecture decisions |
| **backend**   | sonnet | No                | Server actions, Prisma queries, business logic       |
| **frontend**  | sonnet | No                | React components, pages, charts, interactions        |
| **qa**        | sonnet | No                | Quality gates, code review, acceptance validation    |

### Key Pattern: Only Robo Gets the `Agent` Tool

Robo is the only agent that can spawn other agents. This creates a hub-and-spoke model:

- CTO talks to Robo (or individual agents directly for one-off tasks)
- Robo dispatches work to specialized agents
- Agents report back via journal files
- Robo collects results and reports to CTO

### What Each Agent File Contains

1. **Identity** — "You are the X agent for RoutineMe"
2. **Responsibilities** — bullet list of what they own
3. **Context files to read** — which files to check first
4. **Patterns/templates** — code examples showing expected style
5. **Boundaries** — what they must NOT do (enforces separation of concerns)
6. **Report format** — how to write journal entries

### Boundary Enforcement

Each agent has explicit "don't touch" rules:

- **Backend**: "Don't touch UI components (frontend agent's job)"
- **Frontend**: "Don't implement server actions (backend agent's job)"
- **Architect**: "Hand off logic and UI implementation to backend/frontend"
- **All agents**: "Don't touch CLAUDE.md, .gorp/plans/roadmap.md"

This prevents agents from stepping on each other's work.

---

## 4. The `.gorp/` Directory — Workflow Engine

`.gorp/` is the operational brain of the project. It's version-controlled alongside the code.

### `plans/roadmap.md` — The Sacred Document

- Maintained exclusively by the CTO (Sebastian)
- Agents are forbidden from modifying it
- Defines phases (Foundation → Core Views → Polish → Post-Launch)
- Robo reads it to plan sprints but never writes to it

### `plans/current-sprint.md` — Active Work

Contains a markdown table that agents and scripts can parse:

```markdown
# Sprint: [Name]

Date: YYYY-MM-DD
Phase: [from roadmap]

## Tasks

| ID  | Agent     | Task                | Status  | Acceptance Criteria       |
| --- | --------- | ------------------- | ------- | ------------------------- |
| 1A  | architect | Design habit schema | pending | Prisma schema + migration |
| 1B  | backend   | Implement CRUD      | pending | Server actions pass tests |

## Dependencies

- 1B depends on 1A
```

The `dispatch.sh` script parses this file to find `pending` tasks and dispatch them.

### `process/` — Rules of Engagement

Three files define how agents work together:

**`conventions.md`** — Standards everyone follows:

- Git branch naming (`feat/`, `fix/`, `chore/`)
- Commit format (`type(scope): description`)
- Code rules (TypeScript strict, no `any`, dark theme only)
- Quality commands to run before PRs

**`agent-protocol.md`** — Communication format:

- How Robo dispatches (CLI commands + prompt structure)
- How agents report back (journal file format)
- How to escalate blockers (severity levels + context)

**`approval-matrix.md`** — Three-tier permission system:

- **Auto-approved**: Write code, run tests, create branches, write journals
- **Robo decides**: Task re-prioritization, agent reassignment
- **CTO required**: Roadmap changes, new deps, schema changes, deploy, env vars

### `prompts/dispatch.md.tmpl` — Dispatch Template

A mustache-style template used to build agent dispatch prompts:

```markdown
## Task

ID: {{TASK_ID}}
Title: {{TASK_TITLE}}
Agent: {{AGENT}}
Sprint: {{SPRINT}}

## Context — Read These First

- `CLAUDE.md` — Product spec
- `.gorp/plans/current-sprint.md` — Sprint breakdown

## Scope

Files to create/modify: {{SCOPE}}

## Acceptance Criteria

{{CRITERIA}}

## Rules

- Only modify files within scope
- Don't touch: CLAUDE.md, .gorp/plans/roadmap.md
- Write journal entry when done
- Run quality gates before reporting done
```

### `journal/` — Agent Activity Log

One file per agent per day. Format: `.gorp/journal/<agent>-YYYY-MM-DD.md`

Agents write their own journals with:

- Task ID and title
- Status (done / in-progress / blocked)
- Files modified
- Test results
- Summary of work
- Blockers (if any)

Robo reads these to track progress. QA reads them for review context.

---

## 5. Scripts

### `scripts/dispatch.sh` — Parallel Agent Dispatcher

```bash
./scripts/dispatch.sh <sprint-name>
```

What it does:

1. Reads `current-sprint.md`
2. Finds all rows with `pending` status via `grep`
3. Parses each row to extract: ID, agent, task, criteria
4. Validates agent name against allowed list (`architect backend frontend qa`)
5. Builds a dispatch prompt from the parsed data
6. Runs `claude -p "<prompt>" --agent <name> --output-format json` in background
7. Saves output to `journal/<agent>-<id>-dispatch.json`
8. Waits for all agents to complete

This enables launching an entire sprint's work with one command.

### `scripts/quality-gate.sh` — Quality Validation

```bash
./scripts/quality-gate.sh [types|lint|format|build|test|prisma|all]
```

Runs each gate and reports pass/fail with a count summary. Exit code 1 if any fail.

---

## 6. Claude Code Settings (`.claude/settings.json`)

### Hooks

Two hooks enforce quality and safety:

**PostToolUse — Auto-format on save**:

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "... npx prettier --write \"$file\" ...",
      "timeout": 10000
    }
  ]
}
```

Every time an agent edits or writes a `.ts/.tsx/.js/.jsx` file, Prettier auto-formats it.

**PreToolUse — Block destructive git commands**:

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "... if echo \"$cmd\" | grep -qE 'git\\s+(push\\s+--force|reset\\s+--hard|clean\\s+-f|checkout\\s+\\.|restore\\s+\\.)'; then echo 'BLOCKED' >&2; exit 2; fi"
    }
  ]
}
```

Prevents any agent from running `git push --force`, `git reset --hard`, `git clean -f`, `git checkout .`, or `git restore .`. This is the safety net — even if an agent tries a destructive command, it gets blocked before execution.

### Local Settings (`.claude/settings.local.json`)

Contains a permissions allowlist for specific commands used during development. This file is machine-specific and grows as you approve new commands. It's essentially a history of allowed operations — not something you'd copy to another repo.

---

## 7. Memory System

The memory system lives at `~/.claude/projects/<project-path>/memory/` and persists across conversations.

- `MEMORY.md` — Index file loaded into every conversation (kept under 200 lines)
- Individual memory files with frontmatter (`type: user|feedback|project|reference`)
- Stores: project status, architecture decisions, deployment info, gotchas, known issues

This is managed by Claude Code's auto-memory system, not something you configure manually.

---

## 8. How It All Flows Together

### Sprint Lifecycle

```
1. CTO updates roadmap.md with next phase
2. CTO runs: claude --agent robo
3. Robo reads roadmap + current state → proposes sprint in current-sprint.md
4. CTO approves (or adjusts) the sprint plan
5. Robo dispatches agents (or CTO runs dispatch.sh)
6. Agents work in parallel:
   - Read CLAUDE.md + current-sprint.md
   - Implement within their scope
   - Write journal entries
   - Run quality gates
7. QA agent validates all work
8. Robo collects reports, updates sprint status
9. CTO reviews, merges, deploys
```

### Single-Task Dispatch

For quick one-off tasks outside a sprint:

```bash
# Direct agent invocation
claude -p "Implement habit CRUD server actions" --agent backend

# With worktree isolation
claude --worktree feat/monthly-grid --agent frontend
```

---

## 9. Reproducing This Setup in Another Repo

### Step 1: Create CLAUDE.md

Write a product spec covering:

- What the project is (1-2 sentences)
- Stack table
- Architecture constraints (what you will NOT do)
- Data model (pseudocode)
- Features/views
- UX rules
- Non-goals (critical for preventing scope creep)
- Agent system table
- Conventions (git, code style)
- Quality gates (concrete commands)
- Approval matrix

### Step 2: Create Agent Definitions

```
.claude/agents/
├── robo/AGENT.md        ← opus, has Agent tool
├── architect/AGENT.md   ← sonnet, design-only
├── backend/AGENT.md     ← sonnet, server-side code
├── frontend/AGENT.md    ← sonnet, UI code
└── qa/AGENT.md          ← sonnet, validation
```

Each needs:

- YAML frontmatter (name, description, model, tools)
- Identity statement
- Responsibilities
- Context files to read
- Code patterns/templates
- Boundaries (what NOT to do)
- Report format

### Step 3: Create `.gorp/` Structure

```
.gorp/
├── plans/
│   ├── roadmap.md          ← Your phases and milestones
│   └── current-sprint.md   ← Empty template ready for first sprint
├── process/
│   ├── conventions.md      ← Your git/code/sprint standards
│   ├── agent-protocol.md   ← Dispatch/report/blocker formats
│   └── approval-matrix.md  ← Permission tiers
├── prompts/
│   └── dispatch.md.tmpl    ← Agent dispatch template
└── journal/                ← Empty dir, agents will populate
```

### Step 4: Add Scripts

Copy and adapt:

- `scripts/dispatch.sh` — update valid agent names
- `scripts/quality-gate.sh` — update gate commands for your stack

### Step 5: Configure Hooks

In `.claude/settings.json`:

- PostToolUse: auto-format on Edit/Write
- PreToolUse: block destructive git commands

### Step 6: Initialize Memory

Memory bootstraps itself over conversations. The first conversation should establish:

- Project status
- Key architecture decisions
- Deployment info
- Known gotchas

---

## 10. What We Did NOT Do (Anti-Patterns Avoided)

1. **No complex CI/CD** — quality gates are simple shell commands
2. **No task management tool** — markdown tables in `current-sprint.md`
3. **No inter-agent messaging** — journal files are the communication layer
4. **No agent state** — agents are stateless; all context comes from files
5. **No custom tooling** — everything uses Claude Code's built-in agent system
6. **No over-abstraction** — `.gorp/` is just markdown files in directories
7. **No lock-in** — the entire system is portable plain text
