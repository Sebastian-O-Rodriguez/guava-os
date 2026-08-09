# Current-to-Target Roadmap (SUPERSEDED)

> **Superseded 2026-07-31.** This roadmap is a point-in-time record of the
> launch planning. It contradicts ADR_001 in several places (Linear
> deprecation, gorp-owned planning, Hermes as a named component). The
> canonical architecture is now ADR_001 + `docs/architecture/guava-os-gorp-contract.md`.
> Linear is the source of truth for current planning. Retained as historical
> record only.

# Current-to-Target Roadmap

> **Authority note (2026-07-27).** Product intent, ownership, current status,
> and non-negotiable rules live in `VISION.md`, `SYSTEM-MODEL.md`,
> `CURRENT-STATE.md`, and `ARCHITECTURAL-INVARIANTS.md`. This roadmap is the
> planning record; where its older sections disagree with those four
> documents, they win.

> **2026-07-27 cleanup note.** The pre-control-plane stack was removed
> (context loader, AGENTS.md generator, doctrine/, personas/, playbooks/
> incl. dispatch.sh, templates/, runtime/policies/, runtime/adapters/,
> memory/, improvements/, empty capability registries, legacy/,
> tools/ harnesses, fixtures/, metadata/, resolved-context specs,
> reference/bootstrap+patterns). References to those paths in the historical
> sections below describe deleted artifacts and are retained as record.
> Consumer `.gorp` bindings were likewise retired; a consumer is now just a
> registry entry. U5 (stale ROUTINEME memory) and U6 (legacy Linear spec
> reconciliation) are closed by deletion.

Produced under the Reconciliation Directive; updated 2026-07-14 at the Wave A
closeout. Companion to `reference/history/CURRENT-REALITY-AUDIT.md` (rewritten
clean reference; original archived at
`reference/history/CURRENT-REALITY-AUDIT-original.md`) and
`reference/history/DOCUMENTATION-AUTHORITY-MAP.md`.

> **STATUS (2026-07-16): Waves A–E + Sprints 2A/3A/3B implemented.**
> The TypeScript control runtime lives at **`gorp/runtime/control/`** with its
> **seven** canonical schemas at **`gorp/specs/runtime/`** (incl. the
> `sprint` planning contract). The full control
> loop works per explicitly chosen node — `gorp run` (per-node worktree
> sandbox + fixture worker behind the **adapter seam** + scope gate),
> `gorp review` (read-only), `gorp approve | reject` (one terminal immutable
> decision; reject cancels the graph), `gorp promote` (fail-closed
> cherry-pick against the per-node-run base; never completes the graph), and
> `gorp inspect` (complete read-only audit over hash-chained records —
> integrity evidence with **no external anchor**, plus interrupted-run
> recovery state) — and **`gorp orchestrate`** drives a whole multi-node
> graph through that loop (single process, dependency order, crash-safe by
> re-discovery, completes the graph only when every node is terminal;
> completion is guarded by the all-nodes-terminal invariant). Multi-node
> graphs persist and execute node-by-node; runs/sandboxes/records are keyed
> per graph+node+run. 127 Vitest tests green. Remaining before Hermes: the
> Hermes adapter itself (implement `WorkerAdapter`, pass the shared contract
> boundary), (the useful guava-os canary landed 2026-07-17 as guava-os
> commit 4675064). The gate now runs project
> commands (Sprint 3C) and the scheduler's approvals go through a pluggable
> review policy (fixture output auto-approved; everything else stops for a
> human) — see §7 of `reference/history/CURRENT-REALITY-AUDIT.md`.

Evidence labels: `CODE` / `TEST` / `DOC` / `INFERENCE` / `NOT VERIFIED`.
Disposition verbs: **reuse / refactor / replace / retire / create.**

---

## 1. Target Outcome

**Approved end outcome:**

> Given an approved sprint, the system deterministically decomposes it into an
> execution graph, dispatches well-scoped work to isolated workers, validates
> every result against governance, escalates only irreducible blockers, and
> promotes approved changes into the project with a complete audit trail.

**Broader operating outcome:**

> A software project continuously converts approved work into merged code with
> minimal human intervention while remaining deterministic and auditable.

**Approved vertical-slice sequence:**

> **disposable fixture repository → prove execution mechanics → useful
> guava-os canary → small real sprint.**

The first execution proof runs one approved task against a **disposable Git
fixture repository** (created for the proof, thrown away after): persisted Gorp
execution graph, deterministic **fixture** worker inside an isolated Git
worktree, validated against scope and project gates, reviewed through an
explicit approval gate, promoted into the target branch, and recorded in a
durable audit record. Only after that proof does `guava-os` receive a
**useful canary task** — the canary must produce something of real value; no
meaningless artifacts are written into guava-os. A small real sprint follows
the canary.

**Planning scope (updated, final sprint 2026-07-17):** a **planner now
exists** — `gorp plan` deterministically maps an operator-approved sprint
document (`sprint.schema.json`) to a draft execution graph and rejects bad
sprints (cycles, unknown deps, unregistered workers, capability lies).
Decomposition of *goals into sprints* remains human work; the planner never
executes or approves anything — the graph still requires the explicit
operator approval transition.

Constraints on the slice: one machine, one operator, one project, one sprint,
one task, one worker, **no concurrency**, local Git, terminal interface.

## 2. Current Baseline (verified capabilities only)

Retained from the audit; only what is backed by `CODE`+`TEST`:

- **Wave A control runtime (`gorp/runtime/control/`)**: four canonical
  source-neutral schemas (`execution-graph`, `worker-result`, `gate-record`,
  `run-record`) at `gorp/specs/runtime/`; persisted, schema-validated,
  atomically-written single-node execution graph under the machine-local state
  root; enforced transition table with actor authorization (workers rejected);
  `gorp graph create|validate|show|transition` implemented; structured JSON
  output with documented exit codes; 58/58 Vitest tests green `CODE` `TEST`.

- **Context resolution → AGENTS.md generation → deployment** works
  deterministically and fail-closed (`resolve-context.sh`, `generate-agents-md.sh`,
  `deploy-agents-md.sh`; loader + generator fixtures pass) `CODE` `TEST`.
