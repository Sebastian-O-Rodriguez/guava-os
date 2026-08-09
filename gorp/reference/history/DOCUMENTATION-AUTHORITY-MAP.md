# Documentation Authority Map

Companion to `CURRENT-REALITY-AUDIT.md` and `ROADMAP.md`.
Produced under the reconciliation directive (Phase B). Classifies every
architecture / process / execution / sprint / graph / adapter / operator
document across the three repositories against the **approved Gorp-native,
source-neutral** target architecture.

Classification was derived from **actual runtime references, tests, generators,
and links** — not from file location. Where a doc's location implies an
authority its content does not have, that is flagged as a conflict.

Legend for **Class**:
- `CANONICAL_GLOBAL` — authoritative global contract/doctrine (lives in gorp).
- `CANONICAL_PROJECT` — authoritative project-specific context (lives in a consumer).
- `GENERATED` — machine-generated output; never hand-edited.
- `PROPOSAL` — design for an unbuilt capability; not authoritative.
- `LEGACY` — superseded model retained for history/reference only.
- `STALE` — obsolete/incorrect; slated for removal after reference check.
- `DUPLICATE` — a copy of a canonical doc that should reference, not duplicate.
- `ADAPTER_SPECIFIC` — tied to one external system (Linear/Claude Code); may
  survive only as an explicit adapter concern, never as core architecture.

Evidence labels as in the audit: `CODE` / `TEST` / `DOC` / `INFERENCE`.

---

## 1. Authority Table

### gorp (governance root)

