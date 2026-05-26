# Agent-OS Separation Plan

Private plan for extracting Agent-OS from the RoutineMe repository into a future standalone private repository.

Agent-OS is internal Guava AI developer infrastructure. It is not a public project and should not be surfaced as one.

## 1. Current Repo Inventory

The RoutineMe repo contains two independent systems sharing a single git history and `package.json`:

| System | Purpose | Runtime coupling |
|--------|---------|-----------------|
| **RoutineMe** | Expo/React Native habit tracker with NLP pipeline | Production application |
| **Agent-OS** | Linear-driven multi-agent execution CLI for Claude Code | Developer infrastructure (never runs in production) |

**Top-level layout:**

```
ROUTINEME/
├── app/                    # RoutineMe (Expo Router pages + API routes)
├── assets/                 # RoutineMe (images, icons, splash)
├── components/             # RoutineMe (React/Tamagui components)
├── lib/                    # RoutineMe (core logic, auth, chat pipeline, actions, scripts)
├── prisma/                 # RoutineMe (schema + 6 migrations)
├── tests/                  # RoutineMe (3 test suites)
├── docs/                   # Shared (this plan)
├── .agent-os/              # Agent-OS (CLI source, config, tests, docs)
├── .claude/                # Agent-OS (agents, skills, settings, hooks)
│   └── projects/           # Claude Code session memory (local, not committed to main)
├── .gorp/                  # Mixed (process=Agent-OS, context=RoutineMe, archive=mostly RoutineMe)
├── CLAUDE.md               # Mixed (~90% Agent-OS, ~10% RoutineMe)
├── README.md               # RoutineMe only
├── package.json            # Shared (1 agent-os script, 4 app scripts)
├── app.json                # RoutineMe
├── eas.json                # RoutineMe
├── .env.example            # RoutineMe
├── tsconfig.json           # RoutineMe (app-level, strict)
├── vitest.config.ts        # Shared (runs both app and agent-os tests)
├── babel.config.js         # RoutineMe
└── .gitignore              # Shared (3 lines reference .agent-os/)
```

## 2. Boundary Definition

**RoutineMe** is everything that runs in the Expo/React Native application, its server-side API routes, database migrations, and associated tests. It has no dependency on Agent-OS at runtime or build time.

**Agent-OS** is everything that supports Linear-driven, Claude Code-assisted, multi-persona development orchestration. It is invoked only by developers (or Claude Code agents) during development. It never ships to production.

**The two systems have zero runtime coupling.** Agent-OS does not import from `app/`, `lib/`, `components/`, or `prisma/`. RoutineMe does not import from `.agent-os/`, `.claude/agents/`, or `.gorp/process/`. The only shared touchpoints are:

- `package.json` (one `"agent-os"` script entry)
- `CLAUDE.md` (mixed content)
- `.gorp/context/` (app architecture docs referenced by agent protocol)
- `vitest.config.ts` (test runner config covers both)
- Dev dependencies (`tsx`, `vitest` used by agent-os; `vitest` also by app tests)

## 3. Files That Stay in RoutineMe

These are unambiguously RoutineMe application code:

```
app/                              # Expo Router pages and API routes
assets/                           # App icons, splash, images
components/                       # React/Tamagui UI components
lib/                              # Core app logic (auth, chat, actions, scripts, types)
prisma/                           # Schema + 6 migrations
tests/security.test.ts            # App security tests
tests/action-executor.test.ts     # App action executor tests
tests/chat-workflows.test.ts      # App chat pipeline tests
README.md                         # App README (already written, no agent-os references)
.env.example                      # App environment variables
app.json                          # Expo config
eas.json                          # EAS build/deploy profiles
babel.config.js                   # Babel config
tsconfig.json                     # TypeScript config (strict)
package.json                      # After removing agent-os script + deps
package-lock.json                 # After clean install
vitest.config.ts                  # After removing agent-os test paths
.gitignore                        # After removing .agent-os lines
```

RoutineMe also retains its own `.gorp/` directory with app-specific content:

