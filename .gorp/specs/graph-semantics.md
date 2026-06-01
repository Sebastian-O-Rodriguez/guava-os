# Graph Semantics

Defines node types, edge types, and structural invariants for the execution graph.

## Node Types

| Type | Identity | Detection | Execution Role |
|------|----------|-----------|---------------|
| Parent Issue | Linear issue referenced by ≥1 sub-issue via `parentId` | Check: any issue in dataset has `parentId` pointing to this issue | Container. Never executable. Lifecycle derived from subtask states. |
| Sub-Issue | Linear issue with `parentId` set | Check: `issue.parentId` is non-null | Executable unit. Classified into Guava OS states. |
| Standalone Issue | No `parentId`, not referenced as parent by any other issue | Residual — no sub-issues point to it AND it has no `parentId` | Outside execution graph. Reported but not classified. |

### Detection Rules

Parent/sub-issue relationships are derived from Linear's native `parentId` field.

- An issue is a **sub-issue** if `issue.parentId` is set (non-null/non-empty).
- An issue is a **parent** if any other issue in the dataset has `parentId` equal to this issue's `id`.
- An issue with no `parentId` and no children is **standalone**.
- No title, description, or naming convention heuristics are used.
- Detection requires the full issue dataset for the project. Partial datasets may produce orphan sub-issues (sub-issue whose parent is not in the dataset).

## Edge Types

| Edge | From → To | Meaning | Source | Available |
|------|-----------|---------|--------|-----------|
| `parent_of` | Parent → Sub-Issue | Structural containment | Linear `parentId` field | Always |
| `blocks` | Issue → Issue | Execution dependency — blocked issue cannot be EXECUTABLE until blocker is DONE | Linear blocking relation | Phase 2 |
| `persona_assignment` | Sub-Issue → Persona | Execution routing — determines which agent queue receives the sub-issue | Linear label matched against `config.labels` | Always |

### Persona Assignment Rules

1. Persona is derived from Linear labels matching `config.labels.persona_labels` or `config.labels.qa_label`.
2. Exactly one persona label is required per sub-issue for it to be executable.
3. Zero persona labels → INVALID (violation V400: `missing_persona_label`).
4. Multiple persona labels → INVALID (violation V401: `multiple_persona_labels`).
5. Persona label not in config → not matched (treated as non-persona label, ignored).
6. Non-persona labels (Feature, Bug, Improvement) are ignored by the runtime.

### Dependency Rules (Phase 2)

1. A `blocks` edge means the blocked issue cannot enter EXECUTABLE state until the blocker reaches DONE.
2. Dependency is directional: A blocks B does not mean B blocks A.
3. Transitive blocking: if A blocks B and B blocks C, then C is blocked until both A and B are DONE.
4. Dependency cycles (A blocks B blocks A) are violation V300: `dependency_cycle`. Detected by graph traversal. Escalated — cannot be resolved by automation.

## Structural Invariants

| # | Invariant | Enforced By | Violation Code |
|---|-----------|-------------|---------------|
| G1 | Every sub-issue has exactly one parent | Linear data model (parentId is singular) | V302 if parent not found in dataset |
| G2 | Parents are containers — never executable by builders | State derivation excludes parents from persona queues | V100 if builder claims parent |
| G3 | Every executable sub-issue has exactly one persona label | Persona assignment rules above | V400, V401 |
| G4 | Dependency edges must not form cycles | Graph cycle detection (Phase 2) | V300 |
| G5 | A sub-issue's parent must exist in the project dataset | Parent lookup during graph build | V302 if orphan |
| G6 | Active parent statuses are configurable | `config.active_parent_statuses` | V303 if parent status not in active set |

## Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Report standalone issues separately? | **Yes, but as informational only.** Not in any execution category. | Standalone issues may be sprint umbrellas or tracking items. Reporting them avoids silent data loss. |
| Cross-project dependencies? | **Out of scope.** Guava OS operates within a single Linear project. | Multi-project adds complexity with no current need. Config is per-project. |
| Distinguish "blocks" vs "relates to"? | **Only `blocks` is semantically meaningful.** "Relates to" is informational, not enforced. | The runtime only cares about execution ordering. |