| Document | Repository | Current Role | Class | Conflicts | Required Action |
|---|---|---|---|---|---|
| `README.md` | gorp | Repo overview | `LEGACY` (needs rewrite) | Calls Gorp "the canonical SoT for the multi-agent **Claude Code** OS"; lists `dispatch.sh` as canonical "executable doctrine"; says `runtime/` is "empty scaffold … no runtime wired" (false — loader/generator/adapter exist `CODE`); describes guava-os as "Linear issue graph" CLI | Rewrite to source-neutral Gorp-native framing; add supersession note; stop calling dispatch.sh canonical; correct runtime status |
| `reference/architecture.md` | gorp | "System architecture" | `LEGACY` | Entirely the old gorp-kit Claude-Code design: 5 fixed agents, `claude --agent`, `claude -p`, `claude --worktree`, tmux, markdown sprint lifecycle, opus/sonnet model pinning `DOC` | Mark `LEGACY`/superseded; point to canonical architecture doc (to be created per Phase C) |
| `reference/kit-readme.md` | gorp | Original gorp-kit README | `LEGACY` | "Claude Code Multiagent Project Scaffolding" — preserved kit artifact | Keep as history; add `LEGACY` banner |
| `reference/bootstrap.md` | gorp | New-project scaffolding steps | `CANONICAL_GLOBAL` (partial) | Stack-specific (Node/pnpm) assumptions; not execution-authority | Retain; minor note it is scaffolding guidance, not execution doctrine |
| `reference/patterns.md` | gorp | Stack code patterns for personas | `CANONICAL_GLOBAL` (reference) | Next.js-specific; advisory | Retain as reference material |
| `reference/directory-structure.md` | gorp | Annotated tree | `LEGACY` (partial) | Describes `.gorp/{plans,process,prompts,reports}` markdown model | Update or mark partially superseded |
| `migration-notes.md` | gorp | Record of the v1 build | `CANONICAL_GLOBAL` (historical) | Accurate & honest; already flags dispatch.sh, Linear specs, launch-contract as unresolved/proposals `DOC` | **Retain unchanged** — good provenance record |
| `doctrine/agent-protocol.md` | gorp | Agent comms/journal protocol | `CANONICAL_GLOBAL` | References journal/markdown workflow; needs source-neutral review | Retain; review for markdown-dispatch assumptions |
| `doctrine/approval-matrix.md` | gorp | Permission tiers | `CANONICAL_GLOBAL` | Prose only (not enforced) — audit §6 | Retain; will be referenced by review/promotion contracts |
| `doctrine/conventions.md` | gorp | Git/code conventions | `CANONICAL_GLOBAL` | — | Retain |
| `doctrine/gotchas.md` | gorp | Known pitfalls | `CANONICAL_GLOBAL` | — | Retain |
| `personas/{robo,architect,backend,frontend,qa}.md` | gorp | Canonical persona defs | `CANONICAL_GLOBAL` | robo/others describe dispatch-wave duties `DOC` | Retain; review persona bodies for dispatch/Linear assumptions during Stage 1 |
| `personas/PERSONA-SCHEMA.md` | gorp | Persona schema | `CANONICAL_GLOBAL` | — | Retain |
| `runtime/adapters/CONTRACT.md` | gorp | Runtime-adapter contract | `CANONICAL_GLOBAL` | Genuinely source-neutral; strong `DOC` | **Retain — foundation for worker/runtime adapter contracts** |
| `runtime/adapters/local/README.md` | gorp | Local (proof) adapter doc | `CANONICAL_GLOBAL` (describes a proof) | Must not imply real execution; adapter is journal-only sim `CODE` | Add `CURRENT: simulation only` label |
| `runtime/loader/RESOLUTION-SPEC.md` | gorp | Context resolution spec | `CANONICAL_GLOBAL` | — | Retain (matches `resolve-context.sh` `CODE` `TEST`) |
| `runtime/policies/scope.yml` (doc-bearing) | gorp | Scope policy | `CANONICAL_GLOBAL` | `pre_write_check.required:false` — prevention unbuilt | Retain; roadmap Stage 4/6 upgrades enforcement |
| `specs/resolved-context-contract.md` + `.schema.json` | gorp | Resolved-context contract | `CANONICAL_GLOBAL` | — | **Retain — source-neutral, tested** `TEST` |
| `specs/execution-report-contract.md` + `.schema.json` | gorp | Worker execution report | `CANONICAL_GLOBAL` but `ADAPTER_SPECIFIC` leakage | Mentions Linear `DOC` | Reconcile: strip Linear specifics; keep as worker-report contract |
| `specs/graph-semantics.md` | gorp | Execution graph semantics | `ADAPTER_SPECIFIC` (Linear) | Node/edge identity defined by Linear `parentId`/labels/statuses `DOC` — the core Linear coupling in canonical layer | **Reconcile → source-neutral graph schema** (roadmap Stage 1/2); retain Linear parts only as an import-adapter note |
| `specs/execution-state-machine.md` | gorp | Execution state machine | `ADAPTER_SPECIFIC` (Linear) | States "derived from Linear status"; `Backlog/Todo/In Review` etc. `DOC` | **Reconcile → source-neutral states**; mark Linear derivation legacy |
| `specs/claim-leases.md` | gorp | Claim/lease semantics | `ADAPTER_SPECIFIC` (Linear) | Linear-centric | Reconcile or defer (not in first slice) |
| `specs/violation-codes.md` | gorp | Vxxx violation codes | `CANONICAL_GLOBAL` (partly Linear) | Codes reference Linear structures | Retain; review codes needed by slice |
| `metadata/PROJECT-METADATA-SPEC.md` | gorp | project.yml metadata spec | `CANONICAL_GLOBAL` | — | Retain (matches loader `CODE`) |
| `registry/PROJECTS-SCHEMA.md` | gorp | Registry schema | `CANONICAL_GLOBAL` | — | Retain |
| `playbooks/dispatch.sh` (+ `prompts/dispatch.md.tmpl`) | gorp | Wave dispatcher calling `claude` | `LEGACY` | Superseded markdown+Claude model; ungoverned bypass (audit §6/§12) `CODE` | **Quarantine** (add `DEPRECATED` header + disable-guard plan); do not remove until orchestrator replaces it |
| `playbooks/quality-gate.sh` | gorp | tsc/lint/build/test wrapper | `CANONICAL_GLOBAL` (reusable) | Next.js `build` assumption | Retain; will feed validation contract |
| `playbooks/validate-journal.sh` | gorp | Journal validator | `CANONICAL_GLOBAL` | — | Retain |
| `improvements/README.md` | gorp | Proposal lifecycle | `CANONICAL_GLOBAL` | — | **Retain — this is the controlled-learning funnel** |
| `improvements/roadmap/HERMES-BOOTSTRAP.md` | gorp | Old critical path | `LEGACY`/`PROPOSAL` | Centers Hermes cockpit + dashboards; conflicts with new "Hermes last, replaceable" decision | Mark superseded by `ROADMAP.md` |
| `improvements/runtime/PRODUCTION-ADAPTER.md` | gorp | Worktree-isolation design | `PROPOSAL` | — (excellent, directly reused by roadmap Stage 4/8) | **Retain — promote into sandbox/promotion contracts** |
| `improvements/runtime/FLEET-READINESS.md` | gorp | Fleet/multi-project design | `PROPOSAL` (deferred) | Fleet scope excluded by directive §6.2 | Mark `PROPOSAL — DEFERRED (out of launch scope)` |
| `improvements/proposals/gorp-launch-contract.md` | gorp | tmux launch contract | `PROPOSAL` `ADAPTER_SPECIFIC` | tmux/session model; Linear-fed directives | Keep as proposal; mark tmux as one possible adapter, not core |
| `improvements/proposals/mutation-journal.md` | gorp | Mutation journal design | `PROPOSAL` | Feeds run-record contract | Keep; feed into Stage 9 |
| `improvements/proposals/unified-check-proposal.md` | gorp | `guava-os check` cmd | `PROPOSAL` `ADAPTER_SPECIFIC` | tool-level | Keep as proposal |
| `improvements/proposals/doctor-local-only-proposal.md` | gorp | doctor flag | `PROPOSAL` `ADAPTER_SPECIFIC` | tool-level | Keep as proposal |
| `templates/gorp/plans/current-sprint.md` | gorp | Sprint table template | `LEGACY` | Markdown-table sprint model (non-authoritative per §2.4) | Mark `LEGACY`; will be superseded by sprint schema (Stage 1) |
| `templates/gorp/plans/roadmap.md` | gorp | Roadmap template | `LEGACY` (partial) | Markdown planning template | Retain as ingestion/export template; mark non-authoritative |
| `templates/CLAUDE.md.tmpl`, `templates/config/*`, `Justfile`, `ci/*`, `docker/*` | gorp | Project-init scaffolding | `CANONICAL_GLOBAL` (templates) | `settings.json` has Claude-Code hooks | Retain as scaffolding; note Claude-Code specificity |
| `fixtures/generators/agents-md/*.AGENTS.md` | gorp | Golden test fixtures | `GENERATED` (test) | — | Retain (regenerated/tested `TEST`); never hand-edit |
| `fixtures/**/ANCHOR.md`, overlays | gorp | Loader/adapter test fixtures | `GENERATED` (test) | — | Retain |

