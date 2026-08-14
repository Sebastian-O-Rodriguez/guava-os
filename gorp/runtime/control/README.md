# Gorp Control Runtime (`runtime/control/`)

> **Authority:** read `../../ADR_001.md` first — it is the source of truth for
> system boundaries and ownership and wins on conflict. Then the four
> source-of-truth docs — `../../VISION.md`, `../../SYSTEM-MODEL.md`,
> `../../CURRENT-STATE.md`, `../../ARCHITECTURAL-INVARIANTS.md`. This README
> documents the runtime that implements them; the code, schemas, and tests
> are the authority for behavior.

**Status: `CURRENT` — Waves A–E (2026-07-14/15) + Sprints 2A–4A + planner
(2026-07-15→17) + Sprint 5A (2026-07-20). The full pipeline is complete: an
operator-approved sprint document → `gorp compile-graph` (deterministic draft
graph) → operator approval → `gorp orchestrate` (per-node: sandbox → worker
via the async adapter seam → real gates → review policy → promote) →
`gorp inspect` (complete audit). One process, one graph at a time, no
concurrency, no AUTOMATIC retries; omp worker output always stops for human
review.**

> ## Sprint 5A delta (2026-07-20) — read this first
>
> Sections below that predate 5A still describe the older contract in four
> places; the CODE and the schemas are the authority. What changed:
>
> 1. **Retry review verdict.** `gorp retry` joins approve/reject: it records
>    an immutable, hash-bound `retry` decision, returns the node to
>    `pending` (new `awaiting_review → pending` operator transition), keeps
>    the graph running and all prior records/chains, and blocks promotion of
>    the retried run (`review-retry`). "One terminal decision per node" is
>    now "one decision per node RUN".
> 2. **Attempt-scoped run ids.** Run ids are `run-<attempt>` — `run-1`,
>    `run-2` after a retry, each with its own records dir and audit chain.
>    Any text below saying the run id is fixed at `run-1` (or
>    `<graphId>-run-1`) is pre-5A.
> 3. **projectId-only execution state.** Graphs no longer persist
>    `repositoryPath` anywhere; paths resolve at command time from
>    `registry/projects.yml` (override `GORP_PROJECT_REGISTRY`; new error
>    `PROJECT_NOT_REGISTERED`, exit 20; `src/registry/projects.ts`).
>    Legacy graphs are migrated lazily on load.
> 4. **Enriched worker result.** Workers report `summary` (required at the
>    adapter boundary), `expectedFiles`, and `reviewerNotes`;
>    `changedFiles` stays git-computed. Schema keeps the new fields
>    optional so pre-5A chained records remain valid.
>
> Proven in production use: guava-os-real-1 (first real Hermes sprint, one
> live retry), plus the dogfood-1..6 and skill-note-1..4 operator sprints
> (2026-07-22/23) driven from the guava-hermes Operator Shell.

The TypeScript control-plane runtime for Gorp. It owns the authoritative,
persisted, source-neutral execution graph, its state transitions, and (Wave B)
the single-pass execution flow: approved graph → git-worktree sandbox →
deterministic fixture worker → persisted worker result → scope gate →
persisted gate record → read-only review. Shell is used only at
operating-system boundaries (git invocation); this package is the control
plane.

Canonical contracts live at [`../../specs/runtime/`](../../specs/runtime/)
(JSON Schema 2020-12, `additionalProperties: false`): the original Wave A set
(`execution-graph`, `worker-result`, `gate-record`, `run-record`), the
Wave D decision/promotion records (`review-decision`, `promotion-record`),
and the final-sprint planning contract (`sprint`) — seven schemas.

## Installation

```sh
cd runtime/control
npm ci            # install exactly from package-lock.json
```

Runtime dependencies: `ajv` (2020 dialect) and `ajv-formats` (required —
`date-time` fields must be *validated*, not silently treated as an unknown
format). Dev dependencies: `typescript`, `vitest`, `@types/node`.

## Build and test

