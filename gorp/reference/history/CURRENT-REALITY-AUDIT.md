# Current Reality Audit

**Status: `CURRENT` — active operational reference.**
Rewritten 2026-07-14 during the Wave A closeout; updated 2026-07-15 after
Waves B–D (execution, review decisions, promotion, audit) and the Wave E
architecture-fix pass. All superseded findings have been corrected inline;
this document is internally consistent and requires no amendment section to
interpret. The original audit (2026-07 pre-reconciliation, including its
amendment history A1–A4) is preserved verbatim for provenance at
`CURRENT-REALITY-AUDIT-original.md`.

Evidence labels: `CODE` = executable behavior read/observed; `TEST` = a test or
test run; `DOC` = documentation/spec claim; `INFERENCE` = reasoned conclusion.

---

## 1. System Shape

There are **three repositories**:

| Repository | Role |
|---|---|
| `~/dev/gorp` | **Governance and control-plane authority.** Doctrine, personas, scope policy, specs, registry, context loader/generator/deployer, the simulated local adapter, and (new) the Wave A TypeScript control runtime. |
| `~/dev/repos/guava-hermes` | **Replaceable Hermes integration and operator entry point.** A near-empty consumer today. Its future role is a Hermes-backed worker/runtime adapter conforming to the Gorp worker contract, plus Guava-specific operator workflows. It does **not** own orchestration, the execution model, or global governance. Hermes is replaceable and is **not part of Wave A**. |
| `~/dev/repos/guava-os` | **First governed project consumer.** A registered Gorp consumer plus a standalone read-only TypeScript classifier CLI (`.guava-os/`). It will receive a **useful canary task only after** the disposable-fixture execution proof succeeds. |

Authority decisions (binding, operator-approved):

- **Gorp-native persisted graph state is authoritative** during a run. The
  execution graph is the single source of execution truth.
- **Linear is deprecated as execution authority.** It is at most a legacy or
  optional import/reporting adapter.
- **Markdown sprint tables are non-authoritative** legacy/adapter
  representations (ingestion/export only).
- **Runtime state is machine-local and lives outside consumer repositories**:
  default `~/.local/state/gorp`, overridable via `GORP_STATE_HOME`.
- **The Gorp control runtime is TypeScript.** Shell is limited to
  operating-system boundaries. Existing Ruby/shell tools remain supported but
  are not expanded into the control plane.
- **Workers never transition graph state or modify graph topology.** Only
  operator / orchestrator / system actors may transition state; the runtime
  rejects `worker` as an actor `CODE` `TEST`.
- Execution begins from an **operator-approved graph**. Since the final
  sprint (2026-07-17) a **planner exists**: `gorp plan` deterministically
  maps an operator-approved sprint document to a draft graph (fail-closed on
  cycles, unknown deps, unregistered workers, capability lies). Decomposing
  goals into sprints remains human work; the planner executes and approves
  nothing.
- Persona-format reconciliation does **not** block the deterministic fixture
  worker; it is Hermes-adapter preparation.

---

## 2. What Exists and Works Today

### 2.1 TypeScript control runtime (Waves A–D — implemented and verified)

Location: `gorp/runtime/control/` (runtime), `gorp/specs/runtime/` (contracts).
The **full single-task control loop is implemented**: create → approve graph →
run → review → approve/reject → promote → inspect.

- **Six runtime schemas exist** (JSON Schema 2020-12,
  `additionalProperties: false`, source-neutral): the Wave A first contract
  set (`execution-graph`, `worker-result`, `gate-record`, `run-record`) plus
  the Wave D decision/promotion records (`review-decision`,
  `promotion-record`) `CODE` `TEST`. The Wave A "exactly four schemas"
  decision applied to the *first slice*; Wave D added two because the
  append-only audit model requires the review decision and the promotion
  result to be **separate immutable records**, not edits to the gate or run
  record — plus the `sprint` planning contract (final sprint). Docs and
  code agree on seven.