### guava-hermes (integration consumer)

| Document | Repository | Current Role | Class | Conflicts | Required Action |
|---|---|---|---|---|---|
| `CLAUDE.md` | guava-hermes | Project anchor | `CANONICAL_PROJECT` | References Hermes/Linear context | Retain; clarify Hermes is a replaceable runtime adapter, not the orchestrator |
| `README.md` | guava-hermes | Repo overview | `CANONICAL_PROJECT` | Mentions Linear/cockpit | Update: integration repo, not execution authority |
| `.gorp/generated/AGENTS.md` (+ root `AGENTS.md` symlink) | guava-hermes | Generated agent context | `GENERATED` | — | **Never hand-edit**; regenerate via generator if source changes |
| `.gorp/overlays/conventions.overlay.md` | guava-hermes | Project conventions overlay | `CANONICAL_PROJECT` | "cockpit: read-and-coordinate" framing | Retain; align wording with "operator entry point, not authority" |
| `.gorp/overlays/personas/README.md` | guava-hermes | Overlay note | `CANONICAL_PROJECT` | — | Retain |
| `.gorp/context/overview.md` | guava-hermes | Project context | `CANONICAL_PROJECT` | — | Retain |
| `.gorp/plans/current-sprint.md` | guava-hermes | GHERM-001 no-op sprint | `LEGACY`/`GENERATED`-adjacent | Markdown-table sprint (non-authoritative) | Mark `LEGACY`; superseded by persisted graph (Stage 2) |
| `.gorp/journal/robo-2026-06-26.md` | guava-hermes | Simulated journal | `GENERATED` (sim) | Records a *simulated* run | Retain as artifact; audit already notes it is simulated |

### guava-os (pilot consumer)

