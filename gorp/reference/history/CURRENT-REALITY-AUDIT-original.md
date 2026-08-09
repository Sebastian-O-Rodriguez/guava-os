# Current Reality Audit

Audit of `guava-hermes`, `guava-os`, and their governance root `~/dev/gorp`
against the target Gorp Operator Platform architecture.

Scope constraint honored: **nothing in either target repo was modified.** This
report was written to `~/dev/repos/CURRENT-REALITY-AUDIT.md` (outside both
governed repos). No implementation, no redesign, audit only.

Evidence labels: `CODE` = executable behavior read/observed; `TEST` = a test or
test run; `DOC` = documentation/spec/markdown claim; `INFERENCE` = my reasoned
conclusion. Where I could not verify a claim I write `NOT VERIFIED`.

> **AMENDED — 2026-07-14 (Reconciliation Directive).** This audit has been
> amended after the operator approved the Gorp-native, source-neutral target
> architecture and deprecated the Linear-first and markdown-sprint execution
> models. The body below is preserved as the original finding for provenance;
> the **binding corrections** are in the new section
> **"17. Reconciliation Amendments (A1–A4)"** at the end of this file. Where the
> original body frames a "Linear vs Markdown" choice, read it through amendment
> **A1**: *both are external or legacy representations; neither is the
> authoritative execution model.* Amendment **A2** also **corrects a
> misattribution in the original §6/§12/§16**: the `routineme` registry change I
> reported as caused by `validate-gorp.sh` was NOT reproducible — see A2 for the
> verified side-effect finding.

A structural fact governs the whole audit: there are **three** repositories, not
two. The governance authority is a *third* repo, `~/dev/gorp`, which both
`guava-hermes` and `guava-os` bind to. The directive named two repos; the real
system is `gorp` (authority) + two consumers.

---

## 1. Executive Finding

The system today is a **governance-and-classification toolkit, not an execution
platform.** `~/dev/gorp` is a real, tested context-resolution pipeline
(`resolve-context.sh` → `generate-agents-md.sh` → `deploy-agents-md.sh`) that
deterministically turns per-project bindings + a persona into a governed,
schema-validated `AGENTS.md`; this part genuinely works and is covered by
passing fixture tests `CODE` `TEST`. `guava-os` is a real, well-tested
**read-only** TypeScript CLI that classifies pre-fetched Linear issues into an
execution graph and emits launch *directives* — it never touches Linear, git, or
the filesystem `CODE` `TEST`. The single "execution" path that exists — the local
adapter `runtime/adapters/local/run.sh` — is explicitly a **simulation**: it
writes a journal, calls no agent runtime, and validates scope by diffing git
*after* the fact `CODE`. The largest architectural gap is that **there is no
worker, no isolation, no promotion, and no orchestrator** — the three most
load-bearing components of the target outcome exist only as design docs under
`gorp/improvements/` `DOC`. Governance is real at the context-generation layer
but **advisory, not enforced, at the execution layer**: any agent or human can
edit `guava-os` directly with ordinary tools and never pass through Gorp
`INFERENCE`. The two repos also encode **two contradictory execution models** —
Gorp/guava-hermes use a markdown-table sprint + journal-only adapter, while
guava-os + several Gorp specs make **Linear the sole source of truth** `CODE`
`DOC`. Despite this, the codebase is a **viable foundation**: the context loader,
scope policy, adapter *contract*, resolved-context/graph *schemas*, and the
read-only classifier are the correct primitives, and the production-adapter
design (worktree isolation + scoped promotion) is sound. What is missing is
almost entirely the *execution half*, which has been deliberately deferred
(`HERMES-BOOTSTRAP.md` step 2 and step 6 are not done) `DOC`. In one line: **the
planning/governance skeleton is real and tested; the muscle that runs, isolates,
validates-by-execution, reviews, and promotes work does not exist yet.**

---

## 2. Repository Responsibilities

### `~/dev/gorp` (the authority — not named in the directive but central)
- **Actual role:** global governance layer. Holds doctrine, personas, scope
  policy, specs, templates, the registry (`registry/projects.yml`), the context
  loader/generator/deployer, and the only runtime adapter (`local`, simulated).
  `CODE`
- **Coupling risk:** the `graph-semantics.md` and `execution-state-machine.md`
  specs are written entirely around **Linear** `parentId`/labels/statuses `DOC`.
  A "global, runtime-neutral" authority has hard-coded a specific external SaaS
  (Linear) into its execution semantics. That is project-specific doctrine living
  in the global layer — a leakage the directive explicitly warns against.

### `guava-hermes`
- **Intended role (per binding + overlay):** operator cockpit; "read-and-coordinate
  over other Gorp consumers"; "does not own product logic" `DOC`
  (`.gorp/overlays/conventions.overlay.md`).
- **Actual role:** a **near-empty consumer**. Contents: `CLAUDE.md`, `README.md`,
  a generated `AGENTS.md` symlink, one overlay set, a one-task sprint
  (`GHERM-001`, a no-op check), and one simulated journal entry `CODE`. There is
  **no cockpit code, no dashboard, no dispatch, no adapter invocation logic** in
  the repo.
- **Misplaced responsibilities:** none yet — it does too little, not too much.
- **Missing responsibilities:** everything its role claims (dispatch, health
  aggregation, context deployment orchestration). Per `HERMES-BOOTSTRAP.md` these
  are future steps 4–7, not built `DOC`.
- **Coupling risk:** low today (it barely exists). The risk is *aspirational* —
  the roadmap wants Hermes to become the multi-project orchestrator, which would
  make it the de-facto orchestrator implementation (a role the directive says it
  must not silently absorb).

### `guava-os`
- **Intended role:** registered pilot consumer; source of project context; target
  of governed work.
- **Actual role:** it is **two things fused in one repo**:
  1. A registered Gorp consumer (`.gorp/gorp.yml`, overlays, a *copy* of specs
     under `.gorp/specs/` and process docs under `.gorp/process/`) `CODE`.
  2. A standalone product-tooling project: `.guava-os/` contains a full
     TypeScript CLI (`src/*.ts`), tests, fixtures, its own specs, docs, config
     schema, and a `bin/guava-os` `CODE`.
- **Misplaced responsibilities (material):**
  - It **carries copies of Gorp specs** (`.gorp/specs/execution-state-machine.md`,
    `graph-semantics.md`, `violation-codes.md`, `claim-leases.md`) rather than
    referencing canonical Gorp `CODE`. The adapter CONTRACT explicitly says
    project copies must never be authoritative (`CONTRACT.md` §4) `DOC` — yet the
    copies exist and the CLI's behavior is defined by the in-repo specs.
  - Its `CLAUDE.md` declares **Linear as the sole execution source of truth** and
    embeds an elaborate execution protocol, state machine, and authority
    hierarchy `CODE`. That is *cross-project doctrine* (reusable orchestration
    rules) living inside a single project — the directive's exact anti-pattern.
