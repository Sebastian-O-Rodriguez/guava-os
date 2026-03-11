# Dev Tooling

## Package Manager

**pnpm 9.15.1** — strict, performant Node.js package manager.

```bash
pnpm install           # Install all dependencies
pnpm add <pkg>         # Add dependency (needs CTO approval for new deps)
```

**Worktrees:** Fresh worktrees created by Shoal share the git tree but NOT `node_modules`. Agents must run `pnpm install` in their worktree before running tests, lint, or build. Quality gates will fail without it.

## Monorepo

**Turborepo 2.5.8** — orchestrates builds and tasks across the monorepo.

```bash
pnpm build             # Build all packages and apps via Turborepo
pnpm lint              # ESLint across all packages
pnpm test              # Run all tests
```

## Development Servers

```bash
pnpm dev:api           # NestJS API on port 3001
pnpm dev:web           # Next.js frontend on port 3000 (apps/web2)
```

`apps/web` has been deleted. `pnpm dev:web` now runs `apps/web2`.

### Pages

| Route | Content |
|-------|---------|
| `/dashboard/portfolio` | CEO/Owner portfolio overview (KPIs) |
| `/dashboard/inbox` | PM operational inbox (pending actions) |
| `/dashboard/tasks` | Technician task queue |
| `/dashboard` | Config dashboard (chat UI, secondary) |
| `/properties` | Properties data table |
| `/tenants` | Residents data table |
| `/config-dashboard` | Invoice dashboard with action buttons |

Web2 proxies `/api/*` → `localhost:3001/*` via Next.js rewrites (configured in `next.config.ts`).

### Auth (Local Dev)

- **Clerk** is the auth provider (Phase 1, 2026-03-06)
- Frontend: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `apps/web2/.env.local`
- Backend: `CLERK_SECRET_KEY` in `apps/api/.env`
- Clerk test instance: `pleased-raptor-33`
- Legacy JWT/API key auth still exists in codebase but Clerk is primary

## Database

**PostgreSQL 16 + Prisma 6.16.3**

```bash
# Prisma commands (run from apps/api/)
npx prisma migrate dev      # Apply migrations
npx prisma generate         # Regenerate client
npx prisma studio           # Visual DB browser
```

Required databases: `pmlad`, `pmlad_shadow`
Config: `apps/api/.env` (`DATABASE_URL`, `SHADOW_DATABASE_URL`)

## Testing

```bash
# API tests (Jest + Supertest)
pnpm --filter @pmlad/api test
pnpm --filter @pmlad/api test:cov

# Frontend tests (Vitest)
pnpm --filter @pmlad/web2 test

# E2E tests
pnpm e2e:all

# Load tests (k6)
k6 run apps/api/test/load/chat-query.load.js

# OpenAPI drift check
pnpm ci:openapi-diff
```

Prefer targeted tests over full suite:
```bash
pnpm --filter @pmlad/api test -- --testPathPattern=tenants
```

## Docker

```bash
docker compose --env-file .env.compose up -d    # Full stack (Postgres + API + Web)
docker compose down                              # Stop all
```

## Quality Gates (CI)

All PRs must pass:
- Lint: 0 errors (11 warnings allowed)
- Build: all packages compile
- Tests: per-package >=80% coverage
- OpenAPI drift: 0
- Type check: TypeScript strict mode

## Visual & Accessibility Testing

```bash
pnpm --filter @pmlad/web2 storybook      # Storybook component browser
pnpm --filter @pmlad/web2 test:a11y       # Accessibility tests (axe-core)
pnpm --filter @pmlad/web2 test:visual     # Visual regression (Playwright)
```
