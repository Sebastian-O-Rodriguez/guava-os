---
name: handoff
description: Read/write session handoff notes for continuity — non-authoritative; state lives in gorp's persisted graph.
---

## Session Handoff

Session-continuity notes only. Do **not** derive execution state from handoff notes or any issue tracker — the authoritative state is gorp's persisted execution graph and audit records.

Inspect real state with `gorp inspect`. Canonical reference (never copy here): `gorp/runtime/control/README.md`. Authority: `ADR_001.md` > `docs/architecture/guava-os-gorp-contract.md` > gorp docs.

## Uses

- `gorp inspect` — authoritative execution state (read-only)
- Session notes — non-authoritative continuity only
