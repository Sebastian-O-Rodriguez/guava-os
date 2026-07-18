---
name: handoff
description: Read/write session handoff notes for continuity — non-authoritative; state lives in Gorp.
---

## Session Handoff

Session-continuity notes only. Do **not** derive execution state from handoff
notes or any issue tracker — the authoritative state is the Gorp control plane's
persisted execution graph and audit records.

Inspect real state with `gorp inspect`. Canonical reference (never copy here):
`~/dev/gorp/runtime/control/README.md`.