```sh
npm run typecheck   # strict TypeScript, no emit (tsc -p tsconfig.json --noEmit)
npm run build       # compile to dist/ (tsc -p tsconfig.json)
npm test            # all Vitest suites (169 tests: contracts, transitions,
                    #   graph store, CLI, run/gate/review E2E, decisions,
                    #   promote, inspect/audit-chain, multi-node, invariants,
                    #   orchestrator-readiness, scheduler, adapter, hermes,
                    #   gate/policy, planner, integration incl.
                    #   the schema terminology audit and state-boundary proof)
```

*(The shell regression harnesses — loader/generator/local-adapter fixtures and
`validate-gorp.sh` — were removed with the pre-control-plane stack in the
2026-07-27 cleanup. This vitest suite is the whole test surface.)*

## CLI usage

Build first, then invoke the compiled CLI:

```sh
node dist/cli/main.js <command> [flags]
```

All commands emit structured JSON (success envelope or
`{success:false, error:{code, message, details}}`). Exit codes are documented
in `src/errors/index.ts` (`EXIT_CODES`); every error code has a distinct exit
code (e.g. `SCHEMA_VALIDATION_FAILED`=3, `ILLEGAL_STATE_TRANSITION`=7,
`NOT_IMPLEMENTED`=69).

### Implemented (Wave A)

```sh
# create a draft, unapproved single-node graph (flags mode)
gorp graph create --graph-id <id> --project-id <id> --repo <path> \
  --base-commit <sha> --objective "<text>" [--from <graph.json>] [--overwrite]

# validate a persisted graph (or --from <file>) against the canonical schema
gorp graph validate --project-id <id> --graph-id <id>

# print the persisted graph document
gorp graph show --project-id <id> --graph-id <id>

# apply a legal state transition (e.g. operator approval)
gorp graph transition --project-id <id> --graph-id <id> --to approved \
  --actor-type operator --actor-id <who> --reason-code UPPER_SNAKE \
  --reason "<text>"
```

Notes:
- `graph create` always forces `status: draft` / `approvalStatus: unapproved`;
  approval only ever happens through an explicit `graph transition`.
- Transitions are checked against the transition table
  (`src/state/transitions.ts`). Workers are **not** an actor type and are
  rejected; only `operator`, `orchestrator`, and `system` may transition state,
  and only the operator may approve (`draft -> approved`).
- Illegal transitions fail with a structured error and **no persistence side
  effect**.

### Implemented (Wave B)

```sh
# execute ONE explicitly chosen node, once: sandbox -> fixture worker ->
# worker result -> scope gate -> gate record -> stop at the review boundary
gorp run --project-id <id> --graph-id <id> --node-id <id> [--actor-id <who>]

# READ-ONLY review of that node's run: records + changed files + sandbox diff
gorp review --project-id <id> --graph-id <id> --node-id <id> [--run-id <id>]
```

Run semantics (Sprint 2A):
- `--node-id` is **required** — there is no fallback to the first node; an
  unknown or empty nodeId fails closed. Run policy (`src/run/policy.ts`):
  node ids unique, dependencies reference existing nodes, the chosen node is
  `pending`, and **every dependency is already `promoted`**.
- The graph must be `approved` (first node run moves it to `running`) or
  already `running` (later node runs). One run per node, no retries
  (`runId = run-1` within `runs/<graph-id>/<node-id>/`).
- **Base commit is recorded per node run**: the target HEAD at run start,
  persisted in the run record — so node 2 bases on the HEAD produced by
  promoting node 1. `graph.baseCommit` is creation-time provenance only.
- **An immutable baseline is captured at run start** (GOS-33, `src/run/baseline.ts`)
  and persisted into the run record as structured, machine-verifiable data:
  for a Git target, `{ kind, head, refs, treeHash, capturedAt }` — the target
  HEAD, every branch/tag ref → commit sha (gorp's own `gorp/run/…` sandbox
  branches excluded), and the committed tree hash (`HEAD^{tree}`). For a
  non-Git target it is a sorted file-hash list (`{ kind, files[], capturedAt }`).
  Capture fails closed — an unreadable or inconsistent repo aborts the run.
