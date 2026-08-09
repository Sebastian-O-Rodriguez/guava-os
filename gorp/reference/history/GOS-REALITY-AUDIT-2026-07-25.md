# GOS Reality Audit — 2026-07-25

Read-only audit of `~/dev/gorp`, `~/dev/guava-hermes`, `~/dev/guava-os` (plus supporting
evidence from `~/.local/state/gorp`, `~/.hermes`, and `~/dev/repos/routineme`).
Method: four parallel repo sweeps + direct verification of live runtime state, git
histories, and audit chains. Every claim carries a file path, commit, or on-disk
observation. No code, doc, or state was modified. "GOS" as a name appears in **no**
repository — it is operator vocabulary for the system spanning these repos.

---

## 1. Executive summary

**What has actually been built** is a working, heavily tested, single-host
**governed execution kernel** and a thin browser cockpit for one operator:

- **Gorp control plane** (`gorp/runtime/control/`): ~5,100 LOC strict TypeScript,
  169 vitest tests, 7 JSON-Schema contracts all genuinely enforced at every
  boundary (Ajv, validate-before-persist). Full loop: sprint doc → deterministic
  planner → operator approval → orchestrator → worktree sandbox → worker adapter
  (fixture or Hermes) → fail-closed gate → human review bound to an exact commit
  hash → fail-closed cherry-pick promotion → hash-chained audit records. Since
  Sprint 2.1 (2026-07-25) every orchestrate invocation persists its outcome, so
  detached runs are never silent, and crashes are detected by pid liveness.
- **Operator Shell** (`guava-hermes/shell/`): SvelteKit thin client, zero own
  state beyond a project cookie; inbox / composer / sprint / review / audit
  pages; every stop rendered as what/why/next. It is the primary surface and has
  carried ~20 real sprints.
- **Hermes worker integration** (`guava-hermes/bin/gorp-hermes-worker.mjs` +
  `gorp/runtime/control/src/worker/hermes.ts`): a real LLM worker behind the
  same contract boundary as the deterministic fixture worker; contract-verified
  from both sides; the adapter, not the worker, owns the commit.

**The proof is on disk**: 22 persisted execution graphs across 3 projects, 10
machine-authored governed commits merged into the two real repos (8 in guava-os,
2 in guava-hermes), organic failures/rejections/wedges recorded, and the audit
chain of the one real retry run re-verified intact during this audit
(`chainValid: true`, 5 records, 0 problems).

**What has *not* been built**, despite being advertised by the repo's own docs:

- The **governance content layer** (doctrine, personas, playbooks) is real prose
  but **orphaned from the execution path** — the control plane references none of
  it (zero grep hits), and its content still describes the superseded
  dispatch-wave/Linear model.
- A **second, older runtime** (Bash/Ruby context loader → resolved context →
  generated AGENTS.md) still exists in parallel, is one month stale, is deployed
  to only one of two registered consumers (plus one *unregistered* June-era
  consumer, `routineme`), and still advertises the deprecated `dispatch.sh` to
  agents.
- **`memory/` is empty** (four `.gitkeep`s, one commit, ever), the
  **`improvements/` lifecycle has never been used** (no file has ever moved to
  under-review/accepted/rejected), and **`tools.yml`/`mcps.yml` are empty
  arrays** — i.e., the capability library and the learning loop do not exist.
- The phrases **"Global Capability Library"** and **"self-expanding"** appear in
  **zero files across all three repos**. The controlled-learning loop is
  specified in exactly one line of ROADMAP.md and explicitly excluded from scope.
- **No CI exists anywhere** (no `.github/` in any repo), and essentially the
  entire governed era is unpushed: gorp is 3 commits ahead of origin,
  guava-hermes 10, guava-os 7. The system's whole proof trail lives on one
  machine.

Net: **the execution spine of the vision is real and strong; the operating-system
layers around it (capabilities, learning, enforceable doctrine, fleet) are
scaffolding, stubs, or unwritten.**