- **Missing responsibilities:** it owns none of the actual write/execution path
  to itself — there is no code that mutates guava-os under governance.
- **Coupling risk (high):** guava-os's CLI hard-codes the Linear issue model
  (`LinearIssue`, `parentId`, `GUA-` prefix, Linear statuses). Its "governance"
  (`.gorp/process/*`, `.gorp/specs/*`) is a fork/copy that can silently drift from
  canonical Gorp `INFERENCE`.

---

## 3. Current End-to-End Flow

This is the **actual** control path, reconstructed from code. It stops well short
of "code change," because no code-change path exists.

1. **Register a project** — hand-edit `~/dev/gorp/registry/projects.yml` (a static
   YAML list; guava-os, guava-hermes, routineme are listed) `CODE`. No CLI does
   this; it is a manual file edit.
2. **Bind a project** — hand-create `<project>/.gorp/gorp.yml` pinning
   `gorp.path`, `doctrine_version`, anchor, overlays, adapter `CODE`.
3. **Resolve context** — run
   `~/dev/gorp/runtime/loader/resolve-context.sh --project <path> --persona <id>`.
   It runs `tools/validate-gorp.sh` (canonical + `--consumer`), reads the binding,
   manifest, persona file, scope policy, and overlays, and emits a
   schema-validated `resolved-context.json` to stdout; fails closed on any missing
   input, version mismatch, or unresolved `{{placeholder}}` `CODE` `TEST`.
4. **Generate AGENTS.md** —
   `runtime/generators/generate-agents-md.sh <ctx.json>` renders a deterministic
   `AGENTS.md` (excludes `resolved_at` so output is byte-stable) `CODE` `TEST`.