- Sandbox is a **git worktree** on branch
  `gorp/run/<graph-id>/<node-id>/<run-id>`, created at the node-run base,
  living under the state root — never in the consumer working tree. (Git
  necessarily registers branch/worktree metadata inside the consumer's
  `.git`; the consumer working tree stays clean.)
- Workers are invoked through the **adapter seam** (`src/worker/adapter.ts`,
  Sprint 3B; **async since Sprint 4A** — real workers are external
  processes): the runtime resolves `node.workerAdapter` against a registry —
  an unknown adapter fails closed (`NOT_IMPLEMENTED`, listing implemented
  adapters) **before any mutation** — and the result crosses a
  contract-enforcing boundary (schema-valid, identity echoes the invocation,
  adapter name matches; violations fail closed as `WORKER_FAILED`). Two
  adapters are registered:
  - **fixture** — deterministic: materializes the node's `expectedArtifacts`
    and records exactly one sandbox commit.
  - **omp** (`src/worker/omp.ts`; hermes retired 2026-07-31) — spawns ONE
    external process per attempt: `omp -p --auto-approve --mode json --model
    <model> <prompt>`, cwd = the sandbox; the model comes from
    `GORP_OMP_MODEL` and the persona body from
    `GORP_OMP_SYSTEM_PROMPT_APPEND` (forwarded as `--append-system-prompt`).
    Persona-aware dispatch is implemented (GUA-123): issue persona label →
    task.persona → node.persona → run-record `profile {persona, model}`.
    **The adapter makes the single sandbox commit** — a worker that touches
    git HEAD is a contract violation. Fail closed on: timeout/signal,
    non-zero exit, HEAD movement, and "success" with no changes. Changed
    files are computed from git, never trusted. **Human review stays**: the
    review policy never auto-approves omp output — the scheduler stops at
    the review boundary.
  Workers are blind either way: an invocation carries only the sandbox
  handle, node spec, ids, and clock — no config, no store, no state-home
  path.
- Changed files are computed **from git**, never trusted from the worker.
- The **gate** (Sprint 3C: real project checks) runs in two phases, all
  recorded in one chained gate record bound to the sandbox HEAD
  (`validation.artifactHash`):
  1. **scope checks** — sandbox clean (all changes committed), every changed
     file inside `allowedPaths`, none in `forbiddenPaths`;
  2. **project command checks** — only when scope passed: each of the node's
     `requiredCommands` runs inside the sandbox. Since Sprint 3D a command is
     **structured**: `{ executable, args[], timeoutMs? }` (e.g.
     `{ "executable": "npx", "args": ["vitest", "run"] }`) — spawned exactly
     as given, **no shell, no whitespace splitting, no interpolation**; args
     may contain any characters. Every command has a **timeout**
     (`timeoutMs`, default 600000 ms): on expiry the process is killed and
     the check fails closed with `exit=timeout(killed after Nms)` recorded.
     Exit code, stdout, stderr (truncated), duration, and the timeout are
     captured into the check detail. A blank executable is bad config
     (failed, never skipped; a literal empty one is schema-rejected); an
     unspawnable binary fails with `exit=-1`. Any failed check fails the
     gate; a failed gate means no review and no promotion.
- Success: node → `awaiting_review`, sandbox kept, exit 0. Failure (worker or
  gate): node+graph → `failed`, sandbox destroyed, evidence records retained,
  distinct exit codes (`SANDBOX_FAILURE`=11, `WORKER_FAILED`=12,
  `GATE_FAILED`=13).

### Implemented (Wave D): the review decision, split from promotion

```sh
# record the single terminal review decision for the run (exactly one, ever)
gorp approve --project-id <id> --graph-id <id> --node-id <id> \
  --actor-id <reviewer> --reviewed-commit <sha> --reason <text> [--run-id <id>]
gorp reject  --project-id <id> --graph-id <id> --node-id <id> \
  --actor-id <reviewer> --reason <text> [--run-id <id>]
```

