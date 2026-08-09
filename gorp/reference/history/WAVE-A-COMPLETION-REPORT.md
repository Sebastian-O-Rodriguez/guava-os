# Wave A Completion Report

Produced 2026-07-14 at the Sprint 1 / Wave A closeout. Companion documents:
`CURRENT-REALITY-AUDIT.md` (clean current reference; original archived at
`CURRENT-REALITY-AUDIT-original.md`) and `ROADMAP.md`.

## 1. Verdict

**PASS.**

All Wave A verification gates are green: strict typecheck, build, 58/58 Wave A
Vitest tests (including the schema terminology audit and the state-boundary
integration test), all existing Gorp regression suites (loader 8/8, generator
4/4 with byte-identical golden AGENTS.md fixtures, local adapter 4/4, aggregate
and registry validators), guava-os 91/91, CLI evidence captured with correct
exit codes, state boundary proven, documentation reconciled, all three
repositories committed and clean. The only open findings are development-only
dependency advisories in the vitest chain (section 9) and deliberately deferred
items recorded as deviations (section 10) — none blocks Wave A.

## 2. Built Capabilities (verified executable)

- **Four canonical runtime contract schemas** at `gorp/specs/runtime/`
  (`execution-graph`, `worker-result`, `gate-record`, `run-record`), JSON
  Schema 2020-12, `additionalProperties: false`, positive + negative fixtures,
  source-neutral terminology enforced by test.
- **Persisted execution graph store** (`gorp/runtime/control/`):
  validate-before-persist, duplicate-ID protection, atomic writes (temp file +
  fsync + rename; prior state survives failure — tested), deterministic
  byte-identical serialization, single-host lock files.
- **Enforced state model:** transition tables for graph and node states;
  actors limited to `operator`/`orchestrator`/`system`; `worker` rejected;
  operator owns `draft → approved`; illegal transitions throw structured
  errors with no persistence side effect; transition history is append-only.
- **CLI:** `gorp graph create | validate | show | transition` with structured
  JSON output and distinct documented exit codes; `gorp run | review |
  promote | inspect` fail explicitly with `NOT_IMPLEMENTED` (exit 69, no
  mutation).
- **Machine-local state root:** default `~/.local/state/gorp`, override
  `GORP_STATE_HOME`; layout
  `<stateHome>/projects/<project-id>/graphs/<graph-id>.json`.

## 3. Explicitly Unbuilt (Wave B/C and later)

Execution (`run`), sandbox/worktree isolation, workers (fixture and Hermes),
validation gates, review, promotion, durable assembled run records, audit
assembly, orchestration, blocker resolution, Hermes integration, planning,
sprint decomposition, multi-node graphs, dependency resolution, concurrency,
distributed locking. The simulated local adapter remains a journal-only
simulation and still mutates the consumer tree when invoked (recorded
invariant; remediation is roadmap Stage 6, not Wave A).

## 4. Architecture Decisions Implemented

