# Reconciliation Change Report

Directive: *Reconcile Deprecated Architecture, Update Documentation, and Produce
the Launch Roadmap* (2026-07-14). Documentation + planning only; **no runtime
implementation began.** This report satisfies Deliverable §9.5 and Completion
Criteria §10.

---

## 1. Files Changed

### New artifacts (in `~/dev/repos/`, outside the three repos)
- `DOCUMENTATION-AUTHORITY-MAP.md` — created (Phase B).
- `ROADMAP.md` — created (Phase C + §4/§5).
- `CURRENT-REALITY-AUDIT.md` — amended (Phase A): top banner + new
  **§17 Reconciliation Amendments (A1–A4)**.
- `RECONCILIATION-CHANGE-REPORT.md` — this file.

### gorp (7 files, docs/banners only)
- `README.md` — status banner correcting Claude-Code/Linear/markdown framing,
  dispatch.sh deprecation, real runtime status.
- `reference/architecture.md` — `LEGACY`/superseded banner.
- `improvements/roadmap/HERMES-BOOTSTRAP.md` — `LEGACY`/`PROPOSAL` superseded banner.
- `templates/gorp/plans/current-sprint.md` — `LEGACY`/non-authoritative banner.
- `specs/graph-semantics.md` — `ADAPTER_SPECIFIC` (Linear) reconcile banner (body unchanged).
- `specs/execution-state-machine.md` — `ADAPTER_SPECIFIC` (Linear) reconcile banner (body unchanged).
- `playbooks/dispatch.sh` — `DEPRECATED`/quarantine **comment** banner
  (behavior unchanged; `bash -n` passes; use-guard deferred to Stage 0).

### guava-hermes (1 file)
- `README.md` — role-clarification banner (integration/entry point, not
  orchestrator/authority; Hermes replaceable).

### guava-os (7 files, docs/banners only)
- `CLAUDE.md` — partial-deprecation banner (Linear-as-authority `DEPRECATED`;
  identity/stack retained). Verified: generated AGENTS.md did **not** drift.
- `.gorp/process/agent-protocol.md` — `DUPLICATE`/`DEPRECATED` banner.
- `.gorp/specs/graph-semantics.md` — `DUPLICATE`/`DEPRECATED` banner.
- `.gorp/specs/execution-state-machine.md` — `DUPLICATE`/`DEPRECATED` banner.
- `.gorp/specs/violation-codes.md` — `DUPLICATE`/`DEPRECATED` banner.
- `.gorp/specs/claim-leases.md` — `DUPLICATE`/`DEPRECATED` banner.
- `.claude/agents/robo/AGENT.md` — `LEGACY`/`ADAPTER_SPECIFIC` banner.

**No** schema, test, TypeScript, JSON, YAML, config, git-hook, or generated file
was modified (verified by filtered `git status`).

## 2. Documents Marked Legacy / Deprecated

- `LEGACY` (superseded, retained for history): gorp `reference/architecture.md`,
  `reference/kit-readme.md` (classified; banner pending — see Residual §8),
  `improvements/roadmap/HERMES-BOOTSTRAP.md`,
  `templates/gorp/plans/current-sprint.md`; guava-os `.claude/agents/robo/AGENT.md`
  (representative; other `.claude/agents/*` + `.claude/skills/*` classified LEGACY
  in the authority map, banners pending — Residual §8).
- `DEPRECATED` (authority removed): gorp `playbooks/dispatch.sh` (quarantined);
  guava-os `CLAUDE.md` Linear-authority section; `.gorp/process/agent-protocol.md`;
  `.gorp/specs/{graph-semantics,execution-state-machine,violation-codes,claim-leases}.md`.
- `ADAPTER_SPECIFIC` (Linear, to be reconciled): gorp
  `specs/{graph-semantics,execution-state-machine}.md` (banners added);
  `specs/claim-leases.md`, `specs/execution-report-contract.md` (classified;
  banners pending — Residual §8).

## 3. Canonical Documents Created / Updated / Confirmed

- **Created (authoritative planning set):** `DOCUMENTATION-AUTHORITY-MAP.md`,
  `ROADMAP.md` (the roadmap §5/§7 defines the canonical
  documentation & schema hierarchy required by Phase C — sprint/task/graph/state/
  report/review/promotion/run schemas + orchestrator/worker/sandbox/validation/
  review/promotion/run-record contracts).
- **Confirmed canonical & accurate (retained unchanged):**
  gorp `migration-notes.md`, `runtime/adapters/CONTRACT.md`,
  `runtime/loader/RESOLUTION-SPEC.md`, `specs/resolved-context-contract.md` +
  `.schema.json`, `metadata/PROJECT-METADATA-SPEC.md`, `registry/PROJECTS-SCHEMA.md`,
  `improvements/README.md`, `improvements/runtime/PRODUCTION-ADAPTER.md`.

## 4. Verification Performed (directive §7)

1. Re-ran all gorp tests (`test-loader`, `test-generator`, `test-local-adapter`,
   `validate-gorp`) → **all PASS** after edits. `TEST`
2. Re-ran guava-os `npx vitest run` → **91 tests, 4 files, PASS** after edits. `TEST`
3. Git status of all three repos confirmed → only the documentation files above
   are modified; nothing else. `TEST`
4. Documentation references affected by deprecation verified: banners cross-link
   to the authoritative docs; Linear/markdown/dispatch signals mapped in
   `DOCUMENTATION-AUTHORITY-MAP.md §1–§3`.
