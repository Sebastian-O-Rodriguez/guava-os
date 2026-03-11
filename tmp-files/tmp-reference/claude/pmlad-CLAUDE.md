# CLAUDE.md — PM Lad Codebase Rules

**Maintainer:** Sebastian Rodriguez, CTO, Guava AI Ltd.
**Updated:** 2026-03-10

For project overview and workspace layout, see the root [`CLAUDE.md`](../CLAUDE.md).
For process and conventions, see [`.shoal/project/process.md`](.shoal/project/process.md).

---

## Codebase

| Path | Purpose | Status |
|------|---------|--------|
| `apps/api` | Backend (NestJS + Prisma + PostgreSQL) | Active |
| `apps/web2` | Frontend (Next.js 15 + shadcn/ui + Tailwind v4) | Active (canonical) |
| `packages/types` | Canonical Zod schemas + OpenAPI bindings | Active |
| `packages/ui` | Legacy UI components + tokens | **Deprecated** (Phase 7a) |
| `packages/db` | Prisma client | Active |
| `packages/widgets` | Widget system (Tremor/Plot) | Active |

`apps/web` is deleted. Do not reference.

---

## Operating Principles

1. **Propose, don't execute.** Agents generate diffs under CTO supervision.
2. **Ask, don't assume.** Query the orchestrator before large-scope changes.
3. **Stay within scope.** Edit only assigned directories. Shared logic goes in `packages/`.
4. **Respect security boundaries.** Never read/modify `.env` or production credentials.
5. **Immutable contracts.** Schema/OpenAPI changes require `pnpm ci:openapi-diff` (drift = 0) + CTO approval.

---

## Coding Standards

| Category | Rule |
|----------|------|
| Formatting | Prettier + ESLint (strict TS) |
| Naming | Descriptive, domain-consistent |
| Types | Explicit, no `any`, Zod mirrors DTOs |
| Imports | Workspace aliases (`@pmlad/*`) |
| React | Functional, typed, pure |
| Errors | HTTP/Prisma pattern: 409, 404, 204 |

---

## Local Development

```bash
pnpm install
pnpm dev:api              # localhost:3001
pnpm dev:web              # localhost:3000

# Validation (all must pass before PR)
pnpm lint
pnpm test
pnpm build
pnpm ci:openapi-diff
```

Docker: `docker compose --env-file .env.compose up -d`

---

## Change Policy

| Category | Allowed | CTO Approval |
|----------|---------|-------------|
| Bug fixes, tests, refactors | Yes | No |
| Minor feature within module | Yes | No |
| New dependency | Needs approval | Yes |
| Schema / Prisma migration | Needs approval | Yes |
| CI / build pipeline change | Needs approval | Yes |
| Destructive data ops | No | N/A |

---

## Key Gotchas

- ESLint auto-converts `import { X }` to `import type { X }` — this **breaks NestJS DI**. Use `// eslint-disable-next-line @typescript-eslint/consistent-type-imports` before DI imports.
- `apps/web` is deleted. Only `apps/web2` exists.
- `packages/ui` is **deprecated**. Use shadcn components from `apps/web2/components/ui/` instead.
- UI components: shadcn/ui in `components/ui/`, layout in `components/layout/`. See `docs/frontend/ui-patterns.md`.
- Clerk v7 `UserButton` has no `afterSignOutUrl` prop — use env vars.
- Clerk v3 `verifyToken` has no `issuer` param — handled internally.

---

## Architecture Decisions (CTO-Locked)

- **Operational Backbone:** Events -> Workflows -> Read Models -> UI Query Spine -> Dashboards. Do not redesign.
- **Event Model:** Hybrid Audit-Log (mutable entities + append-only events).
- **Auth:** Clerk (managed). No custom auth.
- **Infrastructure:** Azure SaaS deployment.

---

## Key Documents

- [Launch Roadmap](docs/roadmap/launch-roadmap.md) — canonical planning reference
- [North Star](docs/pm-lad-north-star.md) — product vision
- [Operational Backbone](docs/architecture/operational-backbone.md) — architecture
- [Role Dashboards](docs/product/role-dashboards.md) — Phase 4 spec
- [SSOT Build Plan](docs/ssot/pm-lad-3.0-ssot.md) — authoritative scope
- [UI Patterns](docs/frontend/ui-patterns.md) — 3-layer UI rule, shadcn/Tremor/Plot/assistant-ui guide