- **TypeScript control runtime** (strict config: `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, etc.); shell only at OS boundaries.
- **Exactly four schemas** in the first contract set (eleven-schema plan
  withdrawn).
- **Machine-local state root** (`~/.local/state/gorp` / `GORP_STATE_HOME`);
  runtime state never in consumer repositories.
- **Graph authority:** the persisted execution graph is authoritative during a
  run; `graph create` always forces draft/unapproved; approval only via
  explicit transition.
- **Actor restrictions:** workers can never transition graph state or modify
  topology (enforced and tested).
- **Atomic persistence** with deterministic serialization and lock protection.
- **Single-node limitation:** exactly one node, empty dependencies
  (`UNSUPPORTED_GRAPH_SHAPE` otherwise).
- **CLI surface:** four implemented graph commands + four explicit Wave B/C
  placeholders; machine-readable JSON everywhere.

## 5. Files Changed

### gorp (`/Users/sebroot/dev/gorp`)

**Wave A runtime (commit `6e05d8e`):**
- `runtime/control/src/**` — cli (main, output), config, contracts
  (types, validator), errors, graph, state/transitions, storage
  (graph-store, serialize)
- `runtime/control/tests/**` — cli, contracts, graph-store, integration,
  transitions (58 tests)
- `runtime/control/fixtures/**` — positive/negative fixtures for all four
  schemas
- `runtime/control/{package.json,package-lock.json,tsconfig.json,vitest.config.ts}`
- `specs/runtime/{execution-graph,worker-result,gate-record,run-record}.schema.json`

**Wave A closeout additions (same commit):**
- `runtime/control/README.md` — operator/developer documentation (new)
- `runtime/control/.gitignore` — ignores `dist/`, `node_modules/`,
  `*.tsbuildinfo` (new; previously exclusion depended on the user-global
  gitignore only)

**Documentation closeout (commit `a916321`):**
- Prior reconciliation banners (pre-existing working-tree work, now
  committed): `README.md`, `improvements/roadmap/HERMES-BOOTSTRAP.md`,
  `playbooks/dispatch.sh`, `reference/architecture.md`,
  `specs/execution-state-machine.md`, `specs/graph-semantics.md`,
  `templates/gorp/plans/current-sprint.md`
- New closeout labels: `reference/kit-readme.md` (LEGACY),
  `reference/directory-structure.md` (LEGACY), `specs/claim-leases.md`
  (ADAPTER_SPECIFIC/LEGACY), `specs/execution-report-contract.md`
  (ADAPTER_SPECIFIC/PROPOSAL), `specs/violation-codes.md`
  (ADAPTER_SPECIFIC/LEGACY),
  `improvements/proposals/{doctor-local-only-proposal,mutation-journal}.md`
  (PROPOSAL)
- `README.md` — new "Wave A control runtime" section pointing at
  `runtime/control/README.md`; label vocabulary extended

### guava-hermes (commit `c4d5322`)
- `README.md` — role-clarification banner (prior reconciliation work,
  committed unchanged)

### guava-os (commit `13c9f1f`)
- Prior reconciliation banners (committed): `.claude/agents/robo/AGENT.md`,
  `.gorp/process/agent-protocol.md`,
  `.gorp/specs/{claim-leases,execution-state-machine,graph-semantics,violation-codes}.md`,
  `CLAUDE.md`
- New closeout labels:
  `.claude/agents/{architect,backend,frontend,qa}/AGENT.md`
  (LEGACY/ADAPTER_SPECIFIC),
  `.claude/skills/{dispatch,handoff,sprint}/SKILL.md` (LEGACY/DEPRECATED),
  `.claude/skills/verify/SKILL.md` (CURRENT/ADAPTER_SPECIFIC),
  `.gorp/process/{approval-matrix,conventions}.md` (DUPLICATE — DEPRECATED),
  `.guava-os/specs/*` (5 files, PROPOSAL; execution-report-contract also
  DUPLICATE), `.guava-os/docs/*` (9 files, CURRENT/ADAPTER_SPECIFIC),
  `.claude/projects/-Users-sebastianrodriguez-Projects-ROUTINEME/memory/MEMORY.md`
  (STALE — retained, see section 10)

### External planning artifacts (not in any git repository)
- `CURRENT-REALITY-AUDIT.md` — rewritten as the clean current reference
- `CURRENT-REALITY-AUDIT-original.md` — verbatim original preserved
  (sha1 `493e06071ab76371eb7b3a0433f6be9d809b1613`, identical to the
  pre-rewrite file)
- `ROADMAP.md` — updated per the closeout directive
- `WAVE-A-COMPLETION-REPORT.md` — this report
- `DOCUMENTATION-AUTHORITY-MAP.md`, `RECONCILIATION-CHANGE-REPORT.md` —
  untouched

## 6. CLI Evidence

Environment: `GORP_STATE_HOME` pointed at a scratch state root; a disposable
git fixture repository with one commit (base
`e68228ccf464535b063339fc3ce277caa83aec0e`); compiled CLI
(`node dist/cli/main.js`).

| Command | Exit | Result |
|---|---|---|
| `graph create --graph-id wave-a-proof-001 --project-id fixture-proof --repo <fixture> --base-commit <sha> --objective "closeout evidence"` | 0 | persisted at `<stateHome>/projects/fixture-proof/graphs/wave-a-proof-001.json`, `status: draft`, `approvalStatus: unapproved` |
| `graph validate --project-id fixture-proof --graph-id wave-a-proof-001` | 0 | `{"valid": true}` |
| `graph show …` | 0 | full graph document returned |
| `graph transition … --to approved --actor-type operator --reason-code OPERATOR_APPROVAL` | 0 | `from: draft, to: approved, approvalStatus: approved, transitionId: graph-draft-approved-0001` |
| `graph transition … --to completed --actor-type operator` (illegal) | 7 | `ILLEGAL_STATE_TRANSITION`, `reason: no_such_transition`, nothing persisted |
| `graph transition … --to running --actor-type worker` | 7 | `ILLEGAL_STATE_TRANSITION`, "actor is not authorized", `authorized: [operator, orchestrator, system]` |
| `gorp run` | 69 | `NOT_IMPLEMENTED`, `responsibleWave: "Wave B (execution/orchestration)"`, `mutation: false` |

Representative structured output (illegal transition):

```json
{
  "success": false,
  "command": "graph.transition",
  "error": {
    "code": "ILLEGAL_STATE_TRANSITION",
    "message": "illegal graph transition approved -> completed",
    "details": { "from": "approved", "to": "completed",
                 "actorType": "operator", "reason": "no_such_transition" }
  }
}
```

## 7. Test Evidence

All commands re-run after every code/documentation change; final run from the
committed state (2026-07-14):

| Check | Command | Result |
|---|---|---|
| Install from lockfile | `npm ci` (in `runtime/control`) | OK (487 packages, lockfile respected) |
| Strict typecheck | `npm run typecheck` | clean, exit 0 |
| Build | `npm run build` | clean, exit 0 |
| Wave A Vitest | `npm test` | **58/58 passed** (5 files: transitions 11, contracts 21 — incl. terminology audit, graph-store 10, cli 13, integration 3) |
| Gorp loader | `./tools/test-loader.sh` | 8/8 passed |
| Gorp generator | `./tools/test-generator.sh` | 4/4 passed (deterministic + byte-match vs committed golden AGENTS.md for both consumers) |
| Gorp local adapter | `./tools/test-local-adapter.sh` | 4/4 passed |
| Aggregate validation | `./tools/validate-gorp.sh` | ALL CHECKS PASSED |
| Registry/consumer validation | `./tools/validate-gorp.sh --registry` | ALL CHECKS PASSED (2 projects) |
| guava-os suite | `npm test` (vitest) | **91/91 passed** (4 files) — matches the 91-test baseline exactly |
| guava-hermes | — | **No automated suite exists** (no package.json/Makefile/CI); nothing to run — reported as such |
| Generated artifacts | generator suite golden comparison | generated `AGENTS.md` outputs byte-identical to committed fixtures; no manual edits; documentation banners created **no** generated drift (verified by re-running the generator suite after all labeling) |

Adapter journal side effect during regression runs: the adapter test harness
materializes its own scratch git repos, so journal writes never touched the
three repositories — verified by diffing `git status` of both consumers before
and after the suites (no new artifacts; only the intended pre-existing doc
modifications remained). No test-induced artifacts required restoration.

## 8. State-Boundary Evidence

- **State root used for evidence:** a scratch `GORP_STATE_HOME`; the only file
  created was
  `<stateHome>/projects/fixture-proof/graphs/wave-a-proof-001.json`
  (plus a transient `.lock` during writes, removed on completion).
- **Persisted graph path pattern:**
  `$GORP_STATE_HOME/projects/<project-id>/graphs/<graph-id>.json`.
- **Fixture repository:** `git status --short` empty and directory listing
  unchanged (`.git`, `README.md` only) after the full CLI sequence — no
  runtime state written into the disposable repo.
- **guava-os / guava-hermes:** `git status` compared before and after all
  verification — zero new paths in either repo; no graph/run/lock/journal
  artifacts anywhere (`.gorp/graph/` and `.gorp/runs/` do not exist in either
  consumer).
- **Default state root:** `~/.local/state/gorp` does not exist on this
  machine — proof that verification respected the override and left no global
  residue.
- The Vitest integration test additionally asserts "writes NO runtime state
  into the fixture repository" on every test run.

## 9. Dependency Audit

Direct dependencies of `@gorp/control` (all justified):

| Package | Type | Justification |
|---|---|---|
| `ajv` 8.20.0 | runtime | JSON Schema 2020-12 validation |
| `ajv-formats` 3.0.1 | runtime | **approved/retained** — enforces `date-time` format validation instead of silently treating it as unknown |
| `typescript` 5.9.3 | dev | strict typecheck + build |
| `vitest` 2.1.9 | dev | test runner |
| `@types/node` 22.20.1 | dev | Node type definitions |

`npm audit`: **5 vulnerabilities (3 moderate, 1 high, 1 critical)** — all in
the **development-only** `vitest → @vitest/mocker → vite → vite-node → esbuild`
chain (esbuild dev-server request exposure; vite path traversal/fs.deny
advisories — several Windows-only; vitest UI-server arbitrary file
read/execute, and the Vitest UI is not used here). **Runtime dependencies
(`ajv`, `ajv-formats`) have zero advisories.** The only offered fix is a
breaking `vitest@4` upgrade; per directive, **no forced upgrade was
performed** (`npm audit fix --force` not run). Assessment: no credible
execution risk for this local control runtime; findings recorded as unresolved
development-only items. Lockfile present and consistent with the manifest
(`npm ci` succeeds cleanly). `dist/` policy: ignored and built locally
(committed `.gitignore`; documented in `runtime/control/README.md`).

## 10. Deviations

1. **`guava-os/.gorp/overlays/conventions.overlay.md` was inspected but not
   labeled.** The generator inlines this overlay into generated `AGENTS.md`;
   an in-file banner would alter generated output and break the golden
   fixtures (unintended generated drift, which the directive forbids). The
   file makes no execution-authority claims (it frames the CLI as read-only,
   Linear-as-stdin-input). Its classification is carried here and in the
   authority documentation instead of in-file.
2. **`gorp/specs/execution-report.schema.json` and
   `resolved-context.schema.json` carry no in-file labels** — JSON schema
   files cannot take markdown banners. The status of
   `execution-report.schema.json` is declared in the banner of its companion
   `specs/execution-report-contract.md`.
3. **Stale `MEMORY.md` retained** (marked `STALE`, disposition documented in
   the banner): unverified against external local Claude state; removal
   deferred pending operator confirmation (roadmap U5) — as the directive
   requires.
4. **`dispatch.sh` has a `DEPRECATED/QUARANTINED` banner but no execution
   guard** (no early `exit`): carried over from the prior docs-only
   reconciliation; adding a behavioral guard is a script-behavior change not
   authorized in this closeout. Recorded in roadmap M0 as a planned,
   approval-gated change.
5. **`gorp` commit 1 includes `runtime/control/README.md` and `.gitignore`**
   (closeout-authored) alongside the pre-existing runtime implementation —
   per the directive's instruction that commit 1 include package
   configuration and runtime documentation directly tied to the
   implementation.
6. **The CLI evidence "illegal transition" case used `approved → completed`**
   (a no-such-transition case) in addition to the tested `draft → running`
   variant in the suite; both prove the same enforcement path (exit 7,
   no mutation).
7. **guava-os `main` is ahead of its origin by 3 commits after this closeout**
   (2 pre-existing + 1 new). Nothing was pushed, per directive.

## 11. Known Limitations

- One-node graph runtime only; node `dependencies` must be empty.
- No execution, sandbox, worker, orchestration, validation gate, review,
  promotion, or durable assembled run record (`run|review|promote|inspect`
  are `NOT_IMPLEMENTED`).
- Single-process/local lock-file protection only; no distributed coordination;
  a crashed process could leave a stale `.lock` requiring manual removal.
- Transition IDs use an in-process counter (`graph-draft-approved-0001`) —
  unique within a process run, not globally.
- The simulated local adapter (pre-Wave A, unchanged) still mutates the
  consumer tree by writing a journal when invoked as a "check" — the recorded
  observability invariant is scheduled for roadmap Stage 6.
- Execution-time governance remains advisory outside the graph store: nothing
  prevents direct, ungoverned edits to consumer repositories.
- Dev-only dependency advisories in the vitest chain remain open (section 9).

## 12. Wave B Entry Conditions (verified prerequisites now available)

1. Four canonical, fixture-backed, source-neutral contract schemas
   (`gorp/specs/runtime/`) — including `worker-result`, `gate-record`, and
   `run-record`, which Wave B/C components will produce/consume.
2. A persisted, approved-capable execution graph with enforced transitions and
   actor restrictions — the orchestrator's authoritative substrate
   (`approved → running → …` transitions are already encoded and tested).
3. A machine-local state root honored by all runtime writes
   (`GORP_STATE_HOME`), with the state boundary proven.
4. A structured CLI + error/exit-code model into which `run` (Wave B) and
   `review`/`promote`/`inspect` (Wave C) slot without surface changes.
5. A TypeScript package with strict config, build, and test harness to extend
   (58 green tests as the regression floor, plus the pre-existing Gorp/guava-os
   suites: 8+4+4+91 green).
6. An approved, documented vertical-slice plan: disposable fixture repository
   → execution mechanics proof → useful guava-os canary → small real sprint;
   promotion via exact-hash, fail-closed cherry-pick (roadmap §8, M8).
7. Reconciled documentation: no active-looking instruction now directs an
   agent into the deprecated Linear/markdown-dispatch architecture.

## 13. Repository Status Before Commit

`git status --short` immediately before committing (2026-07-14):

**gorp** — 14 modified + 2 untracked trees:
```
 M README.md
 M improvements/proposals/doctor-local-only-proposal.md
 M improvements/proposals/mutation-journal.md
 M improvements/roadmap/HERMES-BOOTSTRAP.md
 M playbooks/dispatch.sh
 M reference/architecture.md
 M reference/directory-structure.md
 M reference/kit-readme.md
 M specs/claim-leases.md
 M specs/execution-report-contract.md
 M specs/execution-state-machine.md
 M specs/graph-semantics.md
 M specs/violation-codes.md
 M templates/gorp/plans/current-sprint.md
?? runtime/control/
?? specs/runtime/
```

**guava-hermes:**
```
 M README.md
```

**guava-os** — 33 modified files (4 agents + robo, 4 skills, MEMORY.md,
3 process docs, 4 spec copies, 9 docs, 5 specs, CLAUDE.md; full list preserved
in the closeout transcript).

## 14. Commit Record

| Repository | Hash | Message |
|---|---|---|
| gorp | `6e05d8e` | `feat(control): add deterministic Wave A graph runtime` (37 files: runtime, schemas, fixtures, tests, package config, runtime README, .gitignore) |
| gorp | `a916321` | `docs: reconcile architecture after Wave A` (14 documentation files) |
| guava-hermes | `c4d5322` | `docs: clarify Hermes integration boundaries` |
| guava-os | `13c9f1f` | `docs: deprecate legacy execution authority` (33 files) |

Nothing was pushed. No history was rewritten.

## 15. Repository Status After Commit

`git status --short` after all commits and the final verification sweep:

| Repository | Status |
|---|---|
| `/Users/sebroot/dev/gorp` | **clean** (0 paths) |
| `/Users/sebroot/dev/repos/guava-hermes` | **clean** (0 paths) |
| `/Users/sebroot/dev/repos/guava-os` | **clean** (0 paths) |

No temporary graph state, test repositories, lock files, verification
journals, build debris, or untracked fixtures remain in any repository. The
disposable fixture repository and scratch state root used for CLI evidence
lived in the session scratchpad (outside all repos) and were removed at
closeout. `~/.local/state/gorp` does not exist.

---

*Wave A is complete. Wave B has not begun.*