```
.gorp/
  context/
    architecture.md               # RoutineMe state engine, layer model, DB schema, action flow
    product-spec.md                # RoutineMe product identity, locked data model, UI model
    tamagui-style-guide.md         # Tamagui component rules, tokens, patterns
  archive/
    current-sprint.md              # Sprint 11 plan (deprecated, reference only)
    roadmap.md                     # Product roadmap phases 1-7 (deprecated)
    v3-platform-migration.md       # Expo/Tamagui migration from Next.js (deprecated)
    react-liquid-gauge.md          # Deprecated component reference
    journal/                       # 15 session journals (app implementation history)
      architect-2026-03-11-settings.md
      backend-2026-03-10.md
      backend-2026-03-28.md
      backend-2026-03-31.md
      frontend-2026-03-10.md
      frontend-2026-03-11.md
      frontend-2026-03-28.md
      frontend-2026-03-30.md
      frontend-2026-03-31.md
      frontend-2026-04-01.md
      frontend-2026-04-05.md
      handoff-2026-03-31.md
      qa-2026-03-10.md
      qa-2026-03-11-sprint5.md
      qa-2026-03-11.md
```

**Count: ~15 directories/files (app code) + 21 `.gorp/` files (app docs/history)**

## 4. Files That Move to Private Agent-OS Repo

These are unambiguously Agent-OS infrastructure:

```
.agent-os/                        # Entire directory (CLI source, config, tests, docs, specs, fixtures)
  ├── bin/agent-os                # CLI wrapper
  ├── src/*.ts                    # CLI implementation (cli, config, doctor, status, validate, next, linear)
  ├── tests/*.test.ts             # CLI tests (4 test files)
  ├── docs/*.md                   # CLI documentation (9 doc files)
  ├── specs/*.md + *.json         # Contract specifications (6 files)
  ├── fixtures/*.json             # Test fixtures (3 files)
  ├── pilot/                      # Pilot execution report + snapshots
  ├── config.json                 # Master config (personas, statuses, paths)
  ├── config.schema.json          # Config JSON schema
  ├── tsconfig.json               # Standalone TypeScript config
  ├── USAGE.md                    # Quick start
  └── RUNBOOK.md                  # Operator runbook

.claude/agents/                   # All 5 persona definitions
  ├── architect/AGENT.md
  ├── backend/AGENT.md
  ├── frontend/AGENT.md
  ├── qa/AGENT.md
  └── robo/AGENT.md

.claude/skills/                   # All 4 orchestration skills
  ├── dispatch/SKILL.md
  ├── handoff/SKILL.md
  ├── sprint/SKILL.md
  └── verify/SKILL.md
```

Agent-OS also receives its own `.gorp/` with agent-specific content:

```
.gorp/
  process/                        # Execution protocol (agent-OS specific)
    ├── agent-protocol.md         # Linear SOT, claim rules, subtask eligibility, status lifecycle
    ├── approval-matrix.md        # Permission tiers (auto-approved, robo autonomous, human required)
    └── conventions.md            # Git branch/commit format, persona labels, issue semantics, code rules
  specs/                          # Execution semantics (agent-OS specific)
    ├── execution-state-machine.md  # Canonical execution states, legal transitions, parent lifecycle
    ├── graph-semantics.md        # Node/edge types, persona assignment, dependency rules, invariants
    ├── claim-leases.md           # Claim lifecycle, lease rules, reclamation protocol
    └── violation-codes.md        # Protocol violation registry (V1xx-V5xx), severity levels
  archive/                        # Agent-OS-specific history
    ├── project-setup-report.md   # Agent-OS setup patterns (mixed, but primarily documents agent infra)
    └── journal/
        └── robo-2026-03-10.md    # Robo orchestration session (agent execution, not app work)
```

**Count: ~50+ files across `.agent-os/` + `.claude/agents/` + `.claude/skills/` + `.gorp/` agent-OS content**

## 5. Files That Need Review Before Moving

These files have mixed concerns or unclear ownership:

| File/Directory | Issue | Recommendation |
|---|---|---|
| `CLAUDE.md` | ~90% agent-OS protocol, ~10% app identity | Split (see section 6) |
| `.gorp/process/conventions.md` | Mixes agent persona rules with app code standards and quality gates | Split: app code standards stay, persona/issue semantics move |
| `.gorp/archive/project-setup-report.md` | Documents both Agent-OS setup patterns and RoutineMe context | Move to Agent-OS (primary subject is agent infra setup) |
| `.gorp/archive/journal/robo-2026-03-10.md` | Sprint 1 orchestration — agent dispatches + app task completion | Move to Agent-OS (primary subject is execution orchestration) |
| `.claude/settings.json` | Contains Prettier hooks (app) + git safety hooks (both) | Keep in RoutineMe, copy relevant parts to Agent-OS |
| `.claude/settings.local.json` | Massive permission whitelist, references .agent-os paths | Keep in RoutineMe, prune agent-os references |
| `vitest.config.ts` | Runs both app tests and agent-os tests | Keep in RoutineMe, create separate config for Agent-OS |
| `.gitignore` | 3 lines reference `.agent-os/` paths | Remove those lines after extraction |

