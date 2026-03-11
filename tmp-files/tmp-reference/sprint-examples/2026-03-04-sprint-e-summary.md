# Sprint Report — Phase E: UI Meaning (P0-P3)

**Date:** 2026-03-04
**Sprint Goal:** Turn raw config-dashboard into immediately understandable view
**Status:** 6/7 tasks complete (E-7 QA deferred to manual validation)

---

## Tasks Completed

| ID | Task | Agent Session | Status |
|----|------|---------------|--------|
| E-1 | Enrich view data with parsed fields | `e1-enrich-view` (pmlad-api) | Done |
| E-2 | Semantic grouping by reason | `e2-semantic-grouping` (pmlad-web) | Done |
| E-3 | Reason badges inline | `e3-reason-badges` (pmlad-web) | Done |
| E-4 | Deduplication of identical items | `e456-ui-polish` (pmlad-web) | Done |
| E-5 | Action-oriented group headers | `e456-ui-polish` (pmlad-web) | Done |
| E-6 | Tailwind + dark mode + responsive | `e456-ui-polish` (pmlad-web) | Done |
| E-7 | QA validation (2-min demo) | — | Pending (needs Docker) |

## Files Changed (2 files, +304/-71 lines)

- `apps/api/src/ui/ui.service.ts` — Title parsing: extracts `invoiceNumber`, `location`, `reason`
- `apps/web2/components/config-driven/ConfigRenderer.tsx` — Full UI overhaul

## What Was Built

### Backend (E-1)
- Parse structured title (`"Invoice #1234 - Location - Reason"`) into 3 fields
- Graceful null fallback for non-standard titles
- No new endpoints, no schema changes

### Frontend (E-2 through E-6)
- **Grouped view**: Work items grouped by reason, sorted by count (biggest problem first)
- **Collapsible groups**: Click to expand/collapse each reason group
- **Reason badges**: Color-coded pills (red=error, amber=approval, blue=dispute)
- **Action framing**: Headers read as actions ("2 invoices need Finance approval")
- **Deduplication**: Identical items collapsed with expand to view details
- **Dark mode**: Full dark: class support throughout
- **Responsive**: Grid layout adapts to screen size
- **Tailwind migration**: All inline styles converted to utility classes

## Quality Gates

| Gate | Result |
|------|--------|
| Lint | 0 errors, 13 warnings (pre-existing) |
| Build | Not tested (deferred to E-7) |
| Tests | Pre-existing failures in als.interceptor.spec.ts (DI issues, not related) |

## Blockers Encountered

1. **Agent import regression**: E-1 agent converted `import { PrismaService }` to `import type { PrismaService }` across 26 files, breaking NestJS DI. Reverted immediately. Root cause: aggressive lint auto-fix by agent.
2. **OpenCode send_keys**: MCP `send_keys` tool doesn't use `-l` flag for tmux, so literal text wasn't being received by the TUI. Workaround: use `tmux send-keys -l` directly via bash.

## Observations for Next Sprint

- Agents editing the same file should be serialized or combined into one session
- Agent scope should be explicitly constrained — the E-1 agent modified 26+ files beyond its scope
- OpenCode via OpenRouter works but is slower than expected (~2-5 min per task)
- E-7 QA needs Docker compose + browser — recommend manual or dedicated QA session