- The flow is: `run` → review pending → **approve OR reject** → promote only
  if approved. Promote no longer approves.
- A decision is written **once** as an immutable `review-decision` record
  bound to the exact gate the reviewer saw (`gateRecordSha256`) and the exact
  artifact judged (`reviewedArtifactHash`); `approve` requires the operator to
  restate that commit via `--reviewed-commit`. Double approve fails; approve
  after reject fails (`REVIEW_BLOCKED`, exit 17).
- `approve` only records the decision (node → `approved`); it does not touch
  the target repository. `reject` records the decision, moves the node to
  `rejected`, **closes the graph as `cancelled`** (terminal — no graph is
  left `running` after a rejection), and destroys the sandbox — rejected work
  can never be promoted.

### Implemented (Waves C+D): promotion

```sh
# promote the approved, reviewed sandbox commit onto the target (fail closed)
gorp promote --project-id <id> --graph-id <id> --node-id <id> --actor-id <who> [--run-id <id>]
```

One path only, **no mutation before every check passes**:

1. the audit chain must verify (a chained record edited or deleted without a
   consistent chain rewrite → `AUDIT_TAMPERED`, exit 18);
2. an **approved** review decision must exist and still bind to the current
   gate record and its `artifactHash` (missing → blocked; rejected → blocked
   forever);
3. node `approved`, graph `running`, run record and worker result
   `succeeded`, persisted gate validation `passed`;
4. the gate's `artifactHash` is a full commit SHA; the sandbox HEAD equals
   it; the reviewed commit is a direct child of the recorded base;
5. the target repo HEAD still equals the **node run's recorded base commit**
   (from the run record — per-node, so a later node's base is an earlier
   node's promotion result) with a clean tree; and, when the run record
   carries a GOS-33 baseline, the **full baseline verifies unchanged** — same
   HEAD, same branch/tag refs (a repointed tag or branch fails closed), same
   committed tree hash — blocking as `baseline` before any mutation (older
   records without a baseline keep the legacy HEAD-only check);
6. the **full gate is rerun live against the reviewed commit** (Sprint 3D:
   no stale gate — scope checks AND every project command must pass AGAIN;
   the persisted verdict is never trusted alone). A scope failure blocks as
   `scope-rerun`; a command failure blocks as `gate-rerun` with the failing
   checks (exit/stdout/stderr/timeout) as evidence — no cherry-pick, sandbox
   and records kept, the approval stands, and the same promote succeeds once
   the environment is healthy again;
7. only then: `git cherry-pick <reviewed-commit>`. Any conflict aborts with a
   pristine tree and `PROMOTION_CONFLICT` (exit 16) — **no rebase, no merge,
   no conflict resolution, no retry, no partial application.**
8. on success: an immutable `promotion-record` is written and chained
   (linked to the approval by `reviewDecisionSha256`), node → `promoted`,
   and the sandbox worktree + branch are removed. **The graph is NOT
   completed** — it stays `running`; completion over all nodes belongs to the
   orchestrator (later). The gate record, review decision, and run record are
   **never rewritten**.

Any failed check exits with `PROMOTION_BLOCKED` (exit 15) naming the check;
nothing is mutated.

### Implemented (Wave D): complete read-only audit

```sh
gorp inspect --project-id <id> --graph-id <id> --node-id <id> [--run-id <id>] [--diff]
```

One command, read-only, nothing hidden: graph + node state, the full
transition history, worker result, sandbox (HEAD, changed files, `--diff` for
the patch), gate record with every check, review decision, promotion record,
control decisions, all timestamps, all recorded errors, and the audit-chain
integrity verdict with the exact location of any break. Inspect never
mutates anything (verified by test: the state root is byte-identical before
and after).

### Implemented (final sprint): the planner

```sh
gorp compile-graph --from <sprint.json> [--base-commit <sha>] [--overwrite]
```

Input: an OPERATOR-APPROVED sprint document (`specs/runtime/sprint.schema.json`):
tasks with objectives, acceptance criteria, dependencies, scope
(allowed/forbidden paths), gates (structured commands), worker adapter,
review posture (`human`, or `fixture-auto` for the fixture worker only),
`maxAttempts` (const 1 — no retries exist) and `escalation` (const
`operator`). Output: a **deterministic draft graph** (same sprint + base +
clock → byte-identical document) persisted to the state root. The planner
**executes nothing and approves nothing** — the graph still requires the
explicit operator approval transition. Bad sprints are **rejected, never
repaired**: schema violations, duplicate/unknown/self/CYCLIC dependencies,
unregistered worker adapters, `fixture-auto` review on a non-fixture worker,
and any capability the runtime doesn't enforce (retries, non-operator
escalation). The full pipeline is: **sprint → plan → approve → orchestrate →
review/promote → inspect.**