**Count: 8 items requiring review**

## 6. CLAUDE.md Split Plan

Current `CLAUDE.md` is ~160 lines. Approximately 90% is agent-OS execution protocol.

### After split, RoutineMe `CLAUDE.md` retains:

```markdown
# RoutineMe

## Stack
(Expo SDK 54, Tamagui, Supabase, OpenRouter, EAS — current lines 1-17)

## Critical Constraints
(Expo Router, API routes, Supabase client, RLS, auth, rate limiting, no mock data — current constraints section)

## Quality Gates
(tsc, vitest, expo export — current gates)

## Non-Goals
(Current non-goals list)

## Deploy
(Production URL, deploy command)
```

### Removed from RoutineMe `CLAUDE.md`:

- Startup Invariant (Linear-first validation)
- Issue Hierarchy (parent vs subtask rules)
- Subtask Eligibility (4-condition gate)
- Validation Examples (agent persona behavior)
- No Executable Work rules (agent halt behavior)
- Priority Mapping (Linear priority labels)
- Authority Hierarchy (source-of-truth ranking)
- Tracking section (Linear team/project/prefix)
- Agent System table (robo, architect, backend, frontend, qa)
- Routing Table (references to .gorp/process and .gorp/context)

### Agent-OS receives:

A new `CLAUDE.md` (or equivalent config) in the Agent-OS repo containing all removed sections, plus references to its own internal docs.

## 7. .gorp/ Split Plan

`.gorp/` is a project documentation and process structure, not an Agent-OS concept. Both repos retain their own `.gorp/` after the split. Content is classified by subject matter, not by folder name.

### Per-file classification

| File | Subject | Disposition |
|---|---|---|
| **context/architecture.md** | RoutineMe state engine, layer model, DB schema, action flow | **Stays in RoutineMe** |
| **context/product-spec.md** | RoutineMe product identity, locked data model, UI model | **Stays in RoutineMe** |
| **context/tamagui-style-guide.md** | Tamagui component rules, tokens, patterns | **Stays in RoutineMe** |
| **process/agent-protocol.md** | Linear SOT, claim rules, subtask eligibility, status lifecycle | **Moves to Agent-OS** |
| **process/approval-matrix.md** | Permission tiers (auto/robo/human) | **Moves to Agent-OS** |
| **process/conventions.md** | Git format, persona labels, issue semantics, code rules | **Needs review** — split app code rules (stays) from persona/issue rules (moves) |
| **specs/execution-state-machine.md** | Agent execution states, transitions, parent lifecycle | **Moves to Agent-OS** |
| **specs/graph-semantics.md** | Issue graph nodes, edges, persona assignment, dependency rules | **Moves to Agent-OS** |
| **specs/claim-leases.md** | Claim lifecycle, lease rules, reclamation protocol | **Moves to Agent-OS** |
| **specs/violation-codes.md** | Protocol violation registry (V1xx-V5xx) | **Moves to Agent-OS** |
| **archive/current-sprint.md** | Sprint 11 plan — app features (deprecated) | **Stays in RoutineMe** |
| **archive/roadmap.md** | Product roadmap phases 1-7 (deprecated) | **Stays in RoutineMe** |
| **archive/v3-platform-migration.md** | Expo/Tamagui migration from Next.js (deprecated) | **Stays in RoutineMe** |
| **archive/react-liquid-gauge.md** | Deprecated component reference | **Stays in RoutineMe** |
| **archive/project-setup-report.md** | Agent-OS setup patterns + RoutineMe context (mixed) | **Moves to Agent-OS** |
| **archive/journal/robo-2026-03-10.md** | Sprint 1 agent orchestration | **Moves to Agent-OS** |
| **archive/journal/architect-***, **backend-***, **frontend-***, **qa-***, **handoff-*** (15 files) | App implementation sessions (schema, UI, API, QA) | **Stay in RoutineMe** |

