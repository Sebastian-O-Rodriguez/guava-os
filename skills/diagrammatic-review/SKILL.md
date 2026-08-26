---
name: diagrammatic-review
description: "Audit a document's spatial structure against diagrammatic-writing criteria: does the layout (hierarchy, position, proximity) carry or contradict the argument? Use to review docs, plans, reports, and indexes."
domain: core
role: any
order: 7

metadata:
  author: guava-os
  version: "0.1.0"
---

## Diagrammatic Review

Judge whether a document's mise-en-page (spatial arrangement) is doing work or
fighting it. Drucker's criterion: form and content are one — a layout that
contradicts its argument is a defect, not a style choice.

## Criteria

- **Hierarchy carries rank** — do headings/nesting match logical importance, or
  are coequal ideas stacked under unrelated parents?
- **Proximity = relation** — related items adjacent, unrelated items separated?
- **Position is deliberate** — is each placement a meaning (above = rank,
  next-to = peer, support = contain) or arbitrary?
- **No orphans** — any block with no named relation to its neighbors?
- **One move per relationship** — is any element trying to be two things?
- **Linear vs spatial coherence** — does reading top-to-bottom tell the same
  story the layout implies, or do they conflict?

## Verdict

Report per document:

- `pass` — layout supports the argument, or
- a finding list: `section / element` + the violated criterion + the concrete
  re-placement (what moves where and why).

Be specific. Never say "restructure" without naming the moves.