- **Wave A — graph authority** (`gorp graph create | validate | show |
  transition`) `CODE` `TEST`: persisted, schema-validated execution graph
  under `$GORP_STATE_HOME/projects/<project-id>/graphs/<graph-id>.json`;
  atomic writes, deterministic serialization, duplicate-ID protection,
  single-host lock; explicit operator approval transition; append-only
  transition history; illegal transitions and unauthorized actors (including
  `worker`) fail with structured errors and no persistence side effect;
  single-node graphs with empty `dependencies` only.
- **Wave B — execution** (`gorp run`, `gorp review`) `CODE` `TEST`: approved
  graph → git-worktree sandbox (under the state root, branch
  `gorp/run/<run-id>`) → deterministic fixture worker (one sandbox commit;
  no graph-store access) → schema-validated worker result → scope gate
  (changed files computed from git, allowed/forbidden paths, sandbox-clean)
  → gate record with `artifactHash` = sandbox HEAD → node `awaiting_review`.
  Failure destroys the sandbox and marks node+graph `failed`; evidence
  records are retained. `gorp review` is read-only.
- **Wave D — review decisions** (`gorp approve | reject`) `CODE` `TEST`: one
  terminal immutable decision per run, bound by hash to the exact gate
  reviewed and artifact judged. Approve requires the operator to restate the
  reviewed commit. Reject moves the node to `rejected`, **closes the graph as
  `cancelled`** (terminal — no graph is left `running` after a rejection),
  and destroys the sandbox.
- **Waves C+D — promotion** (`gorp promote`) `CODE` `TEST`: requires an
  approved decision; verifies chain integrity, decision→gate→artifact hash
  bindings, base commit unmoved, clean target, live scope-gate rerun — all
  before any mutation; then cherry-picks exactly the reviewed commit (no
  rebase, no merge, no conflict resolution; conflicts abort to a pristine
  tree); writes an immutable promotion record; node `promoted`, graph
  `completed`; sandbox removed.
- **Wave D — audit** (`gorp inspect`) `CODE` `TEST`: one read-only command
  assembling graph/node state, full transition history, all records, control
  decisions, timestamps, errors, and the audit-chain verdict. Every persisted
  record is hashed into an append-only `audit-chain.jsonl`.
  **Exact chain guarantee:** detects any record edit/deletion or chain-line
  edit *not accompanied by a consistent rewrite of the whole chain*; there is
  **no external anchor** (no signing key, no remote timestamp), so a local
  actor who regenerates the entire chain is not detectable — integrity
  evidence, not a security boundary `CODE` `DOC`.