### Implemented (Sprint 3A): the first orchestrator

```sh
gorp orchestrate --project-id <id> --graph-id <id> \
  [--actor-id <who>] [--max-steps <n>] [--review-policy <name>]
```

A single-process, single-graph scheduler loop (`src/orchestrator/scheduler.ts`)
that uses the **public surface only** — it imports nothing from the runtime
and issues every action as a `node dist/cli/main.js …` subprocess:

- each iteration re-discovers ALL state from `graph show` (no memory between
  steps — every step is a crash/restart boundary, as proven by the readiness
  suite), then derives exactly ONE action mechanically: an `awaiting_review`
  node → approve (reviewed commit re-read from the read-only `review`
  output); an `approved` node → promote; a `pending` node with every
  dependency `promoted` → run (first in document order — the deterministic
  tie-break); all nodes terminal → complete the graph.
- **there is NO auto-approve (Sprint 3C)**: every approval goes through a
  pluggable **review policy** (`src/orchestrator/review-policy.ts`,
  `--review-policy <name>`, default `fixture`). The fixture policy approves
  only deterministic fixture-worker output with a passed gate; any other
  adapter — and any policy `stop` — halts the scheduler with
  `review-policy-stop` and the required human action (inspect, then
  `gorp approve`/`gorp reject`, then re-run `orchestrate`). An unknown policy
  name fails closed before anything runs.
- **stops with machine state, never guesses**: graph `cancelled` (reject
  path) / `failed`, an `interrupted-run` recovery state, a `blocked` node, a
  wedge (pending node whose dependency terminated without promotion), a
  review-policy stop, any refused or failed command, or the step cap. On
  success it exits 0 with the full step log; on any stop the CLI fails closed
  with `ORCHESTRATION_STOPPED` (exit 19) carrying `reason`, `nodeStates`,
  `stopState`, and the step log.
- re-running `orchestrate` on a completed graph is a clean no-op; re-running
  after a crash resumes exactly where the state says (duplicate work is
  impossible because the runtime refuses it, not because the scheduler
  remembers anything).
- requires the compiled CLI (`npm run build` first).

## Audit chain (integrity evidence — no external anchor)

Every persisted record (`worker-result`, `gate-record`, `run-record`,
`review-decision`, `promotion-record`) is hashed into an **append-only**
`audit-chain.jsonl` in the run directory the moment it is written:

```text
{ seq, event, ref, sha256, prev, at, entryHash }
  sha256    = SHA-256 of the referenced file's bytes at write time
  prev      = entryHash of the previous entry (64 zeros for the genesis)
  entryHash = SHA-256 of the canonical JSON of the entry body
```

Records are immutable to the runtime after being chained — the runtime never
rewrites them (append-only history; the review decision and promotion record
are separate files, not edits to the gate or run record). Verification
recomputes every entry hash, the prev links, and every referenced file's
current content hash. `gorp inspect` reports any break, and
`approve`/`reject`/`promote` fail closed with `AUDIT_TAMPERED`.

**Exact guarantees — no more, no less:**

- **Detected:** any edit or deletion of a chained record that is not
  accompanied by a consistent rewrite of the chain; any edit to an individual
  chain line; truncation that breaks the links.