5. **Deploy AGENTS.md** —
   `runtime/generators/deploy-agents-md.sh --project <path> --persona <id>` writes
   `<project>/.gorp/generated/AGENTS.md` and symlinks `<project>/AGENTS.md → it`
   `CODE`. (This is how guava-hermes's `AGENTS.md` symlink was produced.)
6. **"Execute" a task** —
   `runtime/adapters/local/run.sh --project … --persona … --task-id … --instruction … --scope …`.
   It re-resolves context, re-validates, records pre-run `git status`, **writes a
   journal file only** (`.gorp/journal/<persona>-<date>.md` with `Files: (none —
   journal-only simulated run)`), diffs post-run git status, checks changed files
   against scope via a Ruby glob matcher, and prints a result JSON `CODE`.
   **No agent runtime is launched. No task work is performed.** (Header comment,
   line 3–7: "Proves: binding → resolved context → adapter → journal → scope
   validation … Writes a journal only (no AI runtime …)") `CODE`.
7. **Scope validation** — post-hoc: `comm -13` of before/after git status, matched
   against `always_deny` + `always_allow` + `task_allowed` + declared `--scope`;
   exit 3 on violation `CODE`.
8. **How tasks are presented to a runtime** — `NOT VERIFIED / does not exist`.
   No runtime is invoked. The `playbooks/dispatch.sh` script *would* call
   `claude -p --agent <persona>` in dependency waves reading a markdown sprint
   table, but **nothing in the loader/adapter pipeline calls it, and it targets a
   different sprint model than the specs** `CODE` `INFERENCE`. It is orphaned.
9. **Where code is written / validated / reviewed / committed / merged /
   promoted** — `NONE OF THESE EXIST AS CODE`. No worktree, no `git commit/push/
   merge/checkout`, no promotion, no review step exists anywhere in the three
   repos (grep for `worktree|git commit|git merge|tmux|gorp launch|claude -p`
   returns hits only in the orphaned `dispatch.sh`) `CODE`.
10. **The guava-os branch of the flow (separate, also read-only):**
    a. Operator fetches Linear issues out-of-band (by hand / via an MCP tool the
       CLI does *not* contain) and pipes JSON into the CLI `CODE` `DOC`.
    b. `npx tsx .guava-os/src/cli.ts status|validate|next < issues.json` builds the
       graph, reports violations, and emits directives `CODE`.
    c. A directive is a **string of advice** (`persona`, `issue_id`, `branch`
       name, `context[]`) — `next.ts` `CODE`. It launches nothing.
    d. `gorp launch …` (the thing that would consume a directive and start a tmux
       session) is **spec only** (`gorp-launch-contract.md`, "Spec only — no
       implementation in Phase 2A") and does not exist as code `DOC`.
11. **Audit records that remain:** the simulated journal file and the adapter
    result JSON (ephemeral, printed to stdout unless redirected) `CODE`.

**Conclusion:** the real flow ends at *"a governed AGENTS.md is deployed"* and
*"a journal is simulated"* / *"a directive string is printed."* A human then
does all actual work by hand, outside governance `INFERENCE`.

---

## 4. Architecture Coverage Matrix

| Component | Status | Repository | Evidence | Gap | Severity |
|---|---|---|---|---|---|
| Global governance | implemented | gorp | `CODE` doctrine/, personas/, scope.yml, manifest, validate-gorp.sh (tests pass) | Linear-specific semantics leaked into global specs | medium |
| Project context | partial | guava-os, guava-hermes | `CODE` bindings + overlays + `.gorp/project.yml` support in loader | guava-os copies specs instead of referencing; mixed with product tooling | high |
| Sprint context | partial | guava-hermes / gorp templates | `CODE` `.gorp/plans/current-sprint.md` (1 no-op task); `templates/gorp/plans/` | Markdown table only; no schema; contradicts Linear model | high |
| Task context | implicit | gorp adapter args | `CODE` `--task-id/--instruction/--scope` passed on CLI; overlay `allowed`/`deny` | No task schema; no forbidden-files/required-tests/exit-conditions object | high |
| Gorp governance layer | partial | gorp | `CODE` scope.yml + CONTRACT.md + loader enforcement of bindings/versions | Enforcement is generation-time + post-hoc only; not runtime-enforced | high |
| Planner | absent | — | no planner code found `CODE` | Decomposition is manual (human writes sprint table / Linear issues) | high |
| Execution graph | partial | guava-os | `CODE` `linear.ts buildGraph()` builds a real typed graph from Linear data | Read-only, in-memory, ephemeral; no persisted node identity/state; deps deferred (`dependencyRelationsLoaded:false`) | blocker |
| Orchestrator | absent | — | `dispatch.sh` orphaned + Linear-incompatible `CODE`; `gorp launch` spec-only `DOC` | No component sequences/dispatches/monitors work | blocker |
| Worker contract | partial (design) | gorp | `CONTRACT.md` defines adapter obligations `DOC`; local adapter is a stub `CODE` | No worker actually runs a task; contract unimplemented | blocker |
| Blocker router | absent | — | `dispatch.sh` parses journal `Status: blocked` `CODE` (orphaned) | No escalation routing in the live pipeline | high |
| Execution sandbox | absent | — | Worktree design in `PRODUCTION-ADAPTER.md` `DOC`; adapter runs in the real tree `CODE` | No isolation of any kind exists | blocker |
| Validation | partial | guava-os + gorp | `CODE` `validate.ts` (graph violations), scope glob check in adapter, `quality-gate.sh` | Validation ≠ execution; only proves file generation / structural graph checks | high |
| Review | absent | — | no review step in code `CODE`; approval-matrix is prose `DOC` | Intent/quality/acceptance review is unimplemented | high |
| Promotion | absent | — | no promote/merge/apply code anywhere `CODE` | No mechanism to move approved work into the project | blocker |
| Operator interface | partial | gorp CLIs + guava-os CLI | `CODE` shell scripts + `guava-os` CLI with 4 read-only commands | Fragmented; no single cockpit; guava-hermes cockpit not built | medium |
| Controlled learning | implicit | gorp | `CODE` `memory/` dirs (all `.gitkeep`), `improvements/` review folders | No mechanism to capture/approve/promote lessons; dirs empty | medium |
| Audit trail | partial | gorp / consumers | `CODE` simulated journal + adapter result JSON; scope.yml §10 mandates audit | Ephemeral, no run records (`.gorp/runs/` design only), not reconstructable | high |

---

## 5. Context Layer Audit

| Layer | Current source | Schema | Generation | Consumer | Enforcement | Leakage / overlap |
|---|---|---|---|---|---|---|
| **Global** | `gorp/doctrine/*`, `personas/*`, `runtime/policies/scope.yml`, `specs/*`, `gorp.manifest.yml` `CODE` | Persona schema (`PERSONA-SCHEMA.md`), scope policy YAML, resolved-context JSON schema `CODE` | authored by hand; loaded by `resolve-context.sh` | loader → resolved-context → AGENTS.md | referenced (not copied) at resolve time; version-pinned via `doctrine_version` match (fail-closed) `CODE` | **Leakage:** Linear semantics in `graph-semantics.md`/`execution-state-machine.md` are project-specific, not global `DOC` |
| **Project** | `<repo>/.gorp/gorp.yml` (binding) + overlays + optional `.gorp/project.yml`; guava-os also `.gorp/process/*` + `.gorp/specs/*` `CODE` | binding validated by `validate-gorp.sh --consumer`; overlays free-form md/yml | hand-authored | loader inlines conventions overlay; references the rest | binding presence/version enforced; **spec copies NOT enforced against canonical** `INFERENCE` | **Overlap:** guava-os duplicates global specs locally; `CLAUDE.md` holds cross-project orchestration doctrine `CODE` |
| **Sprint** | `guava-hermes/.gorp/plans/current-sprint.md` (markdown table); Linear (for guava-os, external) `CODE` | **none** for the markdown form; no sprint JSON schema exists | hand-authored table / Linear issues | `dispatch.sh` (orphaned) parses the table; guava-os reads Linear JSON | not enforced; `dispatch.sh` accepts missing `Status:` line ("proceeding anyway") `CODE` | **Two rival sprint models** (markdown table vs Linear) coexist |
| **Task** | adapter CLI args (`--task-id/--instruction/--scope`) + `scope.overlay.yml` `allowed`/`deny` `CODE` | resolved-context `effective_scope` object (allow/deny/task_allowed) has a schema | assembled by loader/adapter at call time | local adapter scope validator | scope enforced **post-hoc** on git diff; **fail-closed on unenforceable** | No task object with forbidden-files / required-tests / exit-conditions / escalation-conditions as the directive defines a task `DOC` |

Key findings:
- **Provenance is genuinely retained** at the resolved-context level: the loader
  emits a `provenance` map (`project.id → binding`, `effective_scope.always_deny →
  global_doctrine`, etc.) and an `overlays_applied` list `CODE`. This is a real
  strength.
- **Authoritative vs advisory:** the *scope* portion of context is authoritative
  (validated, fail-closed). The *behavioral* portion (persona body, conventions,
  governance bullets in AGENTS.md) is **advisory** — it is instructions to an
  agent, with no runtime that enforces them `INFERENCE`.
- **Workers receive more authority than required?** There is no worker, so N/A
  today; but the design gives the agent the full resolved context and relies on
  compliance, not confinement `INFERENCE`.

---

## 6. Governance and Bypass Audit

**Enforced controls (real, fail-closed):**
- Binding presence + `doctrine_version` == manifest version (loader `die` on
  mismatch) `CODE`.
- Persona/anchor/scope-policy presence (loader fails closed) `CODE`.
- Unresolved `{{placeholder}}` → hard fail `CODE`.
- Emitted resolved-context validated against JSON schema before use `CODE`.
- Post-run scope diff in the local adapter: out-of-scope or always-deny change →
  exit 3 `CODE` `TEST` (fixture `out-of-scope` proves exit 3).
- `enforcement_unavailable: fail_closed` is declared and honored by the adapter
  (missing git repo, empty context, missing journal all `die`) `CODE`.

**Advisory controls (documented, not enforced):**
- Everything in `AGENTS.md` "Governance (must follow)" section — it is text an
  agent is asked to obey `CODE`.
- `approval-matrix.md` ("CTO Required", "Robo Decides") — prose, no code gate
  `DOC`.
- guava-os `CLAUDE.md` "MANDATORY" startup invariant, issue-eligibility rules,
  authority hierarchy — all instructions, zero enforcement code `CODE`.
- `scope.yml enforcement.pre_write_check.required: false` — pre-write prevention
  is explicitly optional; **prevention is not implemented** `CODE`.

**Bypass paths (every way to change `guava-os` without passing through Gorp):**
1. **Direct edit.** Open any file in `guava-os` in an editor / with normal tools
   and commit. Nothing intercepts it `INFERENCE` (no git hooks: no `.git/hooks`
   under version control, no pre-commit config found) `CODE`.
2. **Ordinary git.** `git commit`/`push` directly to `main`. No branch protection
   or server-side gate in-repo `CODE`.
3. **Run the CLI's quality gates by hand** and skip Gorp entirely — guava-os is a
   normal npm project (`npm test`, `tsc`) `CODE`.
4. **The adapter itself does not run the work** — so "passing through Gorp" today
   changes *nothing* on disk except a journal. The governed path and the
   real-work path are disjoint `INFERENCE`.
5. **`dispatch.sh --agent`** would launch `claude` with only advisory scope env
   vars (`GORP_SCOPE=$task_id`) and no confinement `CODE`.

**Fail-open behavior:** `dispatch.sh check_sprint_approval` — missing `Status:`
line → "proceeding anyway"; unknown status → "proceeding" `CODE`. Also every
advisory control is fail-open by nature.

**Fail-closed behavior:** the loader and local adapter (context resolution + scope
diff) are correctly fail-closed `CODE`.

**Contamination risk:** because the adapter runs **in the real working tree** and
writes directly to `<project>/.gorp/journal/`, a *real* (non-simulated) adapter
built on this exact body would let a misbehaving task write anywhere before the
post-hoc diff catches it — the bad write is already on disk. The scope policy
itself admits this: post-run detection is the "mandatory floor," reverting is
"an adapter responsibility" not yet built `CODE` `DOC`.

---

## 7. Execution Runtime Audit

- **Agent runtime:** none is wired. The local adapter calls **no runtime** `CODE`.
  `dispatch.sh` references `claude -p --agent` (Claude Code) but is orphaned and
  Linear-incompatible `CODE`. Hermes is bound as a *consumer* and its persona
  overlay calls it a read-only cockpit `DOC`; there is no Hermes-invocation code.
- **Invocation:** `run.sh` args (`--project/--persona/--task-id/--instruction/
  --scope`) — a clean, runtime-neutral interface `CODE`. But it drives a stub.
- **Sandboxing:** **none.** Runs in the primary working tree. Worktree isolation
  is design-only (`PRODUCTION-ADAPTER.md` §2, §10) `DOC`.
- **Session control / cancellation / retries:** none in code. `gorp-launch-contract.md`
  describes tmux sessions, timeouts, duplicate-session refusal — **spec only** `DOC`.
  `dispatch.sh` has wave retries/replan logic but is orphaned `CODE`.
- **Logs:** adapter result JSON to stdout; journal file written. No durable
  per-run log directory (`.gorp/runs/` is a design proposal) `CODE` `DOC`.
- **Cleanup:** adapter uses `mktemp` + `trap rm` for the context temp file; no
  workspace to clean because none is created `CODE`.
- **Runtime replaceability:** **good in principle** — `CONTRACT.md` is genuinely
  runtime-neutral (no provider/model/tool names), and the adapter interface is
  abstract `DOC` `CODE`. Replaceability is real at the contract level, untested at
  the implementation level (only one stub adapter exists).
- **Exit-status reliability:** the adapter's exit codes are correct and tested
  (0 ok / 1 fail-closed / 2 usage / 3 scope-violation) `CODE` `TEST`.

---

## 8. Planning and Execution Graph Audit

- **Does an execution graph exist?** **Partially — one real, one absent.**
  - `guava-os/.guava-os/src/linear.ts buildGraph()` produces a genuine typed graph:
    parents, per-persona executable queues, notPromoted, blocked, invalid, a
    summary, and a `capabilities` flag `CODE`. Node types, edge types, and
    invariants are specified in `gorp/specs/graph-semantics.md` `DOC`. This is the
    closest thing to a real execution graph in the system.
  - **But it is read-only, in-memory, and ephemeral.** It is rebuilt from Linear
    JSON on every CLI call; no node has persisted identity or state on disk; there
    is no graph store `CODE`.
- **Explicit or implied?** Explicit *as a classification of Linear data*; there is
  **no independent graph the operator platform owns** — Linear is the store, and
  `dependencyRelationsLoaded` is hard-wired `false`, so the `blocks`/dependency
  edges (the thing that makes a graph a DAG rather than a list) are **not loaded**
  `CODE`. Per the state-machine spec, sub-issues that should be `BLOCKED` are
  classified `EXECUTABLE` today `DOC` `CODE`.
- **Who owns decomposition?** A human — via Linear issues (guava-os) or a
  hand-written markdown table (guava-hermes). No planner code `CODE`.
- **Can workers redefine / create more work?** No workers exist. The classifier
  cannot; `dispatch.sh` replan *would* ask Robo to rewrite the sprint table
  (orphaned) `CODE`.
- **Deterministic resume?** No. State lives in Linear (mutable, external) or in a
  markdown table mutated in place by `sed` `CODE`. No checkpoint/run-id.
- **Retry a failed task without repeating the sprint?** No live mechanism.
- **Can the operator reconstruct why a task ran?** Not reliably — only a
  simulated journal + ephemeral result JSON exist `CODE`.
- **Verdict against the directive's bar:** this is **not** an execution graph in
  the required sense — dependencies are not represented/enforced (Phase 2
  deferred), node identity/state is not persisted, and transitions are not
  enforced by code `CODE` `DOC`.

---

## 9. Validation, Review, and Promotion Audit

- **Validation (exists, real, but structural):**
  - `guava-os validate.ts`: graph/protocol violations (V302/303/304/400/401/402/500)
    — pure function, deterministic, well-tested `CODE` `TEST`.
  - local adapter: scope glob check on changed files `CODE`.
  - `playbooks/quality-gate.sh`: tsc/eslint/prettier/build/vitest wrappers `CODE`.
  - **What it does NOT do:** validate the *result of executing a task*, because no
    task executes. It validates file generation and static structure only `CODE`
    `INFERENCE`.
- **Review (absent):** no code performs intent-alignment, code-quality,
  architectural-fit, or acceptance-criteria review. The QA persona and
  `IN_REVIEW → DONE (QA)` transition are **spec/prose** in `execution-state-machine.md`
  `DOC`; no reviewer exists.
- **Promotion (absent):** no code applies a patch, merges a branch, cherry-picks,
  or updates an authoritative tree. Grep for `git merge|git checkout|git
  cherry-pick|worktree|promote` → nothing outside orphaned `dispatch.sh` `CODE`.
  The worktree-then-promote model is design-only `DOC`.
- **Conflation / unsafe authority:**
  - Because promotion doesn't exist, a *human* is the only promoter — which is
    safe but entirely manual and outside governance `INFERENCE`.
  - In the **design/spec** layer there is a latent conflation risk: `dispatch.sh`
    lets a builder's journal self-declare `Status: done` and the dispatcher trusts
    it (treats unknown status as done) — i.e., a worker can effectively validate
    its own completion `CODE`. The state-machine spec correctly forbids builders
    setting `DONE` (V202), but nothing enforces the spec.
  - Can a worker **commit directly to the target branch / bypass human approval?**
    Today: no worker; a human can (no branch protection). In the `dispatch.sh`
    design: yes — it instructs agents to make conventional commits with no gate
    `CODE`.

---

## 10. Controlled Learning Audit

- **Existing mechanisms:**
  - `gorp/memory/{doctrine,failures,tooling,workflows}/` — all contain only
    `.gitkeep`; **empty** `CODE`.
  - `gorp/improvements/{proposals,under-review,accepted,rejected,roadmap,runtime}/`
    — a real human review funnel exists as folders + an `improvements/README.md`;
    proposals like `PRODUCTION-ADAPTER.md`, `gorp-launch-contract.md` sit here
    `CODE` `DOC`.
  - `registry/mcps.yml` and approved MCP/tool categories exist but are **empty/`[]`**
    (deliberately, per `HERMES-BOOTSTRAP.md`) `CODE`.
  - guava-os `.claude/skills/*` (dispatch/handoff/sprint/verify) and a stale
    `.claude/projects/.../memory/MEMORY.md` referencing an old
    `-Users-sebastianrodriguez-Projects-ROUTINEME` path `CODE`.
- **Proposed vs auto-trusted:** learning is **proposed** — the `improvements/`
  funnel is explicitly human-reviewed (folders for under-review/accepted/rejected)
  `DOC`. Nothing is auto-promoted. Good.
- **Who approves:** a human (CTO per approval-matrix) `DOC`.
- **Provenance retained:** at the context layer, yes (provenance map). For
  learning artifacts, only by folder location + git history `INFERENCE`.
- **Project→global leakage:** **present as a smell** — guava-os holds copies of
  global specs and cross-project doctrine in `CLAUDE.md`; there is no promotion
  review guarding what becomes global vs stays project-local `CODE`.
- **Stale/contradictory detection:** none. The stale `.claude/.../MEMORY.md` path
  and the Linear-vs-markdown model contradiction are both undetected `CODE`.

---

## 11. Test Reality

- **gorp (shell fixture suites), all passing when run:** `TEST`
  - `tools/test-loader.sh`: 8/8 (3 positive resolve + 5 negative fail-closed).
  - `tools/test-generator.sh`: 4/4 (determinism + committed-fixture match for
    guava-hermes and guava-os AGENTS.md).
  - `tools/test-local-adapter.sh`: 4/4 (journal-only ok; missing-persona/
    missing-project fail; out-of-scope → rc 3).
  - `tools/validate-gorp.sh`: all checks pass.
- **guava-os (vitest):** `91 tests, 4 files, all pass` `TEST` (next/runtime/
  validate unit tests + a smoke test that shells the CLI with fixtures).
- **Fixture coverage:** good for the loader (positive/negative), generator
  (golden files), adapter (4 cases), and the classifier (clean/warnings/errors
  fixtures) `TEST`.
- **Integration coverage:** partial — the generator test proves
  loader→generator wiring; guava-os smoke test proves CLI end-to-end over stdin.
- **End-to-end coverage:** **absent for the operator loop.** No test exercises
  register→resolve→deploy→**execute real work**→validate→review→promote, because
  the back half doesn't exist `INFERENCE`.
- **Untested critical paths:** real task execution, isolation, promotion, review,
  orchestration, blocker routing, dependency-aware graph — none can be tested
  because none are implemented `CODE`.
- **Do tests prove behavior or only generation?** They prove: (a) deterministic
  **file generation**, (b) **fail-closed** context resolution, (c) **structural
  classification** of Linear data, and (d) **post-hoc scope detection** on a
  simulated write. They do **not** prove that governed *execution* is safe,
  isolated, or correct — that behavior is unbuilt `INFERENCE`.

---

## 12. Architectural Contradictions

1. **Two execution models.** Gorp/guava-hermes: markdown-table sprint + journal-
   only adapter + `dispatch.sh` calling `claude`. guava-os + Gorp specs: Linear is
   the sole source of truth, graph derived from `parentId`/labels.
   - *Evidence:* `guava-os/CLAUDE.md` ("Linear — sole execution source of truth");
     `graph-semantics.md`/`execution-state-machine.md` (Linear-centric);
     `guava-hermes/.gorp/plans/current-sprint.md` + `playbooks/dispatch.sh`
     (markdown table + claude) `CODE` `DOC`.
   - *Consequence:* no single coherent flow; the two halves cannot be composed.
   - *Disposition:* **refactor** — pick one planning source (Linear as data source
     behind a neutral graph, OR Gorp-native sprint schema) and delete the other.
2. **Governance layer knows about Linear.** A "runtime-neutral" global authority
   hard-codes a specific SaaS into its execution semantics.
   - *Evidence:* `specs/graph-semantics.md`, `specs/execution-state-machine.md` `DOC`.
   - *Consequence:* violates the neutrality the `CONTRACT.md` claims elsewhere;
     couples all projects to Linear.
   - *Disposition:* **refactor** — move Linear specifics into an adapter/consumer
     layer; keep global specs source-agnostic.
3. **"Enforcement" is post-hoc detection on the real tree.**
   - *Evidence:* `run.sh` lines 63–142; `scope.yml enforcement.pre_write_check.
     required:false` `CODE`.
   - *Consequence:* out-of-scope writes hit disk before detection; no prevention.
   - *Disposition:* **replace** the adapter body with the worktree-then-promote
     design already written in `PRODUCTION-ADAPTER.md` (keep the interface).
4. **guava-os carries copies of canonical specs.**
   - *Evidence:* `guava-os/.gorp/specs/*` duplicate `gorp/specs/*`; `CONTRACT.md`
     §4 forbids treating project copies as authoritative `CODE` `DOC`.
   - *Consequence:* silent drift; two sources of truth.
   - *Disposition:* **delete** the copies; reference canonical Gorp per binding.
5. **The governed path changes nothing; the real path is ungoverned.**
   - *Evidence:* adapter writes only a journal; no code path performs governed
     mutation of a consumer `CODE`.
   - *Consequence:* governance is decorative at the execution layer.
   - *Disposition:* **retain** the contract/loader; **build** the missing execution
     half so the governed path is the only path.
6. **Orphaned `dispatch.sh`.**
   - *Evidence:* not called by loader/adapter; uses the abandoned markdown model;
     calls `claude` directly `CODE`.
   - *Disposition:* **delete or quarantine** (see §13) — it encodes a superseded
     model and a bypass.
7. **Directive says "no Linear/MCP/tmux/messaging/dashboards," but specs plan all
   of them.**
   - *Evidence:* `gorp-launch-contract.md` (tmux), `registry/mcps.yml`, Linear in
     specs, `HERMES-BOOTSTRAP.md` dashboard steps `DOC`.
   - *Consequence:* target scope (one operator/machine/project/sprint) conflicts
     with planned breadth.
   - *Disposition:* **defer** (not delete the docs) — keep as future proposals,
     out of the launch-critical path.

---

## 13. Ruthless Cuts

Cuts are recommended **only where evidence supports non-contribution to the next
launch-critical milestone** (a single governed execute→validate→promote loop on
one project).

- **`playbooks/dispatch.sh` (641 lines).** Orphaned, uses the superseded markdown
  sprint model, hard-codes `claude`, and encodes an ungoverned bypass. `CODE`
  → **Cut/quarantine.** It is the largest single dead abstraction.
- **guava-os `.gorp/specs/*` and possibly `.gorp/process/*` copies.** Duplicate
  canonical Gorp; drift risk. `CODE` → **Cut** (reference canonical instead).
- **Linear-specific execution specs in the *global* layer** (`graph-semantics.md`,
  `execution-state-machine.md`, `claim-leases.md`) as *global doctrine*. `DOC`
  → **Do not delete; relocate** out of the neutral global layer into a consumer
  adapter concern. (Refactor, not delete — they contain real, correct design.)
- **`gorp-launch-contract.md` tmux/session machinery, `registry/mcps.yml`,
  dashboard roadmap steps 4–7.** Premature vs the one-project target. `DOC`
  → **Keep as deferred proposals; remove from the launch-critical path.**
- **Stale `guava-os/.claude/projects/-Users-sebastianrodriguez-.../memory/MEMORY.md`.**
  Dead path from a prior machine/rename. `CODE` → **Cut.**
- **`text_to_speech`-style breadth aside — do NOT cut:** the loader, generator,
  deployer, scope policy, CONTRACT.md, resolved-context + graph schemas, the
  read-only classifier, and the `improvements/` funnel are all load-bearing and
  correct. No evidence supports cutting them.

---

## 14. Current Capability Boundary

**Can reliably do today (verified by code + tests):**
- Deterministically resolve a registered project + persona into a
  schema-validated `resolved-context.json`, failing closed on any missing/invalid
  input, version mismatch, or unresolved placeholder `CODE` `TEST`.
- Deterministically generate and deploy a governed `AGENTS.md` (symlinked into the
  consumer) that never drifts from its generated source `CODE` `TEST`.
- Validate consumer bindings/overlays against canonical Gorp (`validate-gorp.sh`)
  `CODE` `TEST`.
- Classify a supplied set of Linear issues into an execution graph, detect
  protocol violations, and emit per-persona launch **directives** — entirely
  read-only `CODE` `TEST`.
- Run a **simulated** governed task that writes a journal and detects out-of-scope
  changes post-hoc, with correct exit codes `CODE` `TEST`.

**Cannot reliably do today:**
- Execute any real task through an agent runtime under governance `CODE`.
- Isolate execution (no worktree/container/sandbox) `CODE`.
- Prevent (as opposed to detect-after) out-of-scope writes `CODE`.
- Review work for intent/quality/acceptance `CODE`.
- Promote/merge approved changes into a project with provenance `CODE`.
- Orchestrate: sequence, dispatch, monitor, retry, or route blockers automatically
  `CODE`.
- Represent/enforce task dependencies (dependency data deliberately not loaded)
  `CODE`.
- Reconstruct a task's execution from a durable audit trail (records are
  simulated/ephemeral) `CODE`.
- Fetch Linear itself (the CLI never calls Linear; data arrives out-of-band)
  `CODE`.

---

## 15. Top Five Gaps

Ranked by distance from the target outcome (decompose → dispatch to isolated
workers → validate → review → promote → audit, minimal human intervention).

1. **No worker execution + no isolation (the adapter is a stub).**
   - *Evidence:* `run.sh` writes a journal only, calls no runtime; no worktree/
     sandbox anywhere `CODE`.
   - *Impact:* nothing can actually run; the entire right half of the loop is
     absent. This is the single biggest blocker.
   - *Dependency:* the `CONTRACT.md` interface + `PRODUCTION-ADAPTER.md` worktree
     design already exist to build against.
   - *Owner:* **gorp** (`runtime/adapters/`).

2. **No promotion (approved work cannot enter the project under governance).**
   - *Evidence:* zero merge/apply/cherry-pick/promote code `CODE`.
   - *Impact:* even if a worker ran, its output couldn't be safely landed; humans
     land everything by hand, outside governance.
   - *Dependency:* requires isolation first (promote = apply in-scope diff from the
     isolated worktree).
   - *Owner:* **gorp** adapter, invoked per-consumer.

3. **No orchestrator (a human manually sequences every command).**
   - *Evidence:* the only "orchestration" is orphaned `dispatch.sh` (wrong model);
     `gorp launch` is spec-only `CODE` `DOC`.
   - *Impact:* "minimal human intervention" is unreachable; the operator runs each
     step by hand.
   - *Dependency:* needs (1) worker + (4) a persisted graph to sequence over.
   - *Owner:* **guava-hermes** (its stated cockpit role) — must build it *as an
     adapter over Gorp*, not as the governance authority.

4. **No persisted, dependency-aware execution graph with node identity/state.**
   - *Evidence:* `buildGraph()` is in-memory/ephemeral; `dependencyRelationsLoaded:
     false`; state lives in Linear or a `sed`-mutated markdown table `CODE`.
   - *Impact:* no deterministic resume, no per-task retry, no reconstruction of
     "why did this run."
   - *Dependency:* pick one planning source (contradiction #1) first.
   - *Owner:* **gorp** (graph store/schema) consuming a source adapter.

5. **Governance is advisory at execution time + bypassable.**
   - *Evidence:* `pre_write_check.required:false`; direct edits/commits ungoverned;
     no git hooks/branch protection; governed path mutates nothing `CODE`.
   - *Impact:* even with a worker, compliance ≠ enforcement; the target's "validate
     every result against governance" is not guaranteed.
   - *Dependency:* isolation (1) converts advice into structural enforcement
     (out-of-scope writes die with the worktree).
   - *Owner:* **gorp** (policy) + consumers (make the governed path the only path).

---

## 16. Evidence Index

### `~/dev/gorp` (governance authority)
- `gorp.manifest.yml`, `README.md`, `migration-notes.md`
- `doctrine/{agent-protocol,approval-matrix,conventions,gotchas}.md`
- `personas/{architect,backend,frontend,qa,robo}.md`, `PERSONA-SCHEMA.md`
- `runtime/loader/resolve-context.sh` (+ `RESOLUTION-SPEC.md`)
- `runtime/generators/generate-agents-md.sh`, `deploy-agents-md.sh`
- `runtime/adapters/local/run.sh` (+ `README.md`), `runtime/adapters/CONTRACT.md`
- `runtime/policies/scope.yml`
- `specs/{graph-semantics,execution-state-machine,execution-report-contract,resolved-context-contract,claim-leases,violation-codes}.md`
- `specs/{execution-report,resolved-context}.schema.json`
- `registry/{projects.yml,mcps.yml,tools.yml,PROJECTS-SCHEMA.md}`
- `playbooks/{dispatch.sh,quality-gate.sh,validate-journal.sh}`, `prompts/dispatch.md.tmpl`
- `tools/{test-loader,test-generator,test-local-adapter,validate-gorp}.sh`, `jsonschema-min.rb`
- `improvements/roadmap/HERMES-BOOTSTRAP.md`, `improvements/runtime/{PRODUCTION-ADAPTER,FLEET-READINESS}.md`
- `improvements/proposals/{gorp-launch-contract,mutation-journal,unified-check-proposal,doctor-local-only-proposal}.md`
- `fixtures/{loader,generators,adapter}/**` (positive + negative + golden AGENTS.md)
- `memory/{doctrine,failures,tooling,workflows}/` (all `.gitkeep`, empty)

### `guava-hermes`
- `.gorp/gorp.yml` (binding), `.gorp/generated/AGENTS.md` (+ root `AGENTS.md` symlink)
- `.gorp/overlays/{conventions.overlay.md,scope.overlay.yml,personas/README.md}`
- `.gorp/context/overview.md`, `.gorp/plans/current-sprint.md` (GHERM-001 no-op)
- `.gorp/journal/robo-2026-06-26.md` (simulated), `CLAUDE.md`, `README.md`

### `guava-os`
- `CLAUDE.md` (Linear-as-truth authority hierarchy), `package.json`, `vitest.config.ts`, `.gitignore`
- `.gorp/gorp.yml` (binding, `runtime_adapter: unset`), `.gorp/overlays/*`
- `.gorp/process/{agent-protocol,approval-matrix,conventions}.md`
- `.gorp/specs/{claim-leases,execution-state-machine,graph-semantics,violation-codes}.md` (copies of canonical)
- `.gorp/archive/{journal/robo-2026-03-10.md,project-setup-report.md}`
- `.guava-os/src/{cli,config,doctor,linear,next,status,validate}.ts`
- `.guava-os/tests/{next,runtime,smoke,validate}.test.ts` (91 tests, pass)
- `.guava-os/fixtures/{clean,errors,warnings}.json`
- `.guava-os/specs/{execution-report-contract,gorp-launch-contract,mutation-journal,unified-check-proposal,doctor-local-only-proposal}.md`, `execution-report.schema.json`
- `.guava-os/{config.json,config.schema.json,bin/guava-os,RUNBOOK.md,USAGE.md,pilot/report.md,docs/*}`
- `.claude/agents/{architect,backend,frontend,qa,robo}/AGENT.md`, `.claude/skills/{dispatch,handoff,sprint,verify}/SKILL.md`, `.claude/settings.json`
- `.claude/projects/-Users-sebastianrodriguez-Projects-ROUTINEME/memory/MEMORY.md` (stale path)

### Verification commands run
- `git status/log/remote` in all three repos `CODE`
- `bash tools/test-{loader,generator,local-adapter}.sh`, `validate-gorp.sh` → all pass `TEST`
- `npx vitest run` in guava-os → 91/91 pass `TEST`
- content greps for `worktree|git commit|git merge|tmux|gorp launch|claude -p|createIssue|mutation` across `~/dev` → only orphaned `dispatch.sh` matched `CODE`

---

## Pass Criteria — Direct Answers

1. **What executable system exists today?** A governed context-resolution +
   AGENTS.md generation/deployment pipeline (gorp), a read-only Linear-issue graph
   classifier/directive generator (guava-os), and a *simulated* scope-checked
   journal adapter. No real task execution.
2. **Which target components are already real?** Global governance (context/scope),
   project context (partial), the resolved-context + graph *schemas*, structural
   validation, the read-only execution-graph *builder*, and the audit *journal
   format*.
3. **Which exist only as docs/conventions?** Worker execution, isolation, review,
   promotion, orchestration, blocker routing, dependency edges, tmux/launch
   sessions, run records — all `improvements/`/spec only.
4. **Where can governance be bypassed?** Any direct edit/commit to a consumer;
   ordinary git; running npm/tsc by hand; the governed path mutates nothing so it
   is trivially side-stepped; `dispatch.sh`. `pre_write_check` is off.
5. **Is there an actual execution graph?** A real in-memory classifier graph, but
   ephemeral, read-only, and **without dependency edges** — not a persisted,
   enforced DAG. So: not in the required sense.
6. **Is work isolated?** No. It runs (would run) in the primary working tree;
   isolation is design-only.
7. **Are validation, review, promotion separate?** Validation exists (structural
   only). Review and promotion **do not exist**. So they are neither separated nor
   conflated — two of the three are simply absent.
8. **Can actions be reconstructed from an audit trail?** No — records are
   simulated/ephemeral; `.gorp/runs/` is a proposal.
9. **Which repo should own each missing capability?** Worker/isolation/promotion/
   graph-store/policy → **gorp** (adapter + specs). Orchestration/cockpit/health →
   **guava-hermes** (as an adapter over Gorp, never as the authority). Project
   context/Linear-source adapter → **guava-os**.
10. **Smallest credible path to the target?** Resolve the Linear-vs-markdown model
    contradiction; then implement the *one* worktree-isolated adapter already
    designed in `PRODUCTION-ADAPTER.md` (execute→scope-gate→promote-in-scope→run
    record), driven from a minimal guava-hermes dispatch over a single persisted
    graph, for one persona/one task on guava-os. That converts the existing
    governance skeleton into one real, isolated, audited execute→validate→promote
    loop — nothing broader.

*(Per the directive: stopping after the audit. No implementation roadmap will be
produced until this audit is reviewed.)*

---

# 17. Reconciliation Amendments (A1–A4)

*Added 2026-07-14 under the Reconciliation Directive, after operator approval of
the Gorp-native, source-neutral target architecture. These amendments are
binding and supersede any conflicting framing in §1–§16 above. The original
text is retained unedited for provenance.*

## A1. Linear deprecation (supersedes the "Linear vs Markdown" framing)

The prior Linear-centered execution model is **deprecated as an architectural
decision, not an open question.** The contradiction this audit originally
described (§8, §12 item #1, and the §Pass-Criteria answers) as "two rival
execution models — Linear vs Markdown" is **reframed**:

> **Both are external or legacy representations. Neither is the authoritative
> execution model.** Linear is a legacy/optional *import-or-reporting adapter*;
> markdown sprint tables are a legacy *ingestion/export* format. The
> authoritative execution model is a **Gorp-native, source-neutral persisted
> execution graph** (see the roadmap, `ROADMAP.md` §2.2).

Specifically corrected:
- Where §8 says "Linear is the store" and treats Linear-derived state as the
  execution graph — that is now **legacy**. The target requires a persisted
  Gorp-owned graph with stable node/graph IDs, node state, dependencies,
  provenance, and deterministic resume. Linear may *feed* it via an adapter but
  does not *define* it. `INFERENCE` (per approved decision §2.3).
- The conflict is now understood as **partly documentation drift**, not an
  unresolved design fork: `guava-os/CLAUDE.md`, `.claude/agents/*/AGENT.md`,
  `.claude/skills/*`, and the canonical Linear-coupled specs
  (`specs/graph-semantics.md`, `specs/execution-state-machine.md`,
  `specs/claim-leases.md`, and the Linear leakage in
  `specs/execution-report-contract.md`) reflect a **superseded design**. `CODE`
  `DOC`
- These Linear-specific docs/code are **legacy unless explicitly retained as an
  adapter.** The `guava-os` read-only classifier (`.guava-os/src/*.ts`) is
  retained specifically as a candidate **Linear source-adapter / reporting**
  component — evaluated for reuse before any removal (see A4). `CODE`
- **Do not preserve Linear coupling in canonical Gorp architecture.** The
  Linear-coupled canonical specs must be reconciled to source-neutral form
  (roadmap Stage 1/2). Until then they carry `LEGACY/ADAPTER_SPECIFIC` banners;
  their normative bodies are **not** rewritten in the reconciliation directive
  because generated fixtures and tests still reference them (see the
  Documentation Authority Map §7 caveat).

## A2. Validator mutation — corrected finding

**Correction of an earlier claim.** In the original audit I reported that
running `tools/validate-gorp.sh` appended a `routineme` entry to
`registry/projects.yml`, and I attributed the observed working-tree change to
the validator. **On re-verification this was not reproducible and the
attribution was wrong.** Evidence:

- Exact commands re-run from a clean tree, each followed by
  `git hash-object registry/projects.yml`:
  - `bash tools/validate-gorp.sh` (canonical) → sha **unchanged** `TEST`
  - `bash tools/validate-gorp.sh --registry` → sha **unchanged** `TEST`
  - `bash tools/validate-gorp.sh --consumer ~/dev/repos/guava-os` → sha
    **unchanged** `TEST`
- Full gorp test suite (`test-loader.sh`, `test-generator.sh`,
  `test-local-adapter.sh`, `validate-gorp.sh`) run from a clean tree →
  `git status --short` **empty afterward** `TEST`.
- `routineme` is **not** in the committed `registry/projects.yml`
  (`git show HEAD:registry/projects.yml | grep -c routineme` → `0`) `CODE`, yet a
  `~/dev/repos/routineme/` repo with a generated `AGENTS.md` exists. The
  `routineme` registry line seen previously was a **pre-existing uncommitted
  working-tree edit of unknown provenance** (likely a manual registration or an
  earlier deploy step), **not** a side effect of the validator. `INFERENCE`
- No code path in `validate-gorp.sh` writes `registry/projects.yml`
  (grep confirms only reads) `CODE`.

**The real, reproducible side-effect finding (this is the one that matters for
the invariant below):** the **local runtime adapter**
`runtime/adapters/local/run.sh`, when invoked as the sprint's "governed **no-op**
operator check" (task `GHERM-001`), **mutates the consumer working tree** — it
creates `.gorp/journal/<persona>-<date>.md`.
- Exact command:
  `runtime/adapters/local/run.sh --project ~/dev/repos/guava-hermes --persona robo --task-id GHERM-001 --instruction "Governed no-op operator check" --scope ".gorp/journal/**"`
- Exact file changed: `~/dev/repos/guava-hermes/.gorp/journal/robo-2026-07-14.md`
  (created; confirmed via `git status --short` showing `?? .gorp/journal/robo-2026-07-14.md`). `TEST`
- Responsible code path: `run.sh` lines 67–91 (`mkdir -p .gorp/journal`; heredoc
  `cat > $PROJECT/$JOURNAL_REL`). `CODE`
- Deterministic? **Yes** in shape — always one journal file named
  `<persona>-<UTC-date>.md`; content deterministic except the embedded date.
- Can it affect arbitrary consumers? **Yes** — it writes into whatever path is
  passed to `--project`; the journal path is always-allowed by scope so it never
  trips scope validation. `CODE`
- Architectural impact: a command framed to the operator as a **"no-op check"**
  is not observation-only; it performs a repository mutation. This blurs the
  audit's validation/execution boundary and means "running the check" leaves the
  consumer tree dirty.

**Invariant recorded (not fixed in this directive, per instructions):**

> Validation commands must be observational and side-effect free unless mutation
> is explicitly requested.

The local adapter's journal write violates this invariant when used as a check.
Remediation is scheduled in the roadmap (Stage 0 authority cleanup + Stage 6
validation contract, which separates observational validation from mutating
execution). **No behavior was changed here.** All test-induced and
adapter-induced working-tree changes made during verification were restored;
final `git status` for all three repos was clean before documentation edits
began. `TEST`

## A3. Orchestration ownership — corrected

The original audit (§2, §9, §15 gap #3, §Pass-Criteria #9) assigned the
orchestrator to `guava-hermes`. **Corrected per approved decision §2.5:**

- **Gorp owns** the orchestration *contracts* and the *authoritative persisted
  state* (execution graph, state transitions, scheduler rules, task/worker/
  sandbox/validation/review/promotion contracts, blocker-routing policy, run-
  record + audit schemas).
- A **runtime-neutral orchestrator performs scheduling.** The **first
  orchestrator implementation may live inside `gorp`** (roadmap Stage 3). Do not
  create a fourth repository.
- `guava-hermes` **integrates Hermes** and exposes Guava-specific operator
  workflows / an operator-facing entry point. It **may invoke** Gorp
  orchestration and provide a **Hermes-backed worker/runtime adapter**. It does
  **not** own the authoritative execution model or global governance. **Hermes
  remains replaceable.**
- **Workers never spawn workers. Only the orchestrator may modify execution
  topology.** `INFERENCE` (approved §2.5).

This supersedes any statement above implying guava-hermes is the permanent
orchestration owner.

## A4. Deletion language — corrected to disposition-based

The original §13 ("Ruthless Cuts") used "Cut/delete" language. **Corrected: no
duplicated or legacy material is deleted without dependency analysis.** Approved
dispositions (reuse / refactor / replace / retire / create):

| Item | Original wording | Corrected disposition |
|---|---|---|
| `playbooks/dispatch.sh` | "Cut/quarantine" | **Quarantine now** (add `DEPRECATED` header; prevent use), **extract valid requirements** (dependency-wave semantics, journal-status parsing) into the orchestrator/worker contracts, **then remove after the replacement lands** (roadmap Stage 3). |
| Duplicated project specs (`guava-os/.gorp/specs/*`, `.gorp/process/*`, `.guava-os/specs/*` copies) | "Cut" | **Reconcile** against canonical → **deprecate** (banner + reference) → **replace references** in consumers → **remove only after** no doc/code path resolves to the copy. |
| Stale `.claude/.../ROUTINEME/memory/MEMORY.md` | "Cut" | **Remove only after proving no live references.** Reference check done (Authority Map §5): no content references the stale path anywhere in the three repos. Removal still deferred to Stage 0 with operator confirmation, because it is a `.claude/` runtime-adapter artifact, not a pure doc. `NOT VERIFIED` against any local Claude state outside the repo. |
| Linear classifier (`.guava-os/src/*.ts`) | (implied removable) | **Evaluate for reusable source-adapter logic before removal.** The graph-build/parsing/validation code is a viable **Linear import adapter**; retire only the *authority* claim, not necessarily the code. |
| Linear-specific execution specs in the global layer | "Relocate/refactor" | **Refactor to source-neutral** (Stage 1/2); retain Linear parts as an explicit import-adapter concern. Do not delete — they encode real, correct graph/state design. |

The disposition framework (reuse/refactor/replace/retire/create) is applied
throughout `ROADMAP.md` §9.