- Stack: TypeScript (strict, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`), Node.js, Vitest, Ajv 2020 + `ajv-formats`,
  compiled CLI from `dist/`; injected clock everywhere (no wall-clock in
  persisted state).
- Verified 2026-07-15: strict typecheck clean, build clean, **95/95 Vitest
  tests pass**, including compiled-CLI end-to-end (run → approve → promote →
  inspect), reject path, tamper/chain-break detection, and the state-boundary
  proof (no runtime state in any consumer working tree) `TEST`.

### 2.2 Governance/context pipeline (pre-existing, still green)

- `resolve-context.sh` → `generate-agents-md.sh` → `deploy-agents-md.sh`
  deterministically turns bindings + persona into a governed, schema-validated
  `AGENTS.md`; fail-closed on missing input, version mismatch, or unresolved
  placeholders `CODE` `TEST`.
- Regression suites (all passing 2026-07-14): loader 8/8, generator 4/4
  (byte-identical golden fixtures for both consumers), local adapter 4/4,
  `validate-gorp.sh` default and `--registry` all green `TEST`.
- **The aggregate validator is side-effect free.** Re-verified: running
  `validate-gorp.sh` (canonical, `--consumer`, `--registry`) does not modify
  the working tree `TEST`. An earlier claim that the validator caused a
  `routineme` registry edit was **wrong** — that edit was a pre-existing
  uncommitted working-tree change of unknown provenance, not a validator side
  effect (see the archived original, §A2, for the full correction trail).
- **The simulated local adapter is the real side-effect holder:** invoking
  `runtime/adapters/local/run.sh` against a consumer **mutates the consumer
  tree** by writing `.gorp/journal/<persona>-<date>.md` `CODE` `TEST`. A
  command framed as a "no-op check" is therefore not observation-only.
  Recorded invariant (remediation scheduled in the roadmap, not Wave A):
  *validation commands must be observational and side-effect free unless
  mutation is explicitly requested.*

### 2.3 guava-os classifier (pre-existing, still green)

A read-only TypeScript CLI that classifies pre-fetched Linear issue JSON into
an in-memory graph and emits launch directives. It never calls Linear, git, or
mutates the filesystem `CODE` `TEST`. **91/91 tests pass** (2026-07-14).
Under the approved architecture it is a candidate **Linear import adapter**,
not an execution authority.

---

## 3. What Remains Unimplemented

The following do not exist as code and are later work:

- **Hermes worker adapter** — the fixture worker is the only adapter; any
  other `workerAdapter` fails closed as `NOT_IMPLEMENTED`. Hermes remains a
  replaceable adapter conforming to the same worker contract (roadmap
  Stage 10).
- **Orchestration beyond the single pass** — `gorp run` is one synchronous
  pass over one node: no scheduling, no queues, no blocker routing, no
  retries, no multi-node selection, no crash-resume command. Orchestration
  contracts and authoritative state are owned by **Gorp**; guava-hermes may
  later *invoke* orchestration — it does not own it.
- **Richer validation gates** — the gate is scope-only (allowed/forbidden
  paths, sandbox-clean); no project commands (tests/build), no
  artifact-content checks.
- **Multi-node graphs / dependencies / concurrency** — the runtime enforces
  single-node, empty-dependency graphs; single-process local locking only.
- **Review verdicts beyond approve/reject** — no retry-requested or escalate;
  decisions are terminal.
- **Recovery tooling** — a blocked/conflicted promotion, stale lock, or
  orphaned worktree is resolved manually.
- **External audit anchor** — the audit chain has no signing key or remote
  timestamp; adding one is open work (see §2.1 for the exact guarantee).
- **Goal-to-sprint decomposition** — human work; the planner only maps an
  already-authored, operator-approved sprint document to a graph.
- **Useful guava-os canary / real sprint** — the execution proof so far runs
  against disposable fixture repositories (in the test suite); no governed
  change has been promoted into guava-os yet.

---

## 4. Execution Proof Sequence (approved)

1. **Disposable Git fixture repository** — the first execution proof runs the
   deterministic fixture worker against a throwaway repo. It creates no
   artifacts in any consumer. *Status: proven — the Waves B–D test suite
   drives the full loop (run → approve → promote → inspect) against
   disposable fixture repositories, end-to-end through the compiled CLI
   `TEST`. An operator-driven proof outside the test harness is a cheap
   optional re-confirmation.*
2. **Useful guava-os canary** — only after the fixture proof succeeds does
   guava-os receive a canary task, and it must be a *useful* one (no
   meaningless artifacts written into guava-os).
3. **Small real sprint** — after the canary.

Persona-format reconciliation does not gate step 1; it belongs to
Hermes-adapter preparation.

---

## 5. Governance and Bypass Reality

Material findings (updated after Waves B–D):

- Enforced, fail-closed controls exist at **context-resolution time** (binding
  presence, doctrine version match, persona/scope presence, schema validation,
  placeholder failure), at **graph-persistence time** (schema validation
  before persist, transition legality, actor authorization), and now at
  **execution time within the governed path**: the worker runs only in an
  isolated worktree, its changes must pass the scope gate to reach review,
  and only an approved, hash-bound decision can be promoted `CODE` `TEST`.
- Enforcement outside the governed path remains absent: any human or agent
  can still edit a consumer repo directly with ordinary tools; nothing
  intercepts it. Governance becomes structural only when the sandbox +
  promotion path is the only write path `INFERENCE`.
- The governed context path (AGENTS.md generation/deploy) and the governed
  execution path (promotion of a reviewed commit) are the only governed
  writes; the runtime adds **no** runtime state to any consumer working tree
  `TEST` (git-native branch/worktree metadata in the consumer's `.git` during
  a run is the sole footprint, removed on failure/rejection/promotion).
- Scope enforcement in the legacy simulated adapter is post-hoc git-diff
  detection, not prevention. In the Wave B+ runtime, out-of-scope work dies
  with the sandbox and never reaches the consumer tree.

---

## 6. Documentation Authority

- Canonical classification lives in `DOCUMENTATION-AUTHORITY-MAP.md`
  (alongside this file), using the labels `CURRENT` / `TARGET` / `PROPOSAL` /
  `LEGACY` / `DEPRECATED` / `ADAPTER_SPECIFIC` / `DUPLICATE` / `GENERATED` /
  `STALE`.
- Linear-coupled canonical specs (`gorp/specs/graph-semantics.md`,
  `execution-state-machine.md`, `claim-leases.md`,
  `execution-report-contract.md`) are labeled `ADAPTER_SPECIFIC`/`LEGACY` and
  are refactor sources for source-neutral successors — their normative bodies
  are retained because fixtures and tests still reference them.
- Duplicated consumer copies (`guava-os/.gorp/specs/*`, `.gorp/process/*`)
  are labeled `DUPLICATE — DEPRECATED` and are **not deleted immediately**:
  removal happens only after references are repointed and no doc/code path
  resolves to the copy (disposition-based, not immediate deletion).
- Generated artifacts (`AGENTS.md` in consumers) are never hand-edited; they
  are regenerated by the Gorp generator and verified byte-identical against
  golden fixtures `TEST`.
- The stale `guava-os/.claude/projects/-Users-sebastianrodriguez-Projects-ROUTINEME/memory/MEMORY.md`
  is labeled `STALE` and retained: it is unverified against external local
  Claude state, so deletion is deferred pending operator confirmation.

---

## 7. Top Remaining Gaps (post-Waves A–E, before Hermes)

1. **No Hermes worker adapter** — the fixture worker is the only adapter. The
   Hermes adapter (roadmap Stage 10) must conform to the same worker contract
   and pass the same suite the fixture worker passes.
2. **~~No useful guava-os canary yet~~ — DONE (2026-07-17):** guava-os
   commit `4675064` (docs/governance/first-governed-change.md, an in-repo
   provenance attestation) landed through the full governed loop — approved
   graph, fixture worker in an isolated worktree, real gates (npm ci, vitest
   91/91, tsc) at run and promotion, hash-chained audit under
   `~/.local/state/gorp/projects/guava-os/`. Next: the small real sprint.
3. **Gate is scope-only** — no project command (tests/build) runs in the
   gate; a worker could produce in-scope but broken changes that review must
   catch by eye.
4. **Single-pass orchestration only** — no retries, blocker routing,
   crash-resume tooling, or multi-node scheduling; single-node graphs with
   empty dependencies.
5. **Governance outside the governed path is still advisory** — direct edits
   to consumers bypass everything; structural only when the governed path is
   the only write path.
6. **Audit chain lacks an external anchor** — integrity evidence against
   naive edits only; a signing key or remote timestamp is open work.

---

*This audit reflects verified state as of 2026-07-15 (post-Wave E
architecture fixes). For the target architecture and staged plan, see
`ROADMAP.md`. For the Wave A verification evidence, see
`WAVE-A-COMPLETION-REPORT.md` (historical snapshot of that wave).*
