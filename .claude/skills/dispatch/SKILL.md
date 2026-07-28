---
name: dispatch
description: Task dispatch — governed by the Gorp control plane (see body).
---

## Dispatch

Task dispatch and execution are governed by the **Gorp control plane**, not by a
standalone skill and not by any issue tracker. Plan and run work through Gorp:

`gorp plan` → operator approval → `gorp orchestrate` → review → `gorp promote`.

Canonical references (never copy here). Authority order: the four Gorp
source-of-truth docs (`~/dev/gorp/VISION.md`, `SYSTEM-MODEL.md`,
`CURRENT-STATE.md`, `ARCHITECTURAL-INVARIANTS.md`) → contracts and tests →
project docs. This skill is a tool adapter; Gorp wins on conflict.

- Control-plane runtime — `~/dev/gorp/runtime/control/README.md`