- **Consumer/registry validation** (`validate-gorp.sh` canonical / `--consumer` /
  `--registry`) passes and is **side-effect free** (re-verified; see audit §A2)
  `CODE` `TEST`.
- **Read-only execution-graph classifier** in guava-os builds a typed graph from
  supplied Linear JSON, validates violations, emits directives; 91 vitest tests
  pass `CODE` `TEST`.
- **Local adapter** runs a **simulated** task: writes a journal, does post-hoc
  git-diff scope validation, correct exit codes (0/1/2/3). It calls **no** agent
  runtime and performs **no** real task work `CODE` `TEST`. It also **mutates**
  the consumer tree (journal) even for a "no-op check" (audit §A2).
- **Source-neutral contracts already in place and reusable:**
  `runtime/adapters/CONTRACT.md`, `runtime/loader/RESOLUTION-SPEC.md`,
  `specs/resolved-context-contract.md` + `.schema.json`,
  `metadata/PROJECT-METADATA-SPEC.md`, `registry/PROJECTS-SCHEMA.md`,
  `improvements/runtime/PRODUCTION-ADAPTER.md` (worktree design) `DOC`.

**Not present as code (target-only):** worker execution, sandbox isolation,
scheduler/orchestrator, blocker router, review engine, promotion, durable
assembled run records, autonomous learning, Hermes worker adapter. (audit §3)
`CODE`. (The persisted graph and the first source-neutral schema set, formerly
in this list, were delivered by Wave A.)

## 3. Architectural Decisions

**Confirmed (from the directive, treated as decided):**
1. Three repos: `gorp` (platform contracts + governance + first orchestrator),
   `guava-hermes` (Hermes integration + operator entry point; replaceable),
   `guava-os` (first governed project consumer + pilot). §2.1
2. Gorp owns a **source-neutral internal execution model** (sprint, task, graph,
   state, deps, assignments, blocker/validation/review/promotion state, run
   records, provenance). External task systems are adapters only. §2.2
3. **Linear is deprecated** as execution authority; retained only as
   legacy/adapter/reporting. §2.3
4. **Markdown sprint tables** are non-authoritative (ingestion/export only). §2.4
5. Orchestration boundaries: Gorp owns contracts + authoritative state; a
   runtime-neutral orchestrator schedules; first impl may live in gorp; workers
   never spawn workers; only the orchestrator mutates topology. §2.5
6. First proof is a **deterministic fixture worker** before any AI runtime;
   Hermes is **not** the first dependency. §2.6
7. Controlled learning: observe→record→propose→review→test→approve→publish;
   global promotion needs stronger review than project-local. §2.7

**Resolved since the original roadmap (operator-approved):**
- **U2 → RESOLVED: TypeScript control runtime; shell only at operating-system
  boundaries.** The control runtime (graph store, transitions, CLI, and future
  orchestrator logic) is TypeScript. Existing Ruby and shell tools (loader,
  generator, validators, fixture harnesses) remain supported but are **not
  expanded into the control plane**. Implemented in Wave A.
- **U3 → RESOLVED in practice:** JSON Schema 2020-12, matching
  `gorp/specs/runtime/*.schema.json`. (A sprint schema itself remains later
  work — planning is out of Sprint 1 scope.)
- **U4 → RESOLVED: authoritative graphs and run records are stored under a
  configurable machine-local Gorp state root** — default `~/.local/state/gorp`,
  override `GORP_STATE_HOME`. **Runtime state must not live in consumer
  repositories.** Any earlier recommendation to store authoritative state in
  `guava-os/.gorp/graph/` or `guava-os/.gorp/runs/` is withdrawn.
- **U1 → RE-SCOPED: persona-format reconciliation does not block the fixture
  worker.** It is **Hermes-adapter preparation** (Stage 10 prerequisite), not a
  fixture-worker prerequisite — the deterministic fixture worker uses no
  persona.

**Still unresolved (flagged, not assumed):**
- **U5.** Removal of `.claude/.../ROUTINEME/memory/MEMORY.md` (stale) — marked
  `STALE`, retained; needs a one-line operator confirm because it is unverified
  against external local Claude state.
- **U6.** Reconciling Linear-coupled canonical specs to source-neutral form will
  change generated fixtures/tests — sequencing vs the frozen fixtures (§7 M1).

## 4. Ruthless Scope

### Included (launch-critical only)
- One source-neutral sprint/task/graph/report schema set (minimum fields).
- One persisted single-node (single-task) execution graph under Gorp authority.
- One minimal, single-pass, no-parallelism orchestrator.
- One Git-worktree sandbox with scoped promotion.
- One deterministic fixture worker (success + blocker + validation-fail +
  out-of-scope modes).
- Deterministic validation (scope + always-deny + patch + one project command +
  report schema check), fail-closed.
- One human CLI review gate (approve/reject/retry/escalate).
- One promotion step (verify reviewed artifact → apply → record commit).
- One durable run record capturing the full chain.
- Documentation reconciliation (this directive).

### Excluded (explicitly deferred until slice + pilot pass)
Fleet/multi-project, concurrency/parallel scheduling, dynamic worker spawning,
dashboards, Linear sync, messaging, generalized MCP marketplace, secrets
platform, model-routing optimization, autonomous global learning, remote
execution, multiple operators, AI reviewer, adaptive graph rewriting, Hermes
runtime (until Stage 10). §6.2

## 5. Repository Ownership