- **Not detected:** an actor with write access to the state root who edits
  records **and regenerates the entire chain consistently**. There is **no
  external anchor** — no signing key, no remote or append-only external
  timestamp, nothing outside the run directory. Until an external anchor
  exists, treat the chain as integrity evidence against accidental corruption
  and naive edits, **not** as a security boundary against a local adversary.

Cross-record identity is bound by ids and hashes: decision → gate
(`gateRecordSha256`) → artifact (`reviewedArtifactHash` = sandbox commit) →
promotion (`reviewDecisionSha256`, `promotedCommit`, `resultCommit`). All
timestamps come from the injected clock.

Record semantics (append-only — each record is written once and never
updated): `run-record.finalStatus` is the **execution** outcome
(`succeeded`/`failed`); the review verdict lives only in
`review-decision.json` and the promotion result only in
`promotion-record.json`. The gate record's embedded `review` object is
written as `pending` and stays `pending` — decisions never edit it.

## State configuration

Authoritative runtime state lives under a machine-local state root, **outside
every consumer repository**:

- Default: `~/.local/state/gorp`
- Override: `GORP_STATE_HOME=<path>`

Layout:

```text
<stateHome>/projects/<project-id>/graphs/<graph-id>.json
<stateHome>/projects/<project-id>/graphs/<graph-id>.lock                    (transient)
<stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/run-record.json
<stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/worker-result.json
<stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/gate-record.json
<stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/review-decision.json   (written once by approve/reject)
<stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/promotion-record.json  (written once by promote)
<stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/audit-chain.jsonl      (append-only integrity evidence, no external anchor)
<stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/sandbox/               (git worktree; kept while awaiting review/approval, removed on failure, rejection, or promotion)
<stateHome>/projects/<project-id>/orchestrator/<graph-id>.jsonl                             (append-only orchestrate invocation log — Sprint 2.1)
```

**Orchestrate invocation log (Sprint 2.1 — failure semantics).** Every
`gorp orchestrate` appends a `started` event (invocationId, actor, pid) before
the scheduler loop and an `ended` event (outcome, stop reason, stopState,
graph/node states, step log) after it, so a DETACHED invocation whose stdout
is discarded is never silent. `gorp orchestrate-status --project-id …
--graph-id …` is the pure read: it folds the log into per-invocation status
and disambiguates a missing `ended` event by pid liveness on this host —
`running` (pid alive) vs `presumed-crashed` (process gone without recording a
stop). Operational status, not audit authority: the graph + run records stay
the source of truth; this log records what the scheduler observed.

*(Sprint 2A compatibility break: the pre-2A flat `runs/<run-id>/` layout is
not read by the current runtime. No production state existed in the old
layout — all prior runs lived in disposable test state roots.)*

Writes are atomic (temp file + fsync + rename; prior state survives failure),
serialization is deterministic (sorted keys, byte-identical), and a single-host
lock file protects concurrent writers.

## Current limitations (after Wave D)

- **Multi-node graphs with dependencies ARE supported** (Sprint 2A+); the
  scheduler runs nodes in dependency order, one at a time. *(Corrected
  2026-07-27: an earlier revision of this list wrongly said one-node-only.)*
- **No concurrency, no background jobs** — a single synchronous pass. Retry
  exists as an operator review verdict (Sprint 5A: node returns to pending,
  attempt-scoped run ids); there is still no `escalate` verdict and no
  automatic retry.
- **Two registered adapters** — `fixture` (deterministic) and `omp`
  (spawns the `omp` binary; model via `GORP_OMP_MODEL`); any other
  `workerAdapter` fails closed as `NOT_IMPLEMENTED` before any mutation.
- **Gate command capture is truncated** to 2000 chars per stream; the
  default command timeout is 10 minutes (per-command `timeoutMs` overrides).
  Promotion re-runs every project command, so promote latency includes the
  full check suite by design (no stale gate).
- **`graph create` flags mode cannot author commands** — structured
  `{executable, args[]}` commands cannot be expressed in a CSV flag without
  whitespace splitting (forbidden); author them in a graph document and use
  `--from` (`--commands` is refused with a pointer).
