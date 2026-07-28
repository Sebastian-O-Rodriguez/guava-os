---
name: sprint
description: Sprint planning/execution — governed by the Gorp control plane (see body).
---

## Sprint

Sprint planning and execution are governed by the **Gorp control plane**, not by
this skill and not by any issue tracker. A sprint is an operator-approved sprint
document consumed by `gorp plan` (→ draft graph → operator approval →
`gorp orchestrate` → review → `gorp promote`).

Canonical references (never copy here). Authority order: the four Gorp
source-of-truth docs (`~/dev/gorp/VISION.md`, `SYSTEM-MODEL.md`,
`CURRENT-STATE.md`, `ARCHITECTURAL-INVARIANTS.md`) → contracts and tests →
project docs. This skill is a tool adapter; Gorp wins on conflict.

- Control-plane runtime — `~/dev/gorp/runtime/control/README.md`
- Sprint contract — `~/dev/gorp/specs/runtime/sprint.schema.json`
