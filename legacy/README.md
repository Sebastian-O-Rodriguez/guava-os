# ⛔ legacy/ — DO NOT USE

Archived **duplicated Gorp docs** — local copies of content that is canonical in
the Gorp repository. They are **`LEGACY - DO NOT USE`**: retained for history
only, not authoritative, not maintained (internal links may be stale). No
current doc references this directory.

- `guava-os-specs/` — copies of Gorp `specs/` and `improvements/proposals/`
  (execution-report contract + schema, gorp-launch-contract, mutation-journal,
  unified-check-proposal, doctor-local-only-proposal). Canonical versions live
  in Gorp.

This repo consumes Gorp by reference through its binding (`.gorp/gorp.yml`). For
governance read Gorp directly: `~/dev/gorp/README.md`,
`~/dev/gorp/reference/architecture.md`, `~/dev/gorp/ROADMAP.md`,
`~/dev/gorp/runtime/adapters/CONTRACT.md`.

> Note: `.gorp/process/` and `.gorp/specs/` are **retained in place**, not
> archived — the project's `conventions.overlay.md` declares them protected
> project material and the `.guava-os` doctor CLI checks their presence.
