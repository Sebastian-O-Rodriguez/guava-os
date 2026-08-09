# Migration Notes — Canonical Gorp Build (v1)

Record of the initial build of `~/dev/gorp`. This was a **build**, not a
migration: source repositories were read only and **not modified**, nothing was
deleted, and no consumers were migrated.

- **Build date:** 2026-06-18
- **Sources (read-only):**
  - `~/dev/repos/guavabi/gorp-kit`
  - `~/dev/repos/guava-os` (`.gorp/specs`, `.guava-os/specs`)

## Files imported

### From `guavabi/gorp-kit` → canonical

| Source | Destination |
|--------|-------------|
| `templates/gorp/process/agent-protocol.md` | `doctrine/agent-protocol.md` |
| `templates/gorp/process/approval-matrix.md` | `doctrine/approval-matrix.md` |
| `templates/gorp/process/conventions.md` | `doctrine/conventions.md` |
| `templates/gorp/process/gotchas.md` | `doctrine/gotchas.md` |
| `templates/agents/architect.md` | `personas/architect.md` |
| `templates/agents/backend.md` | `personas/backend.md` |
| `templates/agents/frontend.md` | `personas/frontend.md` |
| `templates/agents/qa.md` | `personas/qa.md` |
| `templates/agents/robo.md` | `personas/robo.md` |
| `templates/scripts/dispatch.sh` | `playbooks/dispatch.sh` |
| `templates/scripts/quality-gate.sh` | `playbooks/quality-gate.sh` |
| `templates/scripts/validate-journal.sh` | `playbooks/validate-journal.sh` |
| `templates/gorp/prompts/dispatch.md.tmpl` | `playbooks/prompts/dispatch.md.tmpl` |
| `reference/architecture.md` | `reference/architecture.md` |
| `reference/directory-structure.md` | `reference/directory-structure.md` |
| `reference/patterns.md` | `reference/patterns.md` |
| `BOOTSTRAP.md` | `reference/bootstrap.md` |
| `README.md` | `reference/kit-readme.md` (preserved; root README.md is newly authored) |
| `templates/CLAUDE.md.tmpl` | `templates/CLAUDE.md.tmpl` |
| `templates/Justfile` | `templates/Justfile` |
| `templates/ci/ci.yml` | `templates/ci/ci.yml` |
| `templates/ci/cd.yml` | `templates/ci/cd.yml` |
| `templates/config/env.example` | `templates/config/env.example` |
| `templates/config/gitignore` | `templates/config/gitignore` |
| `templates/config/npmrc` | `templates/config/npmrc` |
| `templates/config/settings.json` | `templates/config/settings.json` |
| `templates/config/settings.local.json` | `templates/config/settings.local.json` |
| `templates/docker/docker-compose.yml` | `templates/docker/docker-compose.yml` |
| `templates/docker/preflight-compose.sh` | `templates/docker/preflight-compose.sh` |
| `templates/gorp/plans/current-sprint.md` | `templates/gorp/plans/current-sprint.md` |
| `templates/gorp/plans/roadmap.md` | `templates/gorp/plans/roadmap.md` |

### From `guava-os` → `specs/` (execution/review contracts)

| Source | Destination |
|--------|-------------|
| `.gorp/specs/graph-semantics.md` | `specs/graph-semantics.md` |
| `.gorp/specs/violation-codes.md` | `specs/violation-codes.md` |
| `.gorp/specs/execution-state-machine.md` | `specs/execution-state-machine.md` |
| `.gorp/specs/claim-leases.md` | `specs/claim-leases.md` |
| `.guava-os/specs/execution-report.schema.json` | `specs/execution-report.schema.json` |
| `.guava-os/specs/execution-report-contract.md` | `specs/execution-report-contract.md` |

### From `guava-os` → `improvements/proposals/` (NOT promoted to specs/)

| Source | Destination |
|--------|-------------|
| `.guava-os/specs/gorp-launch-contract.md` | `improvements/proposals/gorp-launch-contract.md` |
| `.guava-os/specs/mutation-journal.md` | `improvements/proposals/mutation-journal.md` |
| `.guava-os/specs/doctor-local-only-proposal.md` | `improvements/proposals/doctor-local-only-proposal.md` |
| `.guava-os/specs/unified-check-proposal.md` | `improvements/proposals/unified-check-proposal.md` |

## Files intentionally excluded

Per the directive's import rules (no project state):

- `guavabi/.gorp/journal/*` — agent activity logs (project state).
- `guavabi/.gorp/plans/*` (current-sprint, roadmap, sprints/*) — project state.
  *(Canonical equivalents are the empty scaffolding templates under
  `templates/gorp/plans/`.)*
- `guavabi/.gorp/process/*` and `guavabi/.gorp/prompts/*` — these are the
  **deployed** copies, which have drifted from the gorp-kit templates. The
  canonical doctrine was taken from `gorp-kit` (the templates), not from the
  drifted deployed copies. See "Unresolved decisions".
- `guava-os/.gorp/archive/*` — explicitly dead/obsolete per guava-os authority
  hierarchy.
- `guava-os/.gorp/process/*` — drifted deployed copies (not canonical source).

## Proposal / spec files not promoted

The following were imported to `improvements/proposals/` rather than `specs/`,
because they are spec-only/unbuilt or tool-specific, not canonical contracts:

- `gorp-launch-contract.md` — Phase 2A spec only; no implementation. Whether the
  tmux/launch contract is still the intended runtime model is **undecided**.
- `mutation-journal.md` — Phase 2A spec only; no storage backend.
- `doctor-local-only-proposal.md` — proposal for a guava-os CLI flag (tool-level,
  not global doctrine).
- `unified-check-proposal.md` — proposal for a `guava-os check` command
  (tool-level, not global doctrine).

## Unresolved decisions (require human review)

1. **Doctrine drift not reconciled.** The canonical `doctrine/` process docs come
   from gorp-kit templates. The deployed copies in `guavabi/.gorp/process/` and
   `guava-os/.gorp/process/` have drifted (confirmed: distinct checksums). Any
   intentional deltas in those deployed copies (e.g. guavabi trust-boundary
   rules) were **not** merged here and should be triaged via `improvements/`
   before consumers migrate. This build deliberately did not invent a merged
   version.
2. **`runtime/` is empty by design.** No runtime hooks were imported as canonical
   runtime. `templates/config/settings.json` (the Claude Code scope/git hooks)
   was imported only as project-init scaffolding under `templates/`. Whether a
   canonical `runtime/settings.json` and `runtime/policies/` should exist is left
   open.
3. **Persona format.** Canonical personas are flat `.md` files (gorp-kit form).
   Several consuming repos use the `agents/<name>/AGENT.md` directory form. The
   canonical/consumer format reconciliation is deferred to migration time.
4. **`tools/` is empty.** The guava-os CLI is expected to land here later; not
   part of this build.

## Notes

- Empty scaffold directories contain a `.gitkeep` so the structure is tracked.
- No remotes, no submodules, no consumer migration, no runtime/OMP/Hermes/MCP/
  secret setup were performed, per the directive.