| Capability | Contract Owner | First Implementation Location | Consumer | Notes |
|---|---|---|---|---|
| Global governance / doctrine | gorp | gorp | all | already real |
| Runtime contract **schemas** (4: execution-graph, worker-result, gate-record, run-record) | gorp | `gorp/specs/runtime/*.schema.json` — **implemented (Wave A)** | orchestrator, workers | source-neutral, JSON Schema 2020-12 |
| Persisted execution graph | gorp | `gorp/runtime/control/` — **implemented (Wave A)**; stored under the machine-local state root (`GORP_STATE_HOME`, default `~/.local/state/gorp`) | orchestrator, operator | **never stored in consumer repositories** |
| Orchestrator (scheduler) | gorp | `gorp/runtime/control/` (TypeScript, Wave B) | operator | runtime-neutral; **not** in guava-hermes |
| Worker contract | gorp | `runtime/control/src/worker/adapter.ts` — **implemented (Sprint 3B)**: `WorkerAdapter` interface + registry + contract-enforcing boundary (schema, identity echo, adapter-name match; blind invocation) | fixture worker, later Hermes | Hermes = implement the interface, register, pass the same checks |
| Fixture worker | gorp | `gorp/runtime/workers/fixture/` | orchestrator | test harness, not production |
| Sandbox (worktree) | gorp | `gorp/runtime/sandbox/` | orchestrator | from PRODUCTION-ADAPTER design |
| Validation | gorp | `gorp/runtime/validation/` | orchestrator | reuse scope.yml + quality-gate.sh |
| Review gate | gorp | `gorp/runtime/review/` (CLI) | operator | human-operated |
| Promotion | gorp | `gorp/runtime/promotion/` | orchestrator | worktree→target apply |
| Run record / audit | gorp | schema in gorp (`run-record.schema.json`, Wave A); records under the machine-local state root | operator | provenance; **not in consumer repositories** |
| Project context / overlays | guava-os | guava-os `.gorp/` | loader | consumer-owned |
| Linear **import adapter** (optional) | gorp (contract) | reuse `guava-os/.guava-os/src/*` | orchestrator (optional) | deferred; not in slice |
| Operator entry point + Hermes worker adapter | guava-hermes | guava-hermes | operator | **Stage 10+**, replaceable |

**Rule honored:** no core authority is assigned to a runtime-specific repo.
guava-hermes gets an *adapter* and an *entry point*, never the execution model.

**Runtime language (decided, supersedes the old U2 recommendation):** the Gorp
control runtime is **TypeScript; shell only at operating-system boundaries**
(git invocation, process spawning, filesystem primitives). The first
orchestrator and fixture worker extend the Wave A TypeScript package in
`gorp/runtime/control/`. Existing Ruby and shell tools remain supported where
they already operate but are not expanded into the control plane.

## 6. Critical Path (minimum ordered dependency chain)

```
Stage 0 Authority cleanup (docs + quarantine + observability invariant)
   └─> Stage 1 Canonical schemas (sprint, task, graph, node, state, report, review, promotion, run)
        └─> Stage 2 Persisted execution graph (single node) + deterministic resume
             └─> Stage 4 Sandbox (worktree)         ┐
             └─> Stage 5 Fixture worker             ├─(3 can be scaffolded in parallel on paper,
             └─> Stage 6 Validation                 ┘  but integrated by the orchestrator)
                  └─> Stage 3 Minimal orchestrator (wires 2,4,5,6,7,8,9 in one pass)
                       └─> Stage 7 Review gate
                            └─> Stage 8 Promotion
                                 └─> Stage 9 Durable audit record
                                      └─> [FIRST VERTICAL SLICE COMPLETE]
                                           └─> Stage 10 Hermes adapter (same worker contract)
                                                └─> Stage 11 Single-sprint pilot
```

Orchestrator (Stage 3) is the integrator; it cannot be exercised end-to-end
until 2/4/5/6 exist, and cannot complete the loop until 7/8/9 exist.

## 7. Milestones

> Each milestone: objective · repository · inputs · code changes · output
> artifacts · tests · pass criteria · dependencies · risks · non-goals. All
> "code changes" are **future** work (this directive does not implement them).

### M0 — Authority Cleanup (Stage 0)
- **Objective:** documentation reconciled; legacy execution paths quarantined;
  observability invariant recorded; deprecated dispatch cannot be used by
  accident.
- **Repository:** all three (docs); gorp (quarantine guard — *doc/guard only*).
- **Inputs:** this roadmap, authority map, amended audit.
- **Code changes:** none to runtime. Add `DEPRECATED` banners; add a
  **use-guard plan** for `dispatch.sh` (e.g. a leading `exit` guard) — *planned,
  applied only on approval since it touches a script*.
- **Output artifacts:** updated docs, banners, this roadmap.
- **Tests:** re-run gorp + guava-os suites → still green; `git status` clean
  except intended docs.
- **Pass criteria:** completion criteria §10.1–§10.7, §10.11 satisfied.
- **Dependencies:** none.
- **Risks:** editing a spec that a test/generated fixture consumes → desync.
  *Mitigation:* banner-only on those specs (see authority map §7).
- **Non-goals:** no schema/behavior change; no deletion of quarantined files.

### M1 — Canonical Schemas (Stage 1) — **IMPLEMENTED (Wave A)**
- **Objective:** minimum machine-readable, **source-neutral** schemas needed by
  the slice.
- **Approved schema scope — four schemas in the Wave A first slice** (the
  earlier eleven-schema first-slice plan is withdrawn as over-schema-ing),
  **grown to six in Wave D**: `review-decision.schema.json` and
  `promotion-record.schema.json` were added because the append-only audit
  model requires the review decision and the promotion result to be separate
  immutable records rather than edits to the gate or run record. Six is the
  current, code-matching count. The Wave A first slice was:
  1. `execution-graph.schema.json` — the authoritative graph (project identity,
     base commit, approval status, provenance, nodes with scope/acceptance/
     adapter fields, append-only transition records).
  2. `worker-result.schema.json` — what a worker reports back.
  3. `gate-record.schema.json` — validation + review gate state.
  4. `run-record.schema.json` — the durable per-run audit record.
  Review/promotion/blocker/sprint/task concerns are carried as *fields within*
  these four (or deferred to later waves), not as separate first-slice schemas.
- **Delivered:** `gorp/specs/runtime/*.schema.json`, JSON Schema 2020-12,
  `additionalProperties: false`, positive + negative fixtures per schema, a
  source-neutral terminology audit test (no provider/legacy terms), validated
  via Ajv 2020 + `ajv-formats` `CODE` `TEST`.
- **Still open from the original M1 (deferred, not Wave A):** refactoring the
  legacy `graph-semantics.md` / `execution-state-machine.md` prose specs to
  source-neutral form (they keep `ADAPTER_SPECIFIC` banners; U6 sequencing
  applies).
- **Non-goals:** claim-leases, multi-node deps, Linear fields, sprint/planning
  schemas.