### Summary

| Disposition | Count | Content type |
|---|---|---|
| Stays in RoutineMe | 21 files | App architecture, product spec, UI guide, sprint/roadmap history, 15 implementation journals |
| Moves to Agent-OS | 8 files | Execution protocol, approval matrix, execution specs (4), robo journal, setup report |
| Needs review | 1 file | `conventions.md` (mixed app code rules + agent persona rules) |

### Post-split `.gorp/` structure

**RoutineMe repo:**

```
.gorp/
  context/
    architecture.md
    product-spec.md
    tamagui-style-guide.md
  archive/                        # App-safe history only
    current-sprint.md
    roadmap.md
    v3-platform-migration.md
    react-liquid-gauge.md
    journal/                      # 15 app implementation journals
```

**Agent-OS private repo:**

```
.gorp/
  process/
    agent-protocol.md
    approval-matrix.md
    conventions.md                # After splitting out app code rules
  specs/
    execution-state-machine.md
    graph-semantics.md
    claim-leases.md
    violation-codes.md
  archive/                        # Private agent history only
    project-setup-report.md
    journal/
      robo-2026-03-10.md
```

## 8. .claude/ Split Plan

| Path | Disposition | Rationale |
|---|---|---|
| `agents/` | **Move to Agent-OS** | Persona definitions are agent infrastructure |
| `skills/` | **Move to Agent-OS** | Orchestration skills (dispatch, sprint, handoff, verify) |
| `settings.json` | **Keep in RoutineMe** | Prettier + git hooks are app-relevant |
| `settings.local.json` | **Keep in RoutineMe, prune** | Remove `.agent-os/` references from permission whitelist |
| `projects/*/memory/` | **Keep in RoutineMe** | Session memory is per-project, stays with project |
| `hooks/` | **Keep in RoutineMe** | Empty but structurally belongs to app |
| `worktrees/` | **Keep in RoutineMe** | Empty but structurally belongs to app |

After split, `.claude/` in RoutineMe retains settings, memory, and empty scaffolding. Agent personas and skills move to Agent-OS.

## 9. Dependency and Package Implications

### Dependencies to remove from RoutineMe `package.json`:

| Dependency | Type | Reason |
|---|---|---|
| `tsx` (^4.22.0) | devDependency | Only used by `"agent-os"` script |

### Dependencies shared (keep in both):

| Dependency | Type | Reason |
|---|---|---|
| `typescript` (~5.9.2) | devDependency | Used by app `tsc --noEmit` and agent-os compilation |
| `vitest` (^4.1.2) | devDependency | Used by app tests and agent-os tests |

### Agent-OS new repo needs its own `package.json` with:

```json
{
  "name": "agent-os",
  "private": true,
  "scripts": {
    "agent-os": "tsx src/cli.ts",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsx": "^4.22.0",
    "typescript": "~5.9.2",
    "vitest": "^4.1.2"
  }
}
```

No runtime dependencies. Agent-OS uses only Node.js stdlib (`fs`, `path`).

## 10. Scripts / Justfile Implications

### package.json scripts

**Remove from RoutineMe:**
```json
"agent-os": "tsx .agent-os/src/cli.ts"
```

**Keep in RoutineMe:**
```json
"start": "expo start",
"android": "expo start --android",
"ios": "expo start --ios",
"web": "expo start --web"
```

### Justfile

No Justfile exists. No action needed.

## 11. Secrets / Config Implications

### RoutineMe secrets (stay):
- `DATABASE_URL` — Prisma migrations
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase client
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side DB access
- `OPENROUTER_API_KEY_V2` — LLM API

### Agent-OS secrets (if any):
- Agent-OS CLI is **read-only against Linear** — it parses JSON fixtures or piped Linear API output
- No API keys are embedded in `.agent-os/` code
- Linear API access is handled by the MCP server (Claude Code plugin), not by agent-os directly
- **No secrets need to move with Agent-OS**

### Config files:
- `.agent-os/config.json` references paths like `.claude/agents/*/AGENT.md` and `.gorp/process/*.md` — these paths must be updated in the Agent-OS repo to reflect its new internal structure

## 12. Git History and Privacy Concerns

### Concerns:

1. **Agent journals** (`.gorp/archive/journal/`) contain dated session logs with implementation details, decision rationale, and potentially sensitive internal process descriptions. These are already committed to git history.

