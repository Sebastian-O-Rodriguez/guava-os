# GOS-19 — Linear Tooling Audit

> **Authority:** GOS-18 boundary, GOS-21 conventions. This audit is the
> evidence for the keep/extend/replace/remove decisions.

## Audit table

| Capability | Existing code | Disposition | Evidence |
|---|---|---|---|
| Fetch logic | none — CLI has no network layer | **fill gap** | `cli.ts` reads stdin only; `config.ts` has no fetch; no HTTP import anywhere |
| Dependency graph | `linear.ts` `buildGraph()` — builds parent/child + executable queue from `LinearIssue[]` | **keep** | Used by `status`, `validate`, `next`, `doctor`; tested in `runtime.test.ts` |
| Project queries | none | **fill gap** | No project lookup existed; added `getProject()` in `linear-client.ts` |
| Issue queries | none (only stdin-fed graph) | **fill gap** | Added `getIssue()` and `searchIssues()` in `linear-client.ts` |
| Create/update | none — CLI is read-only by design | **fill gap** | Added `createIssue()` and `updateIssue()` in `linear-client.ts` |
| Status | none — CLI classifies status from stdin data but cannot move it | **fill gap** | Added `moveStatus()` in `linear-client.ts` |
| Comments | none | **fill gap** | Added `createComment()` in `linear-client.ts` |
| Links | none — dependency relations are read-only in `buildGraph` | **fill gap** | Added `linkDependencies()` and `linkUrl()` in `linear-client.ts` |
| Assignments | none | **fill gap** | Added `assignIssue()` in `linear-client.ts` |

## Result

- **Keep:** `buildGraph()` (dependency graph) — reused unchanged by the PM
  commands; `get-sprint` fetches then feeds `buildGraph` for the classifier.
- **Extend:** `cli.ts` — added `pm` subcommand namespace dispatching to the
  nine operations + comments/links. Existing read-only commands untouched.
- **Replace:** none — existing classifier commands stay as-is.
- **Remove:** none — no existing code was deleted.
- **Fill:** all nine operations + comments + links implemented in
  `linear-client.ts` (the single Linear network layer).

## One supported interface

`linear-client.ts` is the one supported guava-os Linear interface. All Linear
network access is contained there; the CLI and future skills import from it;
agents prefer this module over Linear MCP. Linear only — no generic provider
abstraction.