### M2 — Persisted Execution Graph (Stage 2) — **IMPLEMENTED (Wave A)**
- **Objective:** one approved task persisted as a graph with stable IDs, state,
  payload, provenance, transition history, deterministic resume.
- **Repository:** gorp (`runtime/control/`); storage under the **machine-local
  Gorp state root** (`GORP_STATE_HOME`, default `~/.local/state/gorp`), path
  `projects/<project-id>/graphs/<graph-id>.json`. **Never in a consumer repo.**
- **Delivered:** GraphStore with validate-before-persist, duplicate-ID
  protection, atomic writes (temp + fsync + rename), deterministic
  serialization (sorted keys, byte-identical), single-host lock files; `gorp
  graph create|validate|show|transition` CLI with structured JSON output and
  documented exit codes; enforced transition table (operator owns
  draft→approved; workers rejected as actors; illegal transitions throw with
  no side effect) `CODE` `TEST`.
- **Tests (passing):** create→persist→reload equality; append-only transition
  history; schema rejection; duplicate rejection; >1-node and non-empty-deps
  rejection; atomic-write failure preserves prior state; lock refusal;
  integration proof that no state lands in a fixture repository.
- **Non-goals (still enforced):** multi-node scheduling, dependency resolution.

### M3 — Sandbox (Stage 4)
- **Objective:** Git-worktree isolation; rejected work cannot touch the
  authoritative tree.
- **Repository:** gorp (`runtime/sandbox/`).
- **Inputs:** PRODUCTION-ADAPTER.md §2/§10; scope.yml.
- **Code changes (create):** worktree add on throwaway branch off a clean base
  commit; capture stdout/stderr; teardown policy; retain failure artifacts.
- **Output artifacts:** sandbox handle, captured logs, base-commit record.
- **Tests:** contamination test (out-of-scope write dies with worktree; real tree
  untouched); teardown leaves no worktrees; failure artifacts retained.
- **Pass criteria:** verified isolation + structural discard-on-reject.
- **Dependencies:** M1 (run-record fields).
- **Risks:** dirty base tree. *Mitigation:* require clean base or recorded baseline.
- **Non-goals:** containers, OS sandboxing (rejected in audit; deferred).

### M4 — Fixture Worker (Stage 5)
- **Objective:** deterministic worker proving the loop without AI variability.
- **Repository:** gorp (`runtime/workers/fixture/`).
- **Inputs:** worker contract (CONTRACT.md extended); task payload.
- **Code changes (create):** performs one known scoped mutation (create/modify a
  fixture file); emits a `worker-report.schema.json` report; **modes:** success,
  blocker, validation-failure, out-of-scope.
- **Output artifacts:** the mutation (in sandbox) + structured report.
- **Tests:** each mode produces the correct report + repo effect; report
  validates against schema; conforms to worker contract.
- **Pass criteria:** all four modes reproducible and deterministic.
- **Dependencies:** M1, M3.
- **Risks:** worker doing more than declared scope. *Mitigation:* validation (M5).
- **Non-goals:** any AI/model; any network.

### M5 — Validation (Stage 6)
- **Objective:** deterministic, fail-closed validation **separate** from worker
  self-report.
- **Repository:** gorp (`runtime/validation/`).
- **Inputs:** sandbox diff, scope.yml, quality-gate.sh, worker report.
- **Code changes (create):** changed-file scope check; always-deny check; clean
  patch generation; one required project command (reuse quality-gate); exit
  status; expected-artifact check; repo cleanliness; report schema validation.
- **Output artifacts:** `validation-report` (schema-valid).
- **Tests:** passes on success mode; fails closed on out-of-scope, on
  always-deny, on dirty patch, on missing artifact, on bad command exit.
- **Pass criteria:** validation never trusts the worker's own claim; fails closed
  on any unverifiable condition.