2. **Linear issue references** (GUA-XX) throughout agent docs link to private Linear project data. These are identifiers only — no sensitive content is embedded.

3. **AGENT.md files** contain detailed instructions for Claude Code agent behavior, which constitute proprietary workflow IP.

4. **Pilot data** (`.agent-os/pilot/`) contains Linear issue snapshots that may include internal project planning details.

### Recommendations:

- **Do not use `git filter-branch` or `git filter-repo`** to scrub history from RoutineMe. The files will be deleted from HEAD, which is sufficient for a portfolio project.
- **For Agent-OS repo**: Initialize as a fresh repo (`git init`), copy files in, create initial commit. This avoids carrying RoutineMe app history into the private repo.
- **If RoutineMe becomes truly public**: Consider whether `.gorp/archive/journal/` entries in git history are acceptable. They are already deleted from HEAD on the current branch, so they won't appear in the working tree.

## 13. Recommended Agent-OS Repo Structure

```
agent-os/                         # Private repo root
├── src/                          # CLI source
│   ├── cli.ts
│   ├── config.ts
│   ├── linear.ts
│   ├── doctor.ts
│   ├── status.ts
│   ├── validate.ts
│   └── next.ts
├── tests/                        # CLI tests
├── docs/                         # CLI documentation
├── specs/                        # Contract specifications (.agent-os/specs/)
├── fixtures/                     # Test fixtures
├── pilot/                        # Pilot report + snapshots
├── .claude/
│   ├── agents/                   # Persona definitions
│   │   ├── architect/AGENT.md
│   │   ├── backend/AGENT.md
│   │   ├── frontend/AGENT.md
│   │   ├── qa/AGENT.md
│   │   └── robo/AGENT.md
│   └── skills/                   # Orchestration skills
│       ├── dispatch/SKILL.md
│       ├── handoff/SKILL.md
│       ├── sprint/SKILL.md
│       └── verify/SKILL.md
├── .gorp/
│   ├── process/                  # Execution protocol
│   │   ├── agent-protocol.md
│   │   ├── approval-matrix.md
│   │   └── conventions.md
│   ├── specs/                    # Execution semantics
│   │   ├── execution-state-machine.md
│   │   ├── graph-semantics.md
│   │   ├── claim-leases.md
│   │   └── violation-codes.md
│   └── archive/                  # Private agent history
│       ├── project-setup-report.md
│       └── journal/
│           └── robo-2026-03-10.md
├── bin/agent-os                  # CLI wrapper
├── config.json                   # Master config (updated paths)
├── config.schema.json            # Config schema
├── tsconfig.json                 # TypeScript config
├── package.json                  # Standalone (tsx, vitest, typescript)
├── CLAUDE.md                     # Agent-OS execution protocol
├── USAGE.md                      # Quick start
├── RUNBOOK.md                    # Operator runbook
└── .gitignore                    # Agent-OS specific
```

**Key changes from current layout:**
- `.claude/agents/` and `.claude/skills/` retain their structure (Claude Code expects this layout)
- `.gorp/` retains its structure with only agent-OS-specific content
- `.agent-os/` internals (src, tests, docs, specs, fixtures) move to top level
- Update `config.json` path references
- Create standalone `package.json`
- Write Agent-OS-specific `CLAUDE.md`

## 14. Recommended Commit Sequence

Execute in this order. Each step is a single commit on a dedicated branch.

1. **Split `CLAUDE.md`** — Reduce to app-only content. Save agent-OS sections to a temporary file or directly to the new repo.

2. **Split `.gorp/process/conventions.md`** — Extract app code standards into a RoutineMe-owned file (e.g., `.gorp/context/code-conventions.md`). Move persona/issue semantics content to Agent-OS.

3. **Remove Agent-OS files from RoutineMe**
   - Delete `.agent-os/`
   - Delete `.claude/agents/`
   - Delete `.claude/skills/`
   - Delete `.gorp/process/` (all 3 files move to Agent-OS)
   - Delete `.gorp/specs/` (all 4 files move to Agent-OS)
   - Delete `.gorp/archive/project-setup-report.md` (moves to Agent-OS)
   - Delete `.gorp/archive/journal/robo-2026-03-10.md` (moves to Agent-OS)
   - Keep `.gorp/context/`, `.gorp/archive/` (remaining files stay)

