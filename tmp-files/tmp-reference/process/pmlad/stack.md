# Tech Stack & Project Details

## PM Lad — The Product

Operational control system for property managers. Self-service SaaS.

**Owner:** Sebastian Rodriguez, CTO, Guava AI Ltd.

## Stack

| Layer | Technology | Location |
|-------|-----------|----------|
| Backend | NestJS 10 + Prisma 6.16 | `apps/api/` |
| Frontend | Next.js 15 (App Router) + Tailwind v4 | `apps/web2/` |
| Database | PostgreSQL 16 | Managed (Azure target) |
| Auth | Clerk | `@clerk/backend` v3, `@clerk/nextjs` v7 |
| Shared types | Zod schemas | `packages/types/` |
| Shared UI | React components | `packages/ui/` |
| DB client | Prisma client | `packages/db/` |
| Widgets | Widget system | `packages/widgets/` |
| Package manager | pnpm 9.15.1 | Monorepo-wide |
| Build | Turborepo 2.5.8 | Monorepo-wide |

## Local Development

```bash
pnpm install              # Install deps
pnpm dev:api              # API on localhost:3001
pnpm dev:web              # Frontend on localhost:3000
pnpm build                # Build all
pnpm lint                 # Lint all
pnpm test                 # Test all
```

Databases: `pmlad`, `pmlad_shadow` (PostgreSQL)

## Target Infrastructure

Azure App Service, Azure Database PostgreSQL, Azure Front Door, Azure Key Vault, Sentry, Clerk.

## Architecture

Operational Backbone (preserved, do not redesign):

```
Events -> Workflows -> Read Models -> UI Query Spine -> Dashboards
```

See [`docs/architecture/operational-backbone.md`](../../docs/architecture/operational-backbone.md).

## Shoal — The Framework

Python CLI for AI agent orchestration. See [`shoal.md`](../../../shoal.md).
