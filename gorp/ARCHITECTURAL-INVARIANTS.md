# GOS Architectural Invariants

These rules are mandatory.

## Product

1. Projects are the primary unit of work.
2. GOS exists to build real projects.
3. Infrastructure work must support project delivery, governance, or capability compounding.
4. The system must improve through use, not through speculative framework construction.
4a. GOS composes existing tools; it does not rebuild what they already do well.

## Governance

5. guava-os owns governance decisions (planning, orchestration, review/promotion
   workflow, project registry, Linear); Gorp is the sole enforcement authority
   over execution (gates, hash binding, audit) and dispatches workers.
6. Workers execute. Workers do not approve or promote. Workers are OMP agents
   dispatched by Gorp via personas. Workers never fetch Linear.
7. Human review is required for global promotion.
8. Promotion must fail closed.
9. Governed records must remain auditable.
10. Nothing becomes global automatically.

## Capabilities

11. Global capabilities are reusable engineering assets.
12. Project context specializes capabilities locally.
13. Project-local context must not silently redefine global capability truth.
14. Reusable improvements must leave the project through a governed promotion lifecycle.
15. Every global capability improvement must carry evidence.
16. Capability history must be versioned and reviewable.

## Architecture
17. There is one enforcement engine (Gorp); engineering runtimes are composed
    behind its contracts, never duplicated inside it. guava-os owns decisions;
    Gorp owns enforcement.
18. There is one project identity model.
19. There is one scope-enforcement authority.
20. The Operator Interface remains thin.
21. Worker runtimes remain replaceable; no runtime is required by the
    architecture and none may be locked in.
22. Gorp must not depend on any specific engineering runtime (OMP or otherwise).
23. Projects must not contain independent or predecessor Gorp runtimes.
24. No critical system knowledge may exist only in a local runtime directory.
25. Duplicate sources of truth are defects.

## Documentation

26. Implemented behavior must match source documentation.
27. Planned behavior must be marked planned.
28. Missing behavior must be marked missing.
29. Empty scaffolding must not be presented as implemented.
30. Superseded documents must be deleted or explicitly marked superseded.
31. Status information belongs in one canonical current-state document.

## Operation

32. Project source must never be deleted as part of GOS cleanup.
33. Project repositories own their product code and local context.
34. GOS repositories own shared governance and capability infrastructure.
35. Real project operation is the primary validation method.
36. Every structural change must preserve the governed execution loop.
37. Critical commits and records must not exist only on one machine.