---

## 2. Repo inventory

### 2.1 gorp — platform: contracts, governance, control plane

| Aspect | Reality (evidence) |
|---|---|
| Purpose | "Canonical source of truth for the multi-agent operating system" (`README.md:3`, `gorp.manifest.yml:19`). |
| Current role | Ships the only live execution engine (`runtime/control/`), the 7 runtime schemas (`specs/runtime/`), and the project registry (`registry/projects.yml`) — the one governance artifact the runtime actually reads. |
| Key capabilities | plan/approve/run/review/approve-reject-retry/promote/inspect/orchestrate/orchestrate-status CLI; worktree sandboxes; scope+command gates; hash-chained audit; crash detection (Sprint 2.1). |
| Architecture | 18 src dirs, single Ajv boundary (`contracts/validator.ts`), scheduler drives the CLI as subprocesses only (`orchestrator/scheduler.ts:8-15`), git only via `sandbox/worktree.ts`. |
| Maturity | Control plane: high for its scope (169 tests, fail-closed everywhere, determinism proven). Everything outside `runtime/control` + `specs/runtime` + `registry/projects.yml`: frozen June-era or empty. |
| Known limits | Single host, single process, no concurrency (`execFileSync` throughout); no resume for interrupted runs (`inspect.ts` detects only); gate failure fails the whole graph; rejection cancels the whole graph; no CLI for node-level transitions; lock files without staleness detection; TOCTOU run creation; load→update lost-update window. |
| Dead code | `runScopeGate` (never called); 8 of 18 node-transition rows unreachable — **no node can ever reach `blocked`**, so the scheduler's `node-blocked` stop is dead; `DEFAULT_RUN_ID` test-only. TODO/FIXME density: zero. |
| Duplicate ideas | Graph/state machine, worker report, sprint format, agent protocol, scope enforcement, and quality gates each exist twice (legacy prose vs. current schema/code) — §8 items D2, D5. |
| Tech debt (recorded) | README design-debt register (transition-id counter, TOCTOU, no CAS, runId length edge — all still true); ROADMAP "known contract gaps" (blind retries, gate-misconfig conflation, base-drift wedge, commit-subject hygiene, no external audit anchor). |
| Open risks | No CI; manifest precedence rules unenforced; validate-gorp.sh manual-only; docs materially behind code (README limitations false in 3 places, test count stale). |
| Fit | The authority. Everything else is a client or a target of it. |

### 2.2 guava-hermes — operator surfaces + Hermes integration