- **A blocked promotion has no automated recovery** — base drift, tamper, or
  conflict stop the run; the operator resolves manually (no retry command).
- **An interrupted `gorp run` is detected, not repaired** — inspect reports
  `recovery.state: "interrupted-run"` with the required operator action; no
  auto-retry exists (one attempt per node), and cleanup of the run dir /
  leftover sandbox is manual.
- **A graph completes only when every node is terminal** — the guard refuses
  premature completion; an operator who wants to close out unfinished work
  must first cancel/fail the remaining nodes (or the graph).
- **A rejected run ends the graph** — reject records the decision, moves the
  node to `rejected`, and closes the graph as `cancelled` (operator,
  `REVIEW_REJECTED`). There is no path from a rejected run back to review or
  promotion.
- **Audit chain has no external anchor** — it detects edits that do not also
  rewrite the chain, but a local actor with write access to the state root
  who regenerates the whole chain is not detectable. It is integrity
  evidence, not a security boundary (see "Audit chain" above).
- **The scheduler is deliberately minimal** — one process, one graph, no
  concurrency, no retries, no blocker routing; approvals go through the
  review policy (only the `fixture` policy exists — deterministic fixture
  output only; everything else stops for a human); on any stop condition it
  halts with machine state and leaves recovery to the operator.
- **Single-process / local locking only** — no distributed coordination; a
  crashed process can leave a stale `.lock` or orphaned worktree requiring
  manual cleanup.

## Architecture boundary

- Consumer repositories contain **project code and declarative context**
  (bindings, overlays, generated `AGENTS.md`).
- Local Gorp state (`GORP_STATE_HOME`) contains **execution control state**
  (graphs; later runs/records).
- **Wave A writes no runtime state into any consumer repository** — proven by
  the integration test (`tests/integration.test.ts`) and the closeout
  state-boundary verification.
- The execution graph is authoritative during a run; workers never transition
  graph state or modify graph topology.

## Orchestrator readiness — design-debt register (audited 2026-07-15)

Question audited: *can a multi-node orchestrator bolt on clean?*
**Answer: the contract/state layer is ready; the control-flow layer is not —
five contained refactors are required at Stage 3 start. No current bug blocks
that work.**

**Already multi-node ready (no change needed):**
- `execution-graph` schema accepts node arrays with `dependencies`; the
  single-node limit is a runtime assertion, not a contract limit.
- The node transition table carries the full vocabulary
  (`pending/ready/running/blocked/failed/awaiting_review/approved/rejected/promoted/cancelled`)
  and `applyNodeTransition` addresses nodes by id.
- Every record (`worker-result`, `gate-record`, `run-record`,
  `review-decision`, `promotion-record`) carries `graphId`+`nodeId`+`runId`,
  so records survive a layout change.
- The worker boundary is clean: workers get a sandbox + node spec, never the
  store; `worker` is not an actor type.

**Required refactors — ALL RESOLVED in Sprint 2A (2026-07-15):**
1. ~~Shape gate lives in the storage layer~~ → **done**: the store validates
   schema only; shape/eligibility rules live in `src/run/policy.ts` (unique
   node ids, valid dependency references, node `pending`, dependencies
   `promoted`).
2. ~~`nodes[0]` indexing everywhere~~ → **done**: every run-flow command
   requires `--node-id` (`selectNode` fails closed on missing/unknown; no
   fallback to the first node).
3. ~~Record layout is per-run, not per-node~~ → **done**: layout is
   `runs/<graph-id>/<node-id>/<run-id>/…` (`RunRef` keys every path helper);
   sandbox branch is `gorp/run/<graph-id>/<node-id>/<run-id>`.
4. ~~Base-commit model is per-graph~~ → **done**: the base is recorded per
   node run (target HEAD at run start, persisted in the run record) and
   promotion verifies against it; `graph.baseCommit` is provenance only.
5. ~~Graph completion hardcoded to the first promotion~~ → **done**: promote
   marks the node `promoted` and leaves the graph `running`; completion over
   all nodes belongs to the future orchestrator.

