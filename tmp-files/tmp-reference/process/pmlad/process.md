# Process — How We Build PM Lad

## Workflow

1. **CTO sets direction** — updates the [launch roadmap](../../docs/roadmap/launch-roadmap.md)
2. **Robo proposes sprint** — reads roadmap, breaks into tasks with **persona-per-task breakdown** (mandatory — every plan must list tasks with assigned persona, grouped by wave/execution order)
3. **CTO confirms** — Robo writes [`current-sprint.md`](../plans/current-sprint.md)
4. **Robo dispatches agents** — each gets a persona, template, scope, and task
5. **Agents execute** — in isolated Shoal sessions (git worktrees)
6. **QA validates** — reviews against acceptance criteria + quality gates
7. **Robo reports** — sprint summary to [`reports/`](../plans/reports/)

## Tools

We use **Shoal** for agent orchestration. See [`shoal.md`](../../../shoal.md) for overview.

### Standard Sprint Execution

The canonical flow for executing a sprint with Robo orchestration:

**Phase 1 — CTO plans in Claude chat:**
1. Review roadmap + current state
2. Break phase into waves with persona-per-task breakdown
3. Write/update `current-sprint.md`

**Phase 2 — Launch Robo supervisor:**
```bash
cd pmlad

# Start a Robo instance for this sprint (uses pmlad-robo template)
shoal robo start wave3-robo

# Attach to give Robo its instructions
shoal attach wave3-robo
```

Send Robo the sprint prompt (from `.shoal/prompts/robo-sprint.md.tmpl`), filled in with wave assignments and task details. Robo takes over from here.

**Phase 3 — Robo orchestrates agents:**

Robo uses Shoal MCP tools to manage the agent fleet:

```
1. create_session(name, template, worktree, branch)
   → Spawns agent in isolated tmux session + worktree

2. Poll session_status until agent shows "waiting"
   → Watcher detects agent tool is ready for input

3. send_keys(session_id, dispatch_prompt)
   → Delivers dispatch XML (from agent-dispatch.xml.tmpl)
   → ONLY after confirming "waiting" status

4. Poll session_status while agent works
   → "busy" = working, "waiting" = done or needs approval
   → "error" = escalate to CTO

5. Collect <report> XML → update current-sprint.md → kill_session
```

**Phase 4 — CTO reviews:**

CTO monitors from their Claude chat session:
```bash
shoal ls                    # see all sessions
shoal status                # aggregate health
shoal robo status           # robo instances
git log --oneline -5        # check agent commits
```

### Prompt Templates

Standardized prompts in `.shoal/prompts/`:

| Template | Purpose |
|----------|---------|
| `robo-sprint.md.tmpl` | Robo's startup instructions — waves, orchestration loop, MCP tools |
| `agent-dispatch.xml.tmpl` | Agent dispatch XML — persona, tasks, scope, rules, context files |

Robo fills in template variables and sends to agents. See [`agent-protocol.md`](agent-protocol.md) for the full XML format.

### Agent Communication

- **Robo -> Agent:** `<dispatch>` XML with persona, sprint, tasks, scope, rules
- **Agent -> Robo:** `<report>` XML with task statuses, files, quality, blockers
- **Agents update docs** as they work (sprint status, affected docs)

### Watcher + send_keys (Reliable Pattern)

The Shoal watcher polls tmux panes every 5s and detects agent state via regex:
- `busy` — agent is processing (do not send keys)
- `waiting` — agent is idle, ready for input (safe to send keys)
- `error` — agent hit an error (escalate)

**Rule:** Always confirm `waiting` status via `session_status` before calling `send_keys`. This eliminates the timing brittleness of blind key-sending.

### Dispatch Methods (Ranked)

| Method | Use Case | Reliability |
|--------|----------|-------------|
| Robo + MCP tools | Sprint orchestration (primary) | High — watcher-gated, automated |
| `opencode run "prompt"` | Single-task headless dispatch | High — runs to completion |
| `claude --print "prompt"` | Single-task Claude dispatch | High — pipe-friendly |
| `shoal new -b` + TUI | Interactive debugging | Medium — manual |

### OpenRouter Setup

OpenCode supports OpenRouter for model selection:

```bash
export OPENROUTER_API_KEY="your-key"
```

Configure model in opencode settings for per-task model selection.

## Personas

Defined in `pmlad/.claude/personas/`. See [`shoal.md`](../../../shoal.md) for the full list.

Every task must be assigned a persona. No unassigned work.

**Planning rule:** All sprint proposals and phase plans must include a persona-per-task breakdown table (Task ID | Persona | Description | Status | Acceptance Criteria), grouped by execution wave. Plans without persona assignments are incomplete and will be rejected.

## Quality Gates

All tasks must pass before completion:

| Gate | Command | Threshold |
|------|---------|-----------|
| Lint | `pnpm lint` | 0 errors |
| Build | `pnpm build` | Clean compile |
| Tests | `pnpm test` | All passing |
| Coverage | per-package `test:cov` | >=80% |

## Approval Matrix

- **Auto:** Write code, run tests, create branches, journal writes
- **Robo decides:** Task re-prioritization, agent restarts
- **CTO required:** Roadmap changes, new deps, Prisma schema, API contracts, scope changes