| Aspect | Reality (evidence) |
|---|---|
| Purpose | Operator entry point + replaceable Hermes runtime integration (`README.md`, Reconciliation Directive framing). |
| Current role | Hosts the **primary operator surface** (browser Shell), the shared thin client (`lib/gorp-client.mjs` — the single bridge, one CLI call per action), the worker wrapper, a terminal client, and a Hermes chat console. |
| Key capabilities | Shell: inbox buckets, one-motion approve-and-start, composer that writes sprint docs to OS tmp, review with mandatory reason and auto-bound artifact hash, stop cards, close-sprint, project switch (cookie), opt-in notifications; 3 polling loops (3–5 s), no websockets. |
| Maturity | Shell current through Sprint 2.1. Terminal client (`bin/gorp-op.mjs`) and console skill are a full generation behind (none of: close, stop reasons, project list, orchestrate-status; console still on the dead default model — BLOCKERS B2). |
| Known limits | Shell UI has **zero automated tests** (`shell/package.json` has no test script; `failure.ts`'s ~12-branch decision table untested); `withProject` env-mutation is safe only single-process; client hand-duplicates 3 Gorp contracts (state path layout, `run-<attempt>`, hash binding) and hand-parses the registry YAML. |
| Dead code | Sprint one-off scripts `shell/e2e-proof.mjs`, `validate-13.mjs`, `continue-13.mjs` (hardcoded sprint ids); unused `trunc()` in the wrapper; `shell/src/lib/index.ts` placeholder. |
| Tech debt | `.gorp/plans/current-sprint.md` (GHERM-001, "pending", simulated-era) contradicted by its own journal; `CLAUDE.md` Status ("Bootstrap… all deferred") contradicts governed-updated `README.md` Status ("Operational"); projects page still says "single-project MVP" next to the project switcher; two stale git worktrees/branches from the skill-note-2/3 wedges never pruned. |
| Open risks | 10 commits unpushed; the wrapper and console depend on free-model availability (B2 pattern). |
| Fit | Pure client + adapter. Verified: no route or lib touches Gorp state except via the CLI (one documented exception: `listGraphIds` reads graph filenames). |

### 2.3 guava-os — pilot consumer

| Aspect | Reality (evidence) |
|---|---|
| Purpose | Originally a read-only Linear-graph classifier CLI (pre-Gorp, split from a habit-tracker project); now the first governed pilot target. |
| Current role | Governance test subject. Its own roadmap was formally terminated by a governed commit (`8b03fec`: "guava-os remains permanently read-only… no Linear mutation authority"). |
| Key capabilities | 1,208-LOC TS classifier (doctor/status/validate/next), 91 tests — which double as **the real quality gates Gorp runs at run and promotion time** (`npm ci`, `vitest`, `tsc`). |
| Maturity | Frozen tool, healthy tests; minimal Gorp binding (validation passes; but `runtime_adapter: unset`, empty context/plans, **no deployed AGENTS.md** — unlike guava-hermes). |
| Known limits | Classifier never invoked by any current code path anywhere (grep-verified) — it is gate-ware and a designated *candidate* Linear import adapter ("deferred; not in slice", `ROADMAP.md:200`). |
| Dead code / contradictions | `limitations.md` still promises the withdrawn Phase 3 (`robo --apply`), claims 99 tests (actual 91), omits `next`; `overview.md` diagram still says "Linear (source of truth)" three sections above its governed correction; `doctor` gate depends on three DEPRECATED files "slated for removal"; stale foreign-machine `.claude` memory file (roadmap U5, still unconfirmed). |
| Open risks | 7 commits unpushed — including every real Hermes-authored change. |
| Fit | Proof substrate: 8 of the 10 governed commits landed here, including the failure/rejection cases that correctly left no trace. |

### 2.4 Materially supporting, outside the three repos

- **Hermes itself** — external agent runtime (`~/.local/bin/hermes`, `~/.hermes/`), operator-owned; skill `gorp-operator` symlinked from guava-hermes; a second skill `gorp-governed-tasks` exists **only** in `~/.hermes/skills/governance/` — untracked by any repo.
- **`~/.local/state/gorp`** — the authoritative state home: 22 graphs, full run-record sets, orchestrator logs (scratch-21 only — all real-project sprints predate Sprint 2.1).
- **`~/dev/repos/routineme`** — a **third, unregistered** consumer from the June context-OS era: full `.gorp/` binding (`id: routineme`), deployed AGENTS.md (27 Jun), last commit an RM-sprint. Not in `registry/projects.yml`; unknown whether it is abandoned or dormant.

---

## 3. Current architecture

### 3.1 The live path (everything that has actually executed work)

```
Operator (one human, one machine)
   │  browser :5199
   ▼
Operator Shell (guava-hermes/shell — SvelteKit, thin, stateless but for a cookie)
   │  lib/gorp-client.mjs — exactly one CLI call per action
   ▼
Gorp CLI (gorp/runtime/control/dist/cli/main.js)
   │  plan | graph transition | orchestrate | review | approve/reject/retry | promote | inspect | orchestrate-status
   ▼
Scheduler (subprocess-only loop; re-discovers all state each step; crash-safe)
   │  run
   ▼
Sandbox: git worktree  gorp/run/<graph>/<node>/<run>  off the recorded base commit
   │  WorkerAdapter boundary (schema + identity echo + summary required)
   ├── fixture adapter (deterministic)
   └── hermes adapter ── spawns GORP_HERMES_CMD ──▶ gorp-hermes-worker.mjs ──▶ hermes CLI ──▶ LLM
   ▼
Gate: scope checks + structured project commands (fail closed, timeouts, captured output)
   ▼
Human review (Shell) — decision bound to exact sandbox commit hash; hermes output can never auto-approve
   ▼
Promotion: verify base unchanged + reviewed hash + FULL live gate re-run → git cherry-pick → promotion record
   ▼
Consumer repo (guava-os / guava-hermes) — 10 governed commits to date
   ▼
Audit: per-run hash chain (worker-result → gate → run → decision → promotion), `gorp inspect`, no external anchor
```

State home (`~/.local/state/gorp/projects/<id>/`): `graphs/*.json` + `.lock`,
`runs/<graph>/<node>/<run-N>/` (5 records + chain + sandbox), and since 2.1
`orchestrator/<graph>.jsonl` (started/ended invocation log).

### 3.2 The dormant parallel path (built June, not part of execution)

```
gorp.manifest.yml (load order, precedence classes)
   ▼
runtime/loader/resolve-context.sh (Bash+Ruby)          last touched 2026-07-18
   │  doctrine/ + personas/ + playbooks/ + overlays → resolved-context.json
   ▼
runtime/generators/generate-agents-md.sh               last touched 2026-06-26
   ▼
<consumer>/.gorp/generated/AGENTS.md
     deployed: guava-hermes (26 Jun), routineme (27 Jun, unregistered)
     never deployed: guava-os (golden fixture exists in gorp)
```

Verified disjoint: zero imports/references in either direction between this path
and `runtime/control` (grep across src + tests). It also still enumerates the
deprecated `dispatch.sh` into every resolved context (`resolve-context.sh:198`).
Two independent scope-enforcement implementations exist (`runtime/policies/scope.yml`
declarative vs `src/gate/scope.ts` code) with no shared source.

---

## 4. Current capabilities (proven, on-disk)

Can do today, evidenced by real runs:

- Compose → plan → approve → execute → review → promote a multi-node sprint with
  dependencies, through the browser only, with a real LLM worker (guava-os-real-1:
  2 nodes, 1 retry, both promoted).
- Reject at review (dogfood-6), fail closed on scope violation and gate
  misconfiguration (dogfood-5/5b), recover via a corrected sprint (5c).
- Retry as an immutable per-run verdict with attempt-scoped run ids (Sprint 5A).
- Survive crashes by re-discovery; since 2.1: persist every orchestrate outcome,
  detect crashes by pid liveness, and explain every stop as what/why/next
  (five failure scenarios dogfooded 2026-07-25: gate fail, dirty tree + recovery,
  base drift + close, worker no-changes, SIGKILL → interrupted-run).
- Verify any run end-to-end from records alone (`gorp inspect`, chain re-verified
  during this audit).

Cannot do today (each verified in code, not assumed):

- Resume or re-base any interrupted/wedged work (close + re-compose is the only exit).
- Feed a retry reason to the next attempt (worker task payload has no such field).
- Route blockers: the `blocked` state is unreachable — blocker routing, a stated
  target outcome, structurally cannot occur.
- Run two things at once, or two projects from one process (env-global config,
  non-CAS store, per-write locks).
- Enforce any doctrine outside the governed write path (direct edits bypass everything).
- Prove anything in CI (none exists) or to a second machine (proof trail unpushed).

---

## 5. Governance status

**Enforced (structural, fail-closed, tested):** the 7 runtime schemas at every
boundary; transition table with actor authorization (workers rejected as actors);
scope + forbidden-path + command gates; human-only review for LLM output with
hash-bound decisions; promotion identity + base checks + full gate re-run;
append-only hash chains; provider-neutrality of contracts (enforced by test:
`FORBIDDEN_TERMS` includes "linear", "hermes", "claude code"); registry-resolved
project paths (`PROJECT_NOT_REGISTERED` fail-closed).

**Advisory only (prose, bypassable):** everything in `doctrine/` (approval
matrix, agent protocol, conventions — unchanged since 2026-06-18; not read by any
code; `agent-protocol.md` still claims the deprecated `dispatch.sh` "enforces
this loop"); persona bodies; `gorp.manifest.yml` precedence classes (no test, no
enforcement in the control plane); `tools/validate-gorp.sh` (real checks, manual
execution only). gorp's own audit records this: "Governance outside the governed
path is still advisory" (`CURRENT-REALITY-AUDIT.md` §7.5).

**Governed-artifact inventory** (Global = lives in gorp and consumed by reference;
Project = consumer-owned; Mixed = split or duplicated):

| Artifact class | Scope | State |
|---|---|---|
| Runtime contracts (7 schemas) | Global | Live, enforced |
| Execution state (graphs, runs, chains, orchestrator logs) | Global store, per-project keyed | Live (22 graphs) |
| Project registry (`projects.yml`) | Global | Live; `runtime_adapter` fields stale; scratch-21 & routineme absent |
| Tool / MCP capability registries | Global | **Empty arrays** |
| Doctrine (approval matrix, protocol, conventions, gotchas) | Global | Prose-only, frozen 06-18, partially superseded content |
| Personas + schema | Global | Substantive but describe the superseded dispatch model; loaded only by dormant path |
| Playbooks | Global | Legacy era; `dispatch.sh` deprecated-but-unguarded; `quality-gate.sh` superseded by structured gates |
| Scope policy | **Mixed** | `runtime/policies/scope.yml` (declarative, dormant path) + `gate/scope.ts` (enforced) — two implementations |
| Templates (project scaffolding) | Global | Frozen gorp-kit era; `settings.json` is Claude-Code-specific despite neutrality rule |
| Memory (cross-project lessons) | Global | **Empty since creation** |
| Improvements pipeline | Global | Seeded once, **lifecycle never used** |
| Consumer bindings + overlays (`.gorp/gorp.yml`) | Project | Live, validated; guava-hermes fuller than guava-os |
| Generated AGENTS.md | **Mixed** | Deployed guava-hermes + routineme (stale ~1 month); absent guava-os |
| Operator surfaces, worker wrapper | Project (guava-hermes) | Live |
| Governed proof commits | Project | 10 commits, all documentation-only, all unpushed |
| Hermes skills | **Mixed** | `gorp-operator` tracked+symlinked; `gorp-governed-tasks` exists only in `~/.hermes` |

---

## 6. Self-expansion status

**Missing entirely.** The full evidence:

- The controlled-learning pipeline is specified in exactly one line
  (`ROADMAP.md:132`: "observe→record→propose→review→test→approve→publish") and
  "autonomous global learning" is explicitly **excluded** from scope (`ROADMAP.md:180`).
- `memory/{doctrine,failures,tooling,workflows}/` — four `.gitkeep`s, one commit
  ever, zero content; not in the manifest load order; advertised as a live layer
  by both README and architecture doc.
- `improvements/` — real README describing the lifecycle, but no file has ever
  entered `under-review/`, `accepted/`, or `rejected/`; the worktree-sandbox
  proposal was implemented *without* passing through the pipeline it defines.
- The one planned touchpoint — M11's "operator observations logged to
  `improvements/`" — has not happened (M11 pilot itself superseded by events).
- At execution scale, even single-run learning is absent by contract: retries are
  blind (the recorded reason never reaches the worker).

What *does* accumulate: operator-curated documents (`OPERATOR-BACKLOG.md` — every
item evidence-tagged from real operation; `BLOCKERS.md`) and the audit trail
itself. Institutional memory currently lives in those two files and in git
history, not in any designed mechanism.

---

## 7. Vision alignment

The four pillars named in the audit directive, against evidence. Note: **two of
the four pillar names appear nowhere in any repo** — see Unknowns.

| Pillar | Status | Evidence |
|---|---|---|
| **Project model** | **Partial** | Real: registry + per-consumer `.gorp/gorp.yml` bindings + overlays (tighten-only, validated) + `PROJECT-METADATA-SPEC.md` + projectId-only execution state with command-time path resolution. Gaps: no formal "project model" doc; `runtime_adapter` fields stale; capability categories all empty; consumers unevenly integrated (guava-os: no AGENTS.md, empty context/plans; routineme: bound but unregistered); identity spread across three artifacts (metadata spec / registry / binding) with a manual-only sync validator. |
| **Global Capability Library** | **Missing** | Zero hits for "capability library" in all repos. `registry/tools.yml` = `tools: []`, `mcps.yml` = `mcps: []`, both untouched since 2026-06-18; `secrets.yml` planned+absent. Closest existing things: the persona capability *enum* (permission model, not a library), `approved_mcp_categories`/`approved_tool_categories` fields (empty everywhere), and the "generalized MCP marketplace" line in ROADMAP's **Excluded** list. |
| **Governance** | **Partial — strong core, advisory shell** | Execution governance is implemented and structural (§5). Content/doctrine governance is prose-only, unenforced, partially superseded, and bypassable by any direct edit. The manifest's "structural guarantee against drift" rests on a deployment mechanism that is stale and only half-deployed. |
| **Self-expanding loop** | **Missing** | §6. One-line spec, explicitly out of scope, zero mechanism, zero content, no usage ever. |

---

## 8. Drift (implementation vs. stated model) — why / impact / severity

**D1 — Two parallel runtimes; only one governs.** The manifest/README describe a
context-OS (load order over doctrine/personas/playbooks) as *the* system; the
system that actually executes work loads none of it. Why: the control plane was
built beside, not on, the June stack, and the reconciliation never circled back.
Impact: the "canonical source of truth" is canonical for a path nothing uses;
agents that DO load context (via AGENTS.md or the loader) receive the superseded
model, including `dispatch.sh` as a live playbook reference. **Severity: high.**

**D2 — Doctrine and personas teach the deprecated model.** `agent-protocol.md`
names dispatch.sh as enforcer; `robo.md` instructs markdown sprint tables and
parallel waves — both contradicted by ROADMAP decisions §2.4/§2.5 and by the
authority map's own prescribed-but-never-executed fixes. Impact: any future
agent onboarded through the doctrine layer is mis-trained. **Severity: high** (latent
— currently no agent reads it in the governed path).

**D3 — dispatch.sh: banner'd, unguarded, past its removal gate.** Its banner
promises a Stage-0 use-guard ("intentionally NOT added here"); ROADMAP says
remove after M6; M6 is done; the script still runs. Impact: a deprecated
execution path remains executable and loader-advertised. **Severity: medium.**

**D4 — Advertised layers are empty.** README/architecture present memory/,
improvements/, tools/mcps registries as live layers of the OS; all are stubs
(§6). Impact: the docs materially overstate the system; "read everything" gives
a false map. **Severity: medium.**

**D5 — Duplicate specifications.** Graph semantics, worker report, sprint
format, agent protocol, scope enforcement, quality gates each specified twice
(legacy vs current); U6 reconciliation open since the roadmap was written.
Impact: contradiction risk on every future edit; already visible as broken/
self-contradictory cross-references. **Severity: medium.**

**D6 — Control-plane docs behind the code (fresh drift, opposite direction).**
README "Current limitations" false in 3 places (single-node only / no retries /
fixture-only), test count stale twice (153 README vs 169 actual; guava-os 99 vs
91), execution-graph schema prose still says "exactly one node", debt register
never updated for 5A. Impact: the newest, most load-bearing component can't be
trusted from its own README. **Severity: medium.**

**D7 — Registry truth lags execution truth.** `runtime_adapter: unset/local`
while real sprints ran `hermes`; scratch-21 state exists under the default state
home but is unreachable via the default registry; routineme is bound but
unregistered; op-demo-1/shell-demo-1 appear in the sprint history table but
their state is gone. Impact: audit continuity and project-model integrity leak
at the edges. **Severity: medium.**

**D8 — Ownership drift: the Hermes adapter lives in gorp core.** ROADMAP §5
assigns the adapter's first implementation to guava-hermes; reality:
`src/worker/hermes.ts` in the control plane (generic subprocess spawn — the
Hermes-specific logic did stay in the wrapper). Impact: mild erosion of the
"runtime-specific code confined to adapters-in-consumer-repos" rule; a
runtime-named module sits in the neutral core (its env config also leaks past
the worker-blindness boundary: `GORP_HERMES_CMD` read inside the adapter, not
passed via invocation). **Severity: low-medium.**

**D9 — Operator-surface generation gap.** Terminal client and Hermes console
lack close/stop-reason/project-switch/orchestrate-status; console shim depends
on the Hermes default model documented dead in B2; skill text still frames the
console as the surface. Impact: the "optional surfaces" are operationally behind
the shell and one of them fails on launch under current model config.
**Severity: medium** (self-contained; shell unaffected).

**D10 — Local-only proof trail.** 20 unpushed commits across the three repos
include every governed commit and both Sprint 2.1 features; no CI, no second
copy of `~/.local/state/gorp`. Impact: the entire evidence base of the system
has single-machine durability. **Severity: high** (as risk exposure, not
correctness).

**D11 — Cosmetic/doc residue.** CLAUDE.md-vs-README status contradiction
(guava-hermes), one-sprint-stale shell README, "single-project MVP" label beside
the project switcher, broken renamed-file references (`CURRENT-TO-TARGET-ROADMAP.md`
×9, `archive/` path ×3), authority-map banners never applied (bootstrap.md,
patterns.md, FLEET-READINESS.md), stale worktrees from wedged sprints, ROADMAP
citing audit sections that now say the opposite. **Severity: low** individually;
collectively it undermines "read first" reliability.

---

## 9. Risks (ranked)

1. **Single-machine, unpushed, un-CI'd system of record** (D10). One disk
   failure erases the governed era's proof. The observed-but-unreproduced 3-test
   flake (suspected parallel `tsc` race on `dist/`, logged in the backlog) must
   be understood before any CI can gate merges (Phase 2.5 depends on it).
2. **Governance is only as wide as the governed path.** Direct edits to any
   consumer bypass everything; doctrine is advisory; trust currently rests on
   operator habit, exactly as gorp's own audit states.
3. **External LLM dependency churn** (B2 pattern): load-bearing components
   default to whichever free model currently exists; the console is broken under
   the current default. Any future "CI dogfood sprint" (Phase 2.5 intent)
   inherits this nondeterminism plus billing.
4. **Latent multi-project/concurrency hazards** dormant under today's
   single-operator discipline but directly in Phase 2.4's path: non-CAS graph
   store, lock files without staleness detection, TOCTOU run creation,
   process-env-global registry/state-home/adapter config, branch-name collision
   for duplicate repo_paths, pid-reuse-naive liveness.
5. **Doc-truth decay in the trusted core** (D6): three false limitation claims
   accumulated within ten days in the most-read README; the operator's stated
   method ("read first") is only as good as these files.
6. **Wedge/recovery gap** (known, scheduled for 2.2): base drift and interrupted
   runs still discard approved work; the unreachable `blocked` state means
   blocker routing — a stated target outcome — cannot occur at all.
7. **Audit chain has no external anchor** (by design, documented): integrity
   evidence, not tamper-proofing, so long as state and repos share one host.
8. **Orphaned-consumer ambiguity**: routineme carries a live binding and
   deployed AGENTS.md but is outside the registry — an ungoverned copy of the
   governance interface.

---

## 10. Recommended roadmap changes (evidence-driven; no designs)

1. **Decide the dormant stack's fate before Phase 2.4.** Evidence: D1/D2/D3 —
   two runtimes, zero cross-references, loader advertising a deprecated script,
   personas teaching a dead model. The roadmap currently has no line item for
   reconciling or retiring the context-OS path; every phase-2 sprint builds only
   on the control plane.
2. **Write the missing vision documents or drop the pillars.** Evidence:
   "Global Capability Library" and "self-expanding loop" have zero definitional
   text anywhere while being audit criteria; the only capability/learning
   artifacts are empty stubs explicitly excluded from scope. The roadmap cannot
   sequence what is nowhere specified.
3. **Add durability before more history accrues.** Evidence: D10 — 20 unpushed
   commits, no CI, single copy of the state home. This is a smaller, earlier
   step than Phase 2.5's full CI and is prerequisite to it.
4. **Fold a doc-truth gate into Phase 2.5.** Evidence: D6/D11 — false README
   claims, stale counts, broken references accumulated within days, in a project
   whose method is "read first, evidence only." (validate-gorp.sh already exists
   and is manual-only.)
5. **Add registry hygiene to Phase 2.4's scope.** Evidence: D7 — stale
   `runtime_adapter` fields, unregistered-but-bound routineme, vanished demo
   state, no duplicate-repo-path detection (branch-collision hazard identified
   in code).
6. **Keep 2.2 recovery scoped to the evidence-backed gaps** (already aligned):
   re-run-on-new-base, retry feedback, resume — plus consider the unreachable
   `blocked` state, since the recovery model references a state no worker can
   produce.
7. **Resolve the CI-dogfood determinism conflict before 2.5.** Evidence: B2
   history plus "real governed dogfood sprint in CI" implies live-LLM,
   billed, churn-exposed merge gating — directly at odds with "bad run blocks
   merge."

---

## Appendix A — Unknowns (evidence needed; not guessed)

- **Where the vision is written.** "GOS", "Global Capability Library",
  "self-expanding loop", and "Project model" (as a named concept) appear in no
  repo file. If a vision document exists outside these repos, it is needed to
  audit alignment beyond §7's inference; otherwise §7 compares against
  operator-stated pillars only.
- **routineme's status** — active consumer, dormant, or abandoned? Registry
  omission vs live binding is contradictory; operator knowledge needed.
- **`~/.hermes/skills/governance/gorp-governed-tasks`** — untracked by any repo;
  authorship and load-bearing status unknown.
- **The 3-test flake** — observed once (2026-07-25), vanished on re-run,
  unreproduced; suspected dist/ build race; needs a controlled reproduction
  before CI work.
- **op-demo-1 / shell-demo-1 state** — referenced in the sprint history table;
  no state on disk; presumed deleted with the old scratch registry entry, not
  verified.
- **Whether any external backup of `~/.local/state/gorp` exists** — none found
  in-repo; operator knowledge needed.

## Appendix B — Primary data observed

Graphs on disk (22): guava-os 9 (6 completed, 3 cancelled — incl. dogfood-6
rejected-at-review), guava-hermes 5 (2 completed, 3 cancelled — incl. 2
base-drift wedges), scratch-21 8 (Sprint 2.1 failure-semantics dogfood).
Governed commits: guava-os `4675064 e40a054 42d1fde c9420b9 2cbd423 8b03fec
cd3052d 03d1ba7`; guava-hermes `d94114e 5467959`. All documentation-only.
Audit chain spot-check: `guava-os-real-1/t2-commands/run-2` — chainValid true,
5 records, 0 problems (verified 2026-07-25). Push state: gorp +3, guava-hermes
+10, guava-os +7 ahead of origin. Test totals: gorp control 169/169 (18 files);
guava-hermes 8 node tests; guava-os 91 vitest; shell UI 0.