4. **Clean `package.json`** — Remove `"agent-os"` script. Remove `tsx` from devDependencies (if vitest doesn't need it). Run `npm install` to update lockfile.

5. **Clean `.claude/settings.local.json`** — Remove `.agent-os/` path references from permission whitelist.

6. **Clean `.gitignore`** — Remove `.agent-os/manifest.json` and `.agent-os/pilot/*.json` lines.

7. **Clean `vitest.config.ts`** — Remove any agent-os test path references (if present).

8. **Initialize Agent-OS repo** — `git init`, copy files into new structure (including `.gorp/` with agent-specific content), create initial commit with full history note.

## 15. Validation Checklist After Split

### RoutineMe repo:

- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes (3 test suites)
- [ ] `npx expo export --platform web` succeeds
- [ ] `CLAUDE.md` contains no agent-OS protocol sections
- [ ] No references to `.agent-os/` or `.claude/agents/` remain in app code
- [ ] `.gorp/process/` and `.gorp/specs/` removed (agent-OS content)
- [ ] `.gorp/context/` retained with app architecture docs
- [ ] `.gorp/archive/` retained with app history (agent-OS entries removed)
- [ ] `package.json` has no `"agent-os"` script
- [ ] `.gitignore` has no `.agent-os/` entries
- [ ] `README.md` has no agent-OS references (already verified)
- [ ] `.env.example` lists all required env vars (already done)
- [ ] App runs locally (`npx expo start`)

### Agent-OS repo:

- [ ] `npm run agent-os -- doctor` passes against a target repo
- [ ] `npm run agent-os -- status` returns formatted output
- [ ] `npm run agent-os -- validate` detects test violations
- [ ] `npx vitest run` passes (4 test suites)
- [ ] `config.json` paths resolve correctly in new structure
- [ ] All AGENT.md files are present and unmodified
- [ ] All SKILL.md files are present and unmodified
- [ ] `.gorp/process/` contains execution protocol docs
- [ ] `.gorp/specs/` contains execution semantics docs
- [ ] `CLAUDE.md` contains full execution protocol
- [ ] No RoutineMe app code is present
- [ ] No secrets or `.env` files are present
- [ ] Repo is private

## 16. Risks and Unknowns

| Risk | Severity | Mitigation |
|---|---|---|
| **Claude Code expects `.claude/agents/` at repo root** | HIGH | After extraction, Claude Code agents won't find persona definitions in the RoutineMe repo. This is intentional — RoutineMe development shifts to non-persona-driven workflow. If agents are still needed, Agent-OS must be configured to target RoutineMe as a working directory. |
| **`config.json` hardcodes relative paths** | MEDIUM | Update all path references in Agent-OS config after moving. Test with `doctor` command. |
| **vitest shared config** | LOW | Currently `vitest.config.ts` may include paths that cover `.agent-os/tests/`. Verify and split if needed. |
| **`.claude/settings.local.json` stale entries** | LOW | Prune `.agent-os/` references. Non-breaking if left (just stale whitelist entries). |
| **Git history contains agent-OS content** | LOW | Files deleted from HEAD. Only visible via `git log --all --diff-filter=D`. Acceptable for portfolio use. Scrubbing history is not recommended (risk of corruption, effort not justified). |
| **Agent-OS `doctor` command validates target repo structure** | MEDIUM | Currently expects `.claude/agents/` and `.gorp/process/` at target repo root. After split, doctor must be reconfigured to validate against its own internal paths or accept a target directory argument. |
| **Loss of agent workflow during transition** | MEDIUM | During the split, there will be a period where agents cannot execute against RoutineMe. Coordinate timing — do not split mid-sprint. |

## 17. Rollback Plan

If the split causes problems:

1. **Before starting**: Tag the current state: `git tag pre-agent-os-split`
2. **RoutineMe rollback**: `git revert` the removal commits (steps 1-7 in commit sequence). All agent-OS files are restored.
3. **Agent-OS rollback**: Delete the new repo. No data is lost since files were copied, not moved with `git filter-repo`.
4. **Partial rollback**: If only CLAUDE.md split causes issues, revert that single commit.

The split is fully reversible because:
- RoutineMe changes are additive deletions (revertable)
- Agent-OS repo is created fresh (deletable)
- No destructive git operations (no filter-branch, no force-push)
- Original branch preserved via tag
