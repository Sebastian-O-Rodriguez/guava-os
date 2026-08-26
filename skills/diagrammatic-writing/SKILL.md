---
name: diagrammatic-writing
description: "Compose documents where spatial layout (hierarchy, margins, position, proximity) carries the argument, not just linear prose. Use for architecture docs, plans, reports, and any dense agent-authored document."
domain: core
role: any
order: 6

metadata:
  author: guava-os
  version: "0.1.0"
---

## Diagrammatic Writing

Write so the page's graphic structure encodes meaning, not just the words
(Johanna Drucker, *Diagrammatic Writing*). A document is a semantic field:
position, hierarchy, and proximity are part of the argument, never decoration.

## The moves (a bounded vocabulary)

Relate an element to its neighbors with one deliberate spatial move:

- `above` / `below` — rank, sequence, dependency
- `next to` — coordinate, peer, sibling
- `in front of` / `behind` — foreground vs background emphasis
- `embrace` / `surround` / `support` — containment, framing, definition
- `juxtapose` — contrast or compare without a connector
- `interlineate` — annotate between the lines of another block
- `attach` — bind a label/note to its referent

## Rules

- Pick exactly one move per relationship; left decorative, position misleads.
- Headings are nodes, not labels — the outline IS a diagram.
- Use indentation, margins, lists, tables, and whitespace before arrows or
  mermaid. ASCII/markdown structure is the first and cheapest diagram.
- Choose structure by shape: hierarchy → heading tree; matrix → table; genuine
  graph → mermaid; sequence → ordered list.
- No orphan elements: every block sits in a named relation to its neighbors.
- Break linear prose when the meaning is spatial — don't flatten a structure
  into a paragraph.

## Uses

- Architecture/ADR and planning documents
- Sprint plans, review reports, handoff notes
- Any document an agent authors for a human to *navigate*, not just read
- `skills.md` / `structure.md` style indexes and tables