5. Confirmed **no current runtime path depends on a document marked for removal**:
   nothing is removed in this directive (dispositions are quarantine/deprecate/
   reference-then-remove-later). The quarantine banner on `dispatch.sh` is
   comment-only and it remains syntactically valid (`bash -n` OK). `CODE`
6. Confirmed **generated files not hand-edited**: regenerated guava-os
   `AGENTS.md` from live gorp == committed golden fixture (byte-identical); the
   `CLAUDE.md` banner did not drift generated output. `TEST`
7. Roadmap dependencies that are **currently only proposals** are flagged in
   `ROADMAP.md` (M1–M9 are all **create**; the reused inputs
   `PRODUCTION-ADAPTER.md`, `gorp-launch-contract.md`, `mutation-journal.md` are
   `PROPOSAL`; `CONTRACT.md`/resolved-context schema are the only implemented
   reusable contracts).
8. Unverified assumptions marked `NOT VERIFIED` (see §6 below).

**Side-effect handling (directive §7 tail):** during verification the local
adapter created a journal in guava-hermes and an earlier `routineme` registry
edit was present; both were **restored** before doc edits; the side-effect is
documented in the audit **§A2** (validator is actually clean; the real
side-effect is the adapter's journal write). No validator mutation was silently
ignored — it was investigated and **corrected** as a prior misattribution.

## 5. Unresolved Contradictions / Decisions Requiring Operator Approval

From roadmap §3 (unresolved) — these need an operator decision before the
corresponding stage:
- **U1** Persona format: canonical flat `personas/*.md` vs consumer
  `.claude/agents/*/AGENT.md`. (Blocks M4 persona wiring.)
- **U2** First orchestrator language/shape (bash+ruby vs typed module). Recommend
  bash+ruby in gorp. (Blocks M6.)
- **U3** Sprint/schema serialization (JSON Schema recommended). (Blocks M1.)
- **U4** Persisted-graph storage location (`guava-os/.gorp/graph/` vs gorp-side).
  (Blocks M2.)
- **U5** Removal of stale `.claude/.../ROUTINEME/memory/MEMORY.md` — one-line
  operator confirm (no live references found). `NOT VERIFIED` against local
  Claude state outside the repo.
- **U6** Reconciling Linear-coupled canonical specs to source-neutral form will
  change generated fixtures/tests — must be sequenced inside M1.

## 6. `NOT VERIFIED` Assumptions
- Provenance of the pre-existing uncommitted `routineme` registry entry (likely
  manual registration or an earlier deploy). `NOT VERIFIED`
- Absence of live references to the stale MEMORY.md path **outside** the three
  repos (e.g. a machine-local Claude Code state dir). `NOT VERIFIED`

## 7. Repository Status (final)
- `gorp`: 7 modified (docs/banners + 1 comment-only script banner). Tests green.
- `guava-hermes`: 1 modified (README banner).
- `guava-os`: 7 modified (docs/banners). Tests green. Generated AGENTS.md
  unchanged.
- All modifications are **intentional documentation changes**; no runtime,
  schema, test, or generated artifact altered. Nothing committed (left staged in
  working tree for operator review, per "await review before implementation").

## 8. Residual Documentation Work (deferred, low-risk, itemized)

To keep this pass surgical and reversible, banners were applied to the
**highest-signal representative** docs. The `DOCUMENTATION-AUTHORITY-MAP.md`
records the full disposition for every remaining item; banners still to add
(purely additive, no risk to runtime) in a follow-up doc pass or at Stage 0:
- gorp `reference/kit-readme.md`, `reference/directory-structure.md` LEGACY banners.
- gorp `specs/claim-leases.md`, `specs/execution-report-contract.md` adapter/reconcile banners.
- guava-os `.claude/agents/{architect,backend,frontend,qa}/AGENT.md`,
  `.claude/skills/{dispatch,handoff,sprint,verify}/SKILL.md` LEGACY banners.
- guava-os `.gorp/process/{approval-matrix,conventions}.md`,
  `.guava-os/specs/*` DUPLICATE banners; `.guava-os/docs/*` adapter notes.
- guava-os `.gorp/overlays/conventions.overlay.md` Linear-wording note.

These are classified and tracked; none is authoritative, so leaving them
un-bannered for one more pass does not create a new source-of-truth risk.

## 9. Completion Criteria Check (directive §10)
1. Linear no longer represented as authoritative execution model — **met**
   (audit §A1; guava-os `CLAUDE.md`, specs, agent banners).
2. Markdown sprint tables no longer authoritative — **met** (template + dispatch banners).
3. Gorp-native persisted graph authority documented — **met** (roadmap §2.2, M1/M2).
4. Repository responsibilities unambiguous — **met** (roadmap §5; audit §A3; READMEs).
5. Current vs target capabilities separated — **met** (audit §2/§14; roadmap §2 vs §7; labels).
6. Legacy documents marked and linked to replacements — **met** (banners cross-link; authority map).
7. Validator mutation documented — **met, and corrected** (audit §A2 — real
   side-effect is the adapter journal write; validator verified clean).
8. Roadmap defines one complete deterministic vertical slice — **met** (roadmap §8).
9. Every milestone has pass criteria and non-goals — **met** (roadmap §7).
10. Plan reaches isolated execution/validation/review/promotion/audit **before**
    Hermes — **met** (Stages 4–9 precede Stage 10).
11. All three repos clean except intentional documentation changes — **met**.
12. No runtime implementation begun — **met**.

**STOP.** Awaiting operator review/approval of the documentation changes and the
roadmap before any implementation (Stage 0 execution) starts.
