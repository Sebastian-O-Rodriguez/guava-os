# Agent Protocol — Dispatch & Reporting

Standardized XML format for all agent communication. Robo dispatches agents with `<dispatch>`, agents report back with `<report>`.

---

## Dispatch Format (Robo -> Agent)

Robo sends this to every agent at session start via `send_keys`:

```xml
<dispatch>
  <persona>Backend</persona>
  <sprint>Phase-4</sprint>
  <session>phase4-api</session>

  <context>
    <read>.claude/personas/backend.md</read>
    <read>.shoal/plans/current-sprint.md</read>
    <read>.shoal/project/conventions.md</read>
    <read>.shoal/project/agent-protocol.md</read>
  </context>

  <tasks>
    <task id="4A1" status="pending">
      <title>Implement portfolio overview endpoint</title>
      <scope>apps/api/src/dashboard/</scope>
      <acceptance>GET /v1/dashboard/portfolio returns occupancy, revenue, blocked invoices</acceptance>
    </task>
    <task id="4A2" status="pending">
      <title>Add dashboard controller tests</title>
      <scope>apps/api/src/dashboard/, apps/api/test/</scope>
      <acceptance>>=80% coverage, all tests pass</acceptance>
    </task>
  </tasks>

  <rules>
    - ONLY modify files within the scope listed per task
    - Do NOT touch system files (CLAUDE.md, .shoal/*, docs/ssot/*)
    - Do NOT convert imports to "import type" (breaks NestJS DI)
    - Update task status in current-sprint.md as you work
    - Update any docs that reference code you changed
    - When done, output a report using the report format below
    - Commit with: --author="Gorp, Guava AI <gorp@guava.ai>"
    - Commit body must include persona and sprint name
  </rules>
</dispatch>
```

---

## Report Format (Agent -> Robo)

Agents output this after completing work (or when blocked):

```xml
<report>
  <persona>Backend</persona>
  <sprint>Phase-4</sprint>
  <session>phase4-api</session>

  <tasks>
    <task id="4A1" status="done">
      <summary>Implemented GET /v1/dashboard/portfolio with occupancy and revenue aggregation</summary>
      <files>
        apps/api/src/dashboard/dashboard.controller.ts
        apps/api/src/dashboard/dashboard.service.ts
        apps/api/src/dashboard/dashboard.module.ts
      </files>
      <tests>12 passing, 92% coverage</tests>
    </task>
    <task id="4A2" status="in-progress">
      <summary>Controller tests written, service tests remaining</summary>
      <blockers>None</blockers>
    </task>
  </tasks>

  <docs-updated>
    .shoal/plans/current-sprint.md (task statuses)
  </docs-updated>

  <quality>
    <lint>0 errors</lint>
    <build>clean</build>
    <tests>all passing</tests>
    <coverage>92%</coverage>
  </quality>

  <commits>
    feat(api): implement portfolio overview endpoint
  </commits>

  <blockers>
    <!-- omit if none -->
  </blockers>

  <notes>
    Dashboard service needs read model for revenue — using direct Prisma query for now.
    Suggest architect review for read model extraction.
  </notes>
</report>
```

---

## Worktree Context Warning

Agents run in git worktrees. Some files may not exist in the worktree:

- `.shoal/project/*.md` — process docs (may not be tracked by git)
- `docs/ssot/*.md` — SSOT docs (may not be tracked)

**Rule:** If a `<context>` file is missing, skip it and continue. Do not fail or block on missing context files. The dispatch XML itself contains everything you need.

## Agent Work Loop

Every agent follows this loop:

1. **Receive dispatch** — read the `<dispatch>` XML
2. **Read context** — load files listed in `<context>` (skip any that don't exist)
3. **For each task:**
   a. Set task status to `in-progress` in `current-sprint.md`
   b. Implement within declared `<scope>`
   c. Run quality gates (`pnpm lint`, `pnpm test`, `pnpm build`)
   d. Commit with conventions (author, persona, sprint in body)
   e. Update task status to `done` (or `blocked`) in `current-sprint.md`
   f. Update any docs that reference changed code
4. **Output report** — produce `<report>` XML with all task results
5. **If blocked** — set status to `blocked`, include `<blockers>` in report, stop and wait for Robo

---

## Blocker Format (inside report)

```xml
<blockers>
  <blocker severity="high">
    <summary>Read model for revenue does not exist</summary>
    <affected>4A1</affected>
    <tried>Direct Prisma aggregation works but bypasses read model pattern</tried>
    <suggestion>Architect creates revenue read model, then backend consumes it</suggestion>
  </blocker>
</blockers>
```

Severities: `low`, `medium`, `high`, `critical`

---

## Doc Update Rule

Agents MUST update docs when their changes affect documented behavior:

- **`current-sprint.md`** — update task statuses as you work (always)
- **`pmlad/CLAUDE.md`** — if you add/change codebase patterns or gotchas
- **`docs/roadmap/launch-roadmap.md`** — if a phase status changes (via Robo only)
- **Inline code docs** — if you change API endpoints, update swagger decorators
- **Test docs** — if test count or coverage changes significantly

If unsure whether a doc needs updating, note it in `<notes>` for Robo to decide.
