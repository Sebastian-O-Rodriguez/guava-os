---
name: handoff
description: "Read/write session handoff notes — the Linear issue + comment thread is the state of record."
domain: pm
role: manager
order: 6

metadata:
  author: guava-os
  version: "0.2.0"
---

## Session Handoff

The authoritative workflow state is the **Linear issue + its comment thread**.
Read it with `pm get-issue <id>`; write results with `pm comment` + `pm move`
(via the `linear` skill). Handoff notes are non-authoritative continuity only.

Canonical reference: `docs/architecture/linear-conventions.md`. Authority:
`ADR_001.md` → `docs/architecture/guava-os-operating-contract.md`.

## Uses

- `pm get-issue <id>` — authoritative issue state + handoff record
- `pm comment` / `pm move` — write results (via the `linear` skill)
- Session notes — non-authoritative continuity only