| Document | Repository | Current Role | Class | Conflicts | Required Action |
|---|---|---|---|---|---|
| `CLAUDE.md` | guava-os | Project anchor | `CANONICAL_PROJECT` **with LEGACY execution doctrine** | Declares "Linear — sole execution source of truth", authority hierarchy, startup invariant, priority mapping `CODE` — the primary Linear-as-authority doc | **Reconcile:** keep project identity/stack; mark Linear-as-authority section `DEPRECATED`, point to Gorp-native model |
| `.gorp/process/{agent-protocol,approval-matrix,conventions}.md` | guava-os | Deployed process docs | `DUPLICATE` | Drifted copies of gorp `doctrine/*` (migration-notes confirms drift) | Deprecate; reference canonical gorp doctrine |
| `.gorp/specs/{graph-semantics,execution-state-machine,claim-leases,violation-codes}.md` | guava-os | Local spec copies | `DUPLICATE` `ADAPTER_SPECIFIC` | Copies of canonical Linear-coupled specs; CONTRACT.md §4 forbids authoritative project copies `DOC` | **Deprecate → reference canonical**; remove after reference reconciliation |
| `.gorp/overlays/{conventions.overlay.md,personas/README.md}` | guava-os | Overlays | `CANONICAL_PROJECT` | overlay mentions Linear | Retain; strip Linear-as-authority language |
| `.gorp/archive/journal/robo-2026-03-10.md` | guava-os | Archived journal | `STALE`/`LEGACY` | historical | Keep archived; already non-authoritative by CLAUDE.md hierarchy |
| `.gorp/archive/project-setup-report.md` | guava-os | Archived setup report | `STALE`/`LEGACY` | Linear/dispatch mentions | Keep archived |
| `.guava-os/src/*.ts` (+ `docs/*`, `USAGE.md`, `RUNBOOK.md`) | guava-os | Read-only Linear classifier CLI + docs | `ADAPTER_SPECIFIC` | Linear-issue model throughout `CODE` | **Evaluate for reuse as a Linear *import adapter*** before any removal (directive A4); docs describe a real, tested tool — retain but reclass as adapter/reporting, not execution authority |
| `.guava-os/docs/*` (commands/concepts/workflow/limitations/etc.) | guava-os | CLI docs | `ADAPTER_SPECIFIC` | Describe Linear-graph classification | Retain with CLI; add note the CLI is a candidate source adapter, not the execution model |
| `.guava-os/pilot/report.md` | guava-os | Pilot run report | `ADAPTER_SPECIFIC` (historical) | Real read-only pilot against Linear data | Retain as historical evidence |
| `.guava-os/specs/{gorp-launch-contract,mutation-journal,unified-check-proposal,doctor-local-only-proposal}.md` | guava-os | Local proposal copies | `DUPLICATE`/`PROPOSAL` | Copies of gorp `improvements/proposals/*` | Deprecate local copies; reference gorp `improvements/` |
| `.guava-os/specs/execution-report-contract.md` + `.schema.json` | guava-os | Local contract copies | `DUPLICATE` | Copies of gorp `specs/*` | Deprecate; reference canonical |
| `.claude/agents/{robo,architect,backend,frontend,qa}/AGENT.md` | guava-os | Claude-Code agent directives | `LEGACY` `ADAPTER_SPECIFIC` | robo/AGENT.md is a full Linear-driven autonomous orchestrator (control loop over Linear) `DOC` — contradicts §2.3, §2.5 (workers don't orchestrate; Gorp owns topology) | Mark `LEGACY`; these are Claude-Code runtime artifacts, not canonical persona authority (gorp `personas/*` is canonical) |
| `.claude/skills/{dispatch,handoff,sprint,verify}/SKILL.md` | guava-os | Claude-Code skills | `LEGACY` `ADAPTER_SPECIFIC` | Linear/dispatch workflow | Mark `LEGACY` |
| `.claude/settings.json` | guava-os | Claude-Code hooks | `ADAPTER_SPECIFIC` | Prettier + destructive-git guards | Retain as runtime-adapter config (Claude Code) |
| `.claude/projects/-Users-sebastianrodriguez-Projects-ROUTINEME/memory/MEMORY.md` | guava-os | Stale machine-specific memory | `STALE` | Path from a prior machine/user; references tmux/dispatch `CODE` | **Remove after proving no live references** (directive A4) — reference check below |

---

## 2. Conflicting Sources of Truth (the material ones)

1. **Execution authority:** `guava-os/CLAUDE.md` + `.claude/agents/robo/AGENT.md`
   (Linear is truth) **vs** approved decision (Gorp-native persisted graph is
   truth, §2.2). → Linear docs demoted to `LEGACY`/`ADAPTER_SPECIFIC`.
2. **Canonical specs vs project copies:** gorp `specs/*` **vs**
   `guava-os/.gorp/specs/*` (drifted duplicates). → `DUPLICATE`, reference
   canonical.
3. **Persona authority:** gorp `personas/*.md` (canonical, flat) **vs**
   `guava-os/.claude/agents/*/AGENT.md` (Claude-Code dir form, Linear-coupled).
   Unresolved per migration-notes #3. → AGENT.md = `LEGACY` runtime artifacts.
4. **Doctrine copies:** gorp `doctrine/*` **vs** `guava-os/.gorp/process/*`
   (drifted). → `DUPLICATE`.
5. **Orchestration model:** gorp `reference/architecture.md` + `dispatch.sh`
   (Claude-Code wave dispatch) **vs** approved runtime-neutral orchestrator in
   Gorp (§2.5). → architecture.md + dispatch.sh = `LEGACY`.
6. **Roadmap authority:** `improvements/roadmap/HERMES-BOOTSTRAP.md`
   (Hermes-first cockpit) **vs** `ROADMAP.md` (Hermes-last).
   → HERMES-BOOTSTRAP superseded.

## 3. Docs that describe unimplemented features as if they exist

- `gorp/reference/architecture.md` — presents worktree isolation, parallel
  dispatch, QA validation, blocker escalation as operational. **None exist as
  code** (audit §4). → `LEGACY`, must carry a `TARGET/LEGACY` label.
- `gorp/README.md` — implies a working dispatch/runtime doctrine.
- `guava-os/CLAUDE.md` / `robo/AGENT.md` — describe autonomous promotion,
  reclamation, cascade as if live; the classifier is **read-only** (audit §2,
  §8). → labels required.
- `improvements/proposals/gorp-launch-contract.md` — tmux launch lifecycle
  (spec-only). Already under `improvements/` (correctly non-authoritative), but
  should carry an explicit `PROPOSAL` banner.

## 4. Docs that remain accurate and should be retained as-is

- `gorp/migration-notes.md` (honest historical record).
- `gorp/runtime/adapters/CONTRACT.md`, `runtime/loader/RESOLUTION-SPEC.md`,
  `specs/resolved-context-contract.md` + schema, `metadata/PROJECT-METADATA-SPEC.md`,
  `registry/PROJECTS-SCHEMA.md`, `improvements/README.md`,
  `improvements/runtime/PRODUCTION-ADAPTER.md` — all source-neutral and matched
  by code/tests. These are the load-bearing foundation.

## 5. Stale machine-specific reference check (for A4 safe-removal)

- Target: `guava-os/.claude/projects/-Users-sebastianrodriguez-Projects-ROUTINEME/memory/MEMORY.md`.
- Content scan for live references: the stale `sebastianrodriguez` path appears
  **only** in the directory name itself; no other doc, code, test, generator, or
  config references this path (`grep` across all three repos returned no content
  hits) `CODE`.
- **Disposition:** safe to remove — BUT the directive authorizes documentation
  changes only and removal of a `.claude/` file touches a runtime-adapter
  artifact. **Recommended action deferred to Stage 0 execution** with a one-line
  operator confirmation; this map records it as `STALE, safe-to-remove, no live
  references (NOT VERIFIED against any uncommitted local Claude state outside the
  repo)`.

---

## 6. Net Required Actions (rollup)

- **Rewrite (docs):** gorp `README.md`; guava-hermes `README.md`.
- **Label LEGACY + supersession note:** gorp `reference/architecture.md`,
  `reference/kit-readme.md`, `improvements/roadmap/HERMES-BOOTSTRAP.md`,
  `templates/gorp/plans/current-sprint.md`; guava-os `.claude/agents/*`,
  `.claude/skills/*`.
- **Label DEPRECATED (Linear-as-authority):** guava-os `CLAUDE.md` execution
  section, `.gorp/overlays/conventions.overlay.md` Linear wording.
- **Quarantine:** gorp `playbooks/dispatch.sh` (`DEPRECATED` header; disable-use
  guard planned in roadmap Stage 0 — no behavior change now).
- **Deprecate → reference canonical (duplicates):** guava-os `.gorp/process/*`,
  `.gorp/specs/*`, `.guava-os/specs/*` copies.
- **Reconcile → source-neutral (canonical specs):** gorp `specs/graph-semantics.md`,
  `specs/execution-state-machine.md`, `specs/execution-report-contract.md`
  (Linear leakage) — **via the roadmap, not by editing runtime-referenced specs
  in this directive** (they are consumed by code/tests; see §7 note below).
- **Retain unchanged:** the accurate-doc set in §4 above.

### §7 caveat on editing specs during this directive

The directive authorizes documentation edits but forbids changing schemas,
tests, or generated files, and forbids breaking a runtime path that depends on a
doc. `specs/graph-semantics.md` etc. are referenced by the generated AGENTS.md
"References" block and by tests. Therefore, in Phase D I add **supersession /
classification banners** to these specs (documentation) and record the
source-neutral reconciliation as **roadmap Stage 1/2 work** — I do **not**
rewrite their normative Linear content in this directive, to avoid desyncing
code/tests/generated fixtures. This is called out again in the change report.
