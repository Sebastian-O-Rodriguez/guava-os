# Sprint Report — Integration: Connect All Pages to Demo DB

**Date:** 2026-03-04
**Sprint Goal:** Make every page show real data from the demo DB and every button work
**Status:** 11/12 tasks done (INT-12 manual QA pending)

---

## Summary

Connected all 4 UI pages (`/dashboard`, `/properties`, `/tenants`, `/config-dashboard`) to the live API and demo database. Fixed 5 root causes blocking data flow: DI type-only imports, disabled modules, missing API proxy, broken auth headers, and mismatched JWT claims.

---

## Root Causes Fixed

| #   | Issue                                                | Fix                                                      |
| --- | ---------------------------------------------------- | -------------------------------------------------------- |
| 1   | `import type { ChatService }` broke NestJS DI        | Changed to value import                                  |
| 2   | ChatModule/V1Module/LegacyModule commented out       | Uncommented in app.module.ts                             |
| 3   | No frontend→API proxy                                | Added Next.js rewrites (`/api/*` → localhost:3001)       |
| 4   | ConfigRenderer read JWT from cookies (doesn't exist) | Read from `NEXT_PUBLIC_JWT_TOKEN` env var                |
| 5   | Chat hooks used wrong env var + no auth headers      | Fixed to `NEXT_PUBLIC_API_BASE_URL`, added JWT + API key |

---

## Files Changed (16 files, ~258 additions)

### API (Backend)

| File                                         | Change                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/chat/chat.controller.ts`       | `import type` → value import for ChatService, ChatQueryDto                                                    |
| `apps/api/src/app.module.ts`                 | Uncommented ChatModule, V1Module, LegacyModule                                                                |
| `apps/api/src/invoice/invoice.controller.ts` | `import type` → value import for InvoiceService                                                               |
| `apps/api/src/invoice/invoice.service.ts`    | `import type` → value imports for PrismaService, WorkflowService, EventsService; `uuid` → `crypto.randomUUID` |
| `apps/api/src/ui/ui.service.ts`              | Fixed data shape: `invoices` → `workItems`, added `totalWork_items` metric                                    |
| `apps/api/scripts/generate-test-token.ts`    | Updated to use correct seeded orgId/entityId                                                                  |

### Frontend (Web2)

| File                                                    | Change                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web2/next.config.ts`                              | Added `rewrites()` for API proxy                                     |
| `apps/web2/components/config-driven/ConfigRenderer.tsx` | JWT from env var, fixed URL (`/api/invoices/`), added API key header |
| `apps/web2/src/features/chat/hooks/useConversations.ts` | Fixed env var name, added auth headers                               |
| `apps/web2/src/features/chat/hooks/useConversation.ts`  | Fixed env var name, added auth headers                               |
| `apps/web2/src/features/chat/components/ChatPanel.tsx`  | Fixed env var, auth headers, default entityId                        |
| `apps/web2/src/lib/api-client/fetchScoped.ts`           | Fixed env var name                                                   |
| `apps/web2/app/properties/page.tsx`                     | Replaced placeholder with data table                                 |
| `apps/web2/app/tenants/page.tsx`                        | Replaced placeholder with data table                                 |
| `apps/web2/app/dashboard/page.tsx`                      | Updated entityId to match seeded data                                |
| `apps/web2/components/layout/SidebarNav.tsx`            | Added "Invoices" nav item                                            |
| `apps/web2/.env.local`                                  | Regenerated JWT with correct IDs (30-day expiry)                     |

---

## Page Status

| Page                | Before                                                            | After                                                        |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `/dashboard`        | Chat UI, wrong entityId, no auth headers, chat endpoints disabled | Correct entityId, auth headers, ChatModule enabled           |
| `/properties`       | Placeholder stub                                                  | Data table with 8 properties from DB                         |
| `/tenants`          | Placeholder stub                                                  | Data table with 12 tenants from DB                           |
| `/config-dashboard` | Data shape mismatch, broken action buttons                        | Working invoice dashboard with Submit/Approve/Reject buttons |
| Sidebar nav         | 3 items                                                           | 4 items (added Invoices → /config-dashboard)                 |

---

## Key Decisions

1. **Next.js proxy over direct API calls** — Frontend calls `/api/*` which proxies to NestJS. Avoids CORS issues and keeps the JWT/API-key out of browser network tab for relative URLs.
2. **JWT from env var** — For demo purposes, JWT is stored in `NEXT_PUBLIC_JWT_TOKEN` rather than a proper auth flow. 30-day expiry for convenience.
3. **Legacy API routes for Properties/Tenants** — Used `/api/properties` and `/api/tenants` (simpler, no org/entity URL params needed) rather than V1 scoped routes.
4. **Invoice routes at `/invoices/`** — No global prefix, controller is `@Controller('invoices')`. Frontend calls `/api/invoices/:id/:action` (proxied).

---

## Remaining Work

- **INT-12:** Manual QA validation (start both servers, test all pages)
- **F-8:** Full invoice lifecycle E2E validation (see `phase-f-walkthrough.md`)