**Readiness proof (2026-07-16, `tests/orchestrator-readiness.test.ts`):**
a crash-driven scheduler drove a two-node graph end-to-end using ONLY the
public surface (compiled CLI + structured JSON + exit codes + documented
state layout — zero `src/` imports). After every step it discarded all
memory, re-discovered state from `graph show`/`review`/`inspect`, and
re-delivered the same command: every duplicate was refused with a structured,
non-mutating error (`run`→`STATE_CONFLICT`, `approve`→`REVIEW_BLOCKED`
already-decided, `promote`→`PROMOTION_BLOCKED` node-state, repeat
completion→`ILLEGAL_STATE_TRANSITION`), evidence records and chains survived
every crash point, ineligible nodes never ran, and a fully promoted graph was
closed via `graph transition --to completed --actor-type orchestrator`.
**Verdict: ready for a scheduler.** The two gaps recorded by the proof were
closed by the invariant fixes (2026-07-16, `tests/invariants.test.ts`):

1. **All-nodes-terminal completion guard (FIXED)** — `running → completed`
   now fails closed (`ILLEGAL_STATE_TRANSITION`, `reason:
   "nodes_not_terminal"`, listing the offending nodes) unless every node is
   terminal (`promoted`/`rejected`/`cancelled`/`failed`). Refusal mutates
   nothing and the non-terminal node stays fully workable. Mixed terminal
   states (e.g. promoted + operator-cancelled) complete cleanly.
2. **Mid-run crash rule (DEFINED)** — a node at rest in `ready`/`running`
   only exists if `gorp run` was interrupted. `graph show` surfaces the stuck
   state; `gorp inspect` no longer errors on it and instead returns a
   machine-readable `recovery` section: `state: "interrupted-run"`, the
   missing evidence records, `autoRetry: false`, and the required operator
   action (close the graph with `graph transition --to failed --actor-type
   system` or `--to cancelled`, then remove the run dir / leftover sandbox
   manually). There is deliberately NO auto-retry and no recovery command —
   one attempt per node stands. Healthy runs report `recovery.state: "none"`;
   a pending node with no run is still `RUN_NOT_FOUND`.

**Weak APIs — safe to change later, flagged now:**
- ~~Worker dispatch is hardcoded~~ → **resolved (Sprint 3B)**: the
  `WorkerAdapter` interface + registry in `src/worker/adapter.ts` is the
  Hermes seam. A new adapter = implement `invoke(WorkerInvocation):
  WorkerResult`, register it, and pass the same contract boundary
  (schema + identity + adapter-name checks) the fixture worker passes.
- **`runIdFor(graphId)` = `<graphId>-run-1`** — encodes the one-run/no-retry
  policy in a pure function; retries/multi-run need a run-identity policy
  (single caller each in run/review/decision/promote/inspect).
- **Transition ids use a module-global counter** — unique per process but
  order-dependent across graphs in one process; derive the sequence from
  `graph.transitions.length` when determinism across processes matters.
- **Run creation is not atomic** — `existsSync(runDir)` then
  `mkdirSync(recursive)` is a TOCTOU race; two concurrent `gorp run`s could
  both proceed. Irrelevant under the stated single-process/single-operator
  limit; must become atomic (non-recursive mkdir → EEXIST) before any
  concurrency.
- **No document revision** — `GraphStore` load→update is not
  compare-and-swap; the lock only guards individual writes. Fine
  single-process; multi-process orchestration would need an optimistic
  revision counter.
- **`runId` length edge** — a graphId near the 128-char `stableId` limit
  makes `<graphId>-run-1` exceed the pattern, failing record validation
  mid-run (fail-closed, but after sandbox creation, and the sandbox is then
  orphaned). Validate derived-id length at run start when touching run
  identity.

## dist/ policy

`dist/` is generated build output: **ignored, never committed** (see
`.gitignore`). Build locally with `npm run build`. The `gorp` bin entry points
at `dist/cli/main.js`; for source-direct development runs use
`npm run cli -- <args>` (Node type-stripping).