- **Dependencies:** M1, M3, M4.
- **Risks:** conflating validation with review. *Mitigation:* strict separation.
- **Non-goals:** intent/quality judgment (that's review, M7).

### M6 — Minimal Orchestrator (Stage 3)
- **Objective:** single-pass, no-parallelism integrator.
- **Repository:** gorp (`runtime/orchestrator/`).
- **Inputs:** persisted graph (M2), sandbox (M3), fixture worker (M4),
  validation (M5), review (M7), promotion (M8), run record (M9).
- **Code changes (create):** load approved graph → validate readiness → select
  one eligible node → create run → create sandbox → invoke one worker → collect
  report → trigger validation → request review → trigger promotion → update state
  → stop on blocker/failure. **No** parallelism, dynamic spawning, or graph
  rewriting.
- **Output artifacts:** a completed run with state transitions.
- **Tests:** happy path; stop-on-blocker; stop-on-validation-failure;
  stop-on-review-reject; crash-recovery (resume from persisted state).
- **Pass criteria:** one command drives the full loop for one node; every stop
  reason is explicit and recorded.
- **Dependencies:** M2, M3, M4, M5 (and M7/M8/M9 to complete).
- **Risks:** scope creep into scheduling features. *Mitigation:* non-goals below.
- **Non-goals:** queues, concurrency, retries beyond one explicit retry decision,
  multi-node selection.

### M7 — Review Gate (Stage 7)
- **Objective:** smallest explicit human review gate via CLI.
- **Repository:** gorp (`runtime/review/`).
- **Inputs:** validation report + sandbox diff/commit hash.
- **Code changes (create):** CLI presenting the reviewed artifact; decisions
  **approve/reject/request-retry/escalate**; records reviewer, decision, reason,
  timestamp, reviewed commit/patch hash → `review-decision` (schema-valid).
- **Output artifacts:** review-decision record.
- **Tests:** each decision recorded correctly; promotion blocked unless approved;
  hash recorded matches what promotion later verifies.
- **Pass criteria:** no promotion without an approve decision bound to an exact
  artifact hash.
- **Dependencies:** M5.
- **Risks:** building an AI reviewer prematurely. *Mitigation:* human-only now.
- **Non-goals:** automated/AI review; multi-reviewer.

### M8 — Promotion (Stage 8)
- **Objective:** apply the exact reviewed artifact to the target branch; workers
  never promote their own output.
- **Repository:** gorp (`runtime/promotion/`).
- **Inputs:** approved review-decision (with hash), sandbox branch, base commit.
- **Approved first mechanism (binding):**
  1. the worker creates **one sandbox commit**;
  2. review binds to **that exact commit hash**;
  3. promotion verifies the target `HEAD` still matches the recorded base;
  4. promotion verifies the sandbox `HEAD` equals the reviewed hash;
  5. promotion **reruns the required scope checks**;
  6. promotion **cherry-picks** the reviewed commit onto the target branch;
  7. **any conflict or mismatch fails closed**;
  8. **no rebase and no automatic conflict resolution.**
- **Output artifacts:** target-branch commit + an immutable
  `promotion-record` (schema-valid, hash-linked to the approving decision).
  The gate record and run record are never edited (append-only audit).
- **Tests:** promotes only the approved hash; base-drift conflict fails closed;
  tamper (post-review change) rejected; node marked promoted; sandbox cleaned.
- **Pass criteria:** promoted commit is exactly the reviewed artifact; audit links
  review→commit.
- **Dependencies:** M7.
- **Risks:** promotion conflict on moved base. *Mitigation:* explicit conflict stop.
- **Non-goals:** auto-merge policies, multi-branch strategies.

### M9 — Durable Audit Record (Stage 9)
- **Objective:** each run reconstructable end to end.
- **Repository:** gorp (schema, delivered in Wave A as `run-record.schema.json`);
  records under the machine-local state root
  (`$GORP_STATE_HOME/projects/<project-id>/runs/<run-id>/`), **not** in any
  consumer repository.
- **Inputs:** all prior stage outputs.
- **Code changes (create):** assemble run record: run ID, graph+node IDs, task
  input, resolved governance version, base commit, sandbox identity, worker
  adapter, commands executed, stdout/stderr refs, file changes, worker report,
  validation report, review decision, promotion result, timestamps, final status.
- **Output artifacts:** `run-record` (schema-valid) per run.
- **Tests:** record validates; operator can answer "why did this run and how did
  it enter the project" from the record alone.
- **Pass criteria:** completeness check passes for the slice run.
- **Dependencies:** M6, M8.
- **Risks:** secrets in logs. *Mitigation:* scope.yml audit redaction rule.
- **Non-goals:** log aggregation UI, retention policy tuning.

### M10 — Hermes Adapter (Stage 10)
- **Objective:** a Hermes-backed worker conforming to the **same** worker
  contract as the fixture worker — only after M1–M9 pass.
- **Repository:** guava-hermes (adapter) against gorp contract.
- **Inputs:** worker contract; a real scoped task.
- **Code changes (create):** non-interactive Hermes invocation; structured task
  in / structured report out; exit-code reliability; log capture; cancellation;
  model config; memory isolation; skill loading; tool restriction; working-dir
  control; sandbox compatibility.
- **Output artifacts:** Hermes worker adapter + conformance evidence.
- **Tests:** adapter passes the **same** contract test suite the fixture worker
  passes; runs inside the sandbox; honors scope.
- **Pass criteria:** Hermes worker is drop-in for the fixture worker with no
  orchestrator changes. **Gorp is not redesigned around Hermes.**
- **Dependencies:** M1–M9 complete + green.
- **Risks:** Hermes assumptions leaking into core. *Mitigation:* contract tests;
  no gorp-core edits.
- **Non-goals:** Hermes-driven orchestration; model routing.

### M11 — Single-Sprint Pilot (Stage 11)
- **Objective:** one real guava-os sprint through the full loop.
- **Repository:** guava-os (target) + gorp (orchestrator).
- **Inputs:** an approved real sprint (few tasks, still no concurrency).
- **Code changes:** none new; exercise M1–M10.
- **Output artifacts:** final pilot report + run records.
- **Tests:** end-to-end on real work; blocker routing exercised.
- **Pass criteria:** approved→graph→execute→blocker→validate→review→promote→report
  completes; operator observations logged to `improvements/`.
- **Dependencies:** M10.
- **Risks:** real-work variability. *Mitigation:* keep task count tiny.
- **Non-goals:** everything in §4 Excluded.

## 8. Vertical Slice Specification

The exact first task through the new loop. **The first execution proof targets
a disposable Git fixture repository, not guava-os.** (The earlier plan to
write throwaway artifacts into guava-os is withdrawn: guava-os receives only a
*useful* canary, and only after this proof passes.)

### 8.1 Execution proof (disposable fixture repository)

- **Target:** a **disposable Git fixture repository** created for the proof
  (temporary location, e.g. under the OS temp dir or a scratch area), seeded
  with an initial commit, and deleted afterward. No consumer repository is
  involved.
- **Base commit handling:** orchestrator records the fixture repo `HEAD` as the
  base; requires a clean tree; sandbox worktree is created off that base on
  branch `gorp/slice/<run-id>`.
- **Allowed files (scope):** the task-declared fixture path inside the
  disposable repo (e.g. `fixtures/slice/**`).
- **Forbidden files:** everything else, plus the always-deny set.
- **Worker action (fixture, deterministic):** create one file with fixed
  content (`gorp slice ok: <task-id>`), commit it as **one sandbox commit**,
  emit a schema-valid worker result declaring the changed file. Modes also
  exercised: blocker variant, validation-fail variant (malformed content),
  out-of-scope variant (attempts to touch a forbidden path).
- **Required validation:** changed files ⊆ allowed scope; no always-deny match;
  expected artifact exists with exact content; repo otherwise clean; worker
  result and gate record schema-valid. Fail closed on any miss.
- **Review method:** operator CLI (`gorp review`) shows the diff + gate record;
  operator chooses approve/reject/retry/escalate; decision recorded bound to
  the **exact sandbox commit hash**.
- **Promotion method:** the approved M8 mechanism — verify target base
  unchanged, verify sandbox HEAD equals the reviewed hash, rerun scope checks,
  **cherry-pick** the reviewed commit; any conflict or mismatch fails closed;
  no rebase, no automatic conflict resolution.
- **Audit artifacts:** `$GORP_STATE_HOME/projects/<project-id>/runs/<run-id>/`
  containing the run record, worker result, gate record, captured
  stdout/stderr, base+result commit hashes. **No runtime state is written into
  the fixture repository itself beyond the promoted commit.**
- **Rollback behavior:** on reject/failure/out-of-scope/timeout → discard the
  worktree (structural rollback; authoritative tree never touched); write the
  run record with final status and retained failure artifacts; **nothing
  promoted.**

### 8.2 Useful guava-os canary (after 8.1 passes)

Only after the fixture proof is green does `guava-os` receive a canary task —
one small, **genuinely useful** governed change (selected by the operator),
executed through the identical loop. No meaningless artifacts are created in
guava-os. A small real sprint follows the canary. Persona-format
reconciliation is not a prerequisite for 8.1; it is Hermes-adapter preparation
(Stage 10).

## 9. Migration and Deprecation Plan

Disposition verbs in **bold**.

- **Linear-first docs** (`guava-os/CLAUDE.md` execution section,
  `.claude/agents/*`, `.claude/skills/*`, overlay Linear wording): **refactor**
  identity to keep, **retire** the authority claim via `DEPRECATED` banners
  pointing to the Gorp-native model. Remove nothing until the graph exists.
- **Markdown sprint flow** (`templates/gorp/plans/current-sprint.md`,
  consumer `current-sprint.md`): **reuse** as ingestion/export template;
  **retire** authority via `LEGACY` banner; superseded by sprint schema (M1).
- **`dispatch.sh`** (+ `prompts/dispatch.md.tmpl`): **quarantine** now
  (`DEPRECATED` banner; planned use-guard), **extract** dependency-wave +
  journal-status-parse requirements into orchestrator (M6), **remove after** M6
  lands and is green.
- **Duplicated specs** (`guava-os/.gorp/specs/*`, `.gorp/process/*`,
  `.guava-os/specs/*`): **reconcile** vs canonical, **deprecate** (banner +
  reference), **replace** references, **remove after** no path resolves to the
  copy.
- **Old agent directives** (`.claude/agents/*/AGENT.md`): **retire** authority
  (canonical persona = gorp `personas/*`); keep as Claude-Code runtime artifacts
  with `LEGACY` banner. Persona-format reconciliation is **Hermes-adapter
  preparation** (Stage 10 prep), not a fixture-worker prerequisite.
- **Generated files** (`AGENTS.md`, golden fixtures): **reuse**; never hand-edit;
  regenerate from source/generator if a source doc changes.
- **Stale memory** (`.claude/.../ROUTINEME/memory/MEMORY.md`): **retire**; remove
  after operator confirm (U5); no live references found.
- **Existing classifier** (`.guava-os/src/*.ts`): **reuse** as candidate Linear
  **import adapter**; **retire** only the "source of truth" claim; evaluate reuse
  before any deletion.
- **Compatibility requirements:** loader/generator/adapter interfaces, exit
  codes, resolved-context + report schemas must remain stable through M0–M2 so
  existing tests stay green; spec refactors (M1) update generated fixtures in the
  same milestone that changes them.

## 10. Test Strategy

- **Unit:** schema helpers, glob/scope matcher, graph store, report builders.
- **Schema:** every new schema self-validates; example fixtures validate;
  negative fixtures fail.
- **State-transition:** legal/illegal transitions enforced; illegal transitions
  rejected with codes; source-neutral (no Linear terms).
- **Adapter contract:** one suite both fixture worker and Hermes worker must pass
  (M4, M10).
- **Sandbox:** creation/teardown; no leftover worktrees.
- **Contamination:** out-of-scope/always-deny writes never reach the
  authoritative tree; die with the worktree.
- **Promotion:** only the approved hash is promoted; tamper rejected; base
  conflict handled.
- **Crash-recovery:** kill orchestrator mid-run; resume from persisted graph
  reproduces state; no double promotion.
- **End-to-end vertical slice:** the §8 task, all four worker modes, producing a
  complete run record.
- **Regression floor:** existing gorp fixture suites + guava-os 91 vitest tests
  stay green throughout.

## 11. Failure and Recovery Model

*Status note (2026-07-15): rows marked ✓ are implemented as described; rows
marked (target) are future behavior — no timeout, abort command, crash-resume
tooling, or run-start clean-tree check exists yet.*

| Condition | Required behavior |
|---|---|
| Worker failure ✓ | non-zero; capture error; run record `status: failed`; discard worktree; nothing promoted |
| Invalid report ✓ | fail closed (report must schema-validate); treat as worker failure |
| Timeout (target) | stop at limit; treat as failure; still emit changed files + reports |
| Out-of-scope mutation ✓ | validation fails closed; worktree discarded; violation recorded |
| Validation failure ✓ | stop; node → failed; no review, no promotion |
| Review rejection ✓ | immutable decision recorded; node → rejected; **graph → cancelled (terminal)**; sandbox destroyed; nothing promoted (no retry verdict exists) |
| Promotion conflict ✓ (partial) | stop; do not force; abort to pristine target; operator resolves. *Implemented via structured `PROMOTION_CONFLICT` error output; no separate conflict record file is written (no mutation on failure).* |
| Operator abort (target) | stop cleanly at next safe point; discard sandbox; record aborted status |
| Orchestrator crash (target: resume) | persisted graph is the recovery source; no partial promotion (promotion is all-or-nothing ✓); a deterministic resume command does not exist yet |
| Stale graph ✓ (at promote) | detect base drift vs recorded base commit; promotion refuses an incompatible base |
| Dirty repository ✓ (at promote only) | promotion requires a clean target tree; `gorp run` does not check the target tree (the sandbox is created from the committed base) |

## 12. Review Checkpoints (gates between milestones)

- **G0→1:** docs reconciled; all suites green; repos clean except intended docs.
- **G1→2:** every slice artifact has a source-neutral schema; no Linear terms in
  canonical specs except labeled adapter notes.
- **G2→3/4/5/6:** graph persists + resumes deterministically.
- **G(4,5,6)→3:** sandbox isolation, fixture worker modes, and fail-closed
  validation each pass independently.
- **G3→7:** orchestrator drives worker→validation in one pass and stops correctly.
- **G7→8:** no promotion possible without an approve decision bound to a hash.
- **G8→9:** promoted commit == reviewed artifact; sandbox cleaned.
- **G9→10 (LAUNCH GATE for slice):** §15 evidence complete.
- **G10→11:** Hermes worker passes the identical contract suite; no gorp-core
  change.

## 13. Agent Task Breakdown (for future implementation agents)

No overlapping ownership. Each future agent operates under a Gorp persona/scope.

| Agent | Mission | Repository | Inputs | Output artifacts | Guardrails | Tests | Pass criteria |
|---|---|---|---|---|---|---|---|
| SCHEMA-AGENT | ~~Author source-neutral schemas (M1)~~ **DONE (Wave A: 4 schemas)**; remaining: refactor legacy Linear prose specs | gorp `specs/runtime/` | authority map, existing schemas | 4 schemas + fixtures (delivered) | no Linear fields; JSON-Schema 2020-12 | schema self-validate + negatives + terminology audit (green) | G1→2 ✓ |
| GRAPH-AGENT | ~~Persisted graph store + `graph` CLI (M2)~~ **DONE (Wave A)** | gorp `runtime/control/`; storage under `GORP_STATE_HOME` | M1 schemas | graph store, CLI, tests (delivered) | deterministic; append-only history | create/reload/transition suite (green) | G2→ ✓ |
| SANDBOX-AGENT | Worktree sandbox (M3) | gorp `runtime/sandbox/` | PRODUCTION-ADAPTER | sandbox lib | never touch authoritative tree | contamination/teardown | isolation proven |
| WORKER-AGENT | Fixture worker, 4 modes (M4) | gorp `runtime/workers/fixture/` | worker contract | fixture worker + reports | scope-only; deterministic; no AI | per-mode tests | modes reproducible |
| VALIDATION-AGENT | Deterministic validation (M5) | gorp `runtime/validation/` | scope.yml, quality-gate | validation lib + report | fail-closed; independent of worker claim | pass/fail-closed suite | never trusts worker |
| ORCH-AGENT | Single-pass orchestrator (M6) | gorp `runtime/orchestrator/` | M2–M5,7,8,9 | orchestrator | no parallelism/spawn/rewrite | happy+all stops+recovery | one-command loop |
| REVIEW-AGENT | CLI review gate (M7) | gorp `runtime/review/` | validation report + hash | review CLI + decision record | human-only; hash-bound | decision + block tests | no unreviewed promote |
| PROMOTION-AGENT | Scoped promotion (M8) | gorp `runtime/promotion/` | approved decision | promotion + record | worker never self-promotes; all-or-nothing | tamper/conflict tests | reviewed==promoted |
| AUDIT-AGENT | Run record assembly (M9) | gorp schema; guava-os runs | all outputs | run records | no secrets; complete | completeness test | reconstructable |
| HERMES-ADAPTER-AGENT | Hermes worker (M10) | guava-hermes | worker contract | Hermes adapter | conform to contract; no gorp-core edits | shared contract suite | drop-in for fixture |

## 14. Risks (ranked)

| # | Risk | Launch prob. | Impact | Detectability | Mitigation |
|---|---|---|---|---|---|
| R1 | Spec refactor desyncs generated fixtures/tests (U6) | med | high | high (tests fail) | refactor spec + fixtures in the same milestone; banner-first in M0 |
| R2 | Scope creep in orchestrator (queues/concurrency) | high | med | med | hard non-goals in M6; single-node only |
| R3 | Validation/review conflation → worker self-approval | med | high | med | strict separation; validation never reads worker verdict; review hash-bound |
| R4 | Promotion applies un-reviewed changes | low | high | high | verify reviewed hash == artifact before apply |
| R5 | Sandbox contamination of authoritative tree | low | high | high | worktree isolation + contamination test + discard-on-reject |
| R6 | ~~Graph storage location coupling (U4)~~ **RESOLVED** — machine-local state root, `GORP_STATE_HOME` override | — | — | — | implemented in Wave A |
| R7 | Hermes assumptions leak into gorp core | med | high | med | contract tests; adapter in guava-hermes only; M10 last |
| R8 | Orchestrator crash leaves half-promoted state | low | high | med | all-or-nothing promotion; resume from persisted graph |
| R9 | Persona-format ambiguity delays the Hermes adapter (M10) | med | low | high | re-scoped: fixture worker (M4) uses no persona; resolve during Hermes-adapter preparation |
| R10 | Observability invariant violated by adapters (audit §A2) | med | med | high | Stage 6 separates observe vs mutate; adapter journal write reclassified |

## 15. Final Launch Gate (evidence to call the slice complete)

All required, with artifacts:
1. A **persisted graph** file for the slice task with stable IDs + transition
   history; reload + resume reproduce state. `TEST`
2. A **sandbox** run proving out-of-scope + always-deny writes never reached the
   authoritative `guava-os` tree (contamination test green). `TEST`
3. The **fixture worker** produced the exact expected mutation and a schema-valid
   report; all four modes reproducible. `TEST`
4. **Validation** passed on success and **failed closed** on out-of-scope,
   always-deny, dirty-patch, missing-artifact, bad-exit. `TEST`
5. A recorded **review decision** (approve) bound to the exact sandbox commit
   hash; promotion provably impossible without it. `TEST`
6. A **promotion** commit on the guava-os target branch that is byte-identical to
   the reviewed artifact; sandbox cleaned. `TEST`
7. A complete **run record** from which the operator reconstructs *why it ran*
   and *how it entered the project*. `TEST`
8. All existing gorp + guava-os tests still green; all three repos clean except
   intended, committed changes. `TEST`
9. No Hermes dependency was required to reach 1–8 (Hermes is Stage 10). `INFERENCE`

Only when 1–9 hold is the first governed execution loop complete. Hermes
integration (M10) and the single-sprint pilot (M11) follow.

---

*End of roadmap. Status 2026-07-15 (post-Waves A–E):*

| Stage | Status |
|---|---|
| 0 authority cleanup | **done** (Wave A closeout) |
| 1 canonical schemas | **done** — seven schemas (4 Wave A + 2 Wave D + `sprint` in the final sprint); legacy Linear prose specs still to be refactored (U6 open) |
| 2 persisted graph | **done** (Wave A) |
| 3 minimal orchestrator | **done (Sprint 3A, 2026-07-16)** — `gorp orchestrate`: a single-process, single-graph scheduler loop over the public CLI only (imports nothing from the runtime; every action is a subprocess). Finds the next eligible node in document order, runs, approves via the read-only review output, promotes, repeats, completes the graph when all nodes are terminal; stops with machine state (`ORCHESTRATION_STOPPED`, exit 19) on reject/failed/interrupted-run/blocked/wedge. Crash-safe by construction: each step re-discovers all state (proven with fresh maxSteps=1 instances converging with zero repeated work) and deterministic across isolated worlds. Prerequisites delivered by Sprint 2A refactors + invariant guards. Deliberately absent (later): retries policy, blocker routing, human review policy (it auto-approves gate-passed nodes), multi-graph/concurrency |
| 4 sandbox (worktree) | **done** (Wave B) |
| 5 fixture worker | **done** (Wave B; success mode + failure via scope; no dedicated blocker mode) |
| 6 validation | **done for the slice (Sprints 3C+3D)** — scope gate + structured project command checks (`{executable, args[], timeoutMs?}`; no shell, no whitespace splitting; exit/stdout/stderr/duration captured into the chained gate record; per-command timeouts killed + recorded fail-closed). **Promotion re-runs the full gate against the reviewed commit — no stale gate.** Remaining: artifact-content checks |
| 7 review gate | **done for approve/reject** (Wave D: CLI, immutable hash-bound decision; reject closes the graph as `cancelled`); the M7 `request-retry`/`escalate` verdicts are **not implemented** |
| 8 promotion | **done** (Waves C+D + Sprint 3D: fail-closed cherry-pick of the approved commit only, after a full live gate rerun — scope + all project commands must pass again; failures keep sandbox/records/approval and block with evidence) |
| 9 durable audit record | **done** (run record + hash-chained records + `gorp inspect`; **no external anchor** — integrity evidence, not a security boundary) |
| planner (final sprint) | **done** — `gorp plan`: approved sprint doc → deterministic draft graph; fail-closed rejection of bad sprints; sprint→plan→approve→orchestrate proven end-to-end by test |
| 10 Hermes adapter | **adapter implemented (Sprint 4A)** — async `WorkerAdapter` spawning `GORP_HERMES_CMD` (task JSON in, verdict JSON out, adapter owns the single sandbox commit; fail closed on bad output/timeout/cancel/git-touching/no-changes; same contract boundary as the fixture worker; human review always required). Remaining: the real Hermes wrapper script in guava-hermes + a first real hermes-run against a project |
| 11 single-sprint pilot | **canary done (Sprint 3E, 2026-07-17)** — guava-os received its first real governed change end-to-end: operator-approved graph → `gorp orchestrate` → fixture worker in an isolated worktree → real gates (`npm ci`, `npx vitest run` 91/91, `npx tsc -p .guava-os --noEmit`) passed at run AND promotion → cherry-picked as guava-os commit `4675064` (docs/governance/first-governed-change.md) → graph completed; audit chain valid; rerun is a clean no-op. (Preceded by one operator maintenance commit `8b6133c` adding @types/node — guava-os's typecheck had never actually been green.) The single-sprint pilot itself is next |

## Status addendum (2026-07-25)

Everything below this point in the table above is superseded by events:

- **Sprint 5A (2026-07-20):** retry review verdict (immutable, per-run;
  node returns to pending, new attempt-scoped run ids `run-<attempt>`),
  projectId-only execution state (paths resolve from `registry/projects.yml`
  at command time; lazy migration of legacy graphs; `PROJECT_NOT_REGISTERED`
  exit 20), enriched worker-result contract (`summary` required at the
  adapter boundary, `expectedFiles`, `reviewerNotes`). 161 vitest tests.
- **First real governed Hermes sprint (2026-07-20):** `guava-os-real-1` —
  two hermes nodes with a dependency, one live retry on a fabricated-content
  attempt, both promoted into guava-os (`e40a054`, `42d1fde`), chains valid.
  Stage 10/11 of the table are therefore DONE in their first real form.
- **Operator surfaces (guava-hermes, Sprints 1.1–1.3, 2026-07-21→23):**
  browser Operator Shell (SvelteKit; inbox/compose/sprint/review/audit,
  acknowledge/close, failure cards, review notifications, project switch)
  as the PRIMARY surface; `gorp-op` thin client + optional Hermes console
  share the same `lib/gorp-client.mjs`. ~14 operator sprints run through it
  against guava-os and guava-hermes (docs-alignment work), including organic
  failures, a reject, and base-drift wedges.
- **Known contract gaps (evidence-backed, unfixed):** retry attempts run
  blind (decision reason never reaches the worker); gate-misconfig is
  indistinguishable from bad work (good output discarded); an approved node
  wedges permanently on base drift (only exit: operator cancel); worker
  commit subjects are full objectives (log hygiene); audit chain still has
  no external anchor.
- **Sprint 2.1 (2026-07-25, "failure semantics"):** every `gorp orchestrate`
  now persists `started`/`ended` events to an append-only per-graph
  invocation log under the state root; new read command
  `gorp orchestrate-status` folds it (running / completed / stopped+reason+
  evidence / presumed-crashed via pid liveness). A detached orchestrate is
  never silent again — closes the top Sprint 1.4 backlog item (stop reasons
  invisible in the Shell, proven three times in real operation). The
  Operator Shell renders every stop as a what/why/next card and gates the
  Start button on KNOWN orchestrator liveness. `GATE_FAILED` error message
  now names the failing checks. 169 vitest tests (8 new). Five failure
  scenarios dogfooded through the Shell against a scratch project: gate
  fail, dirty tree, base drift, worker fail, SIGKILL crash + interrupted
  run.

*The §8.1 fixture-repository execution proof is exercised end-to-end by the
runtime test suite (disposable repos, compiled CLI). Remaining before Hermes:
useful guava-os canary, richer gate (project commands), retry/recovery
tooling, external audit anchor — see `reference/history/CURRENT-REALITY-AUDIT.md` §7.*
