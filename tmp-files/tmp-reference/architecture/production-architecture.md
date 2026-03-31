# PM Lad — Production Architecture

**Owner:** CTO Office
**Status:** Authoritative
**Last Updated:** 2026-03-09

---

## Target Infrastructure

Azure-based SaaS deployment.

---

## Stack

### Backend

| Component | Technology                                | Notes                                |
| --------- | ----------------------------------------- | ------------------------------------ |
| Runtime   | Node.js 20                                | Current: NestJS 10 on Node 20 Alpine |
| Framework | NestJS                                    | Existing, no changes                 |
| Hosting   | Azure App Service or Azure Container Apps | Container-based preferred            |
| ORM       | Prisma 6.x                                | Existing                             |

### Database

| Component  | Technology                                      | Notes                       |
| ---------- | ----------------------------------------------- | --------------------------- |
| Primary    | Azure Database for PostgreSQL (Flexible Server) | Managed, automated backups  |
| Migrations | Prisma Migrate                                  | Existing migration pipeline |

### Frontend

| Component | Technology                                 | Notes                    |
| --------- | ------------------------------------------ | ------------------------ |
| Framework | Next.js 15                                 | Existing (apps/web2)     |
| Hosting   | Azure Static Web Apps or Azure App Service | SSR requires App Service |

### Storage

| Component | Technology         | Notes                                     |
| --------- | ------------------ | ----------------------------------------- |
| Documents | Azure Blob Storage | Future: lease documents, invoices, photos |

### Networking

| Component | Technology            | Notes                           |
| --------- | --------------------- | ------------------------------- |
| Edge      | Azure Front Door      | CDN, SSL termination, WAF       |
| DNS       | Azure DNS or external | TLS certificates via Front Door |

### Observability

| Component      | Technology               | Notes                                     |
| -------------- | ------------------------ | ----------------------------------------- |
| Error tracking | Sentry                   | Frontend + backend                        |
| Logging        | Structured JSON logs     | Existing pattern, needs Azure integration |
| Metrics        | Azure Monitor (optional) | Application Insights for APM              |

---

## Production Domain

**Domain:** `pmlad.com`

### Routing

| Environment    | Web                     | API                     |
| -------------- | ----------------------- | ----------------------- |
| **Production** | `app.pmlad.com`         | `api.pmlad.com`         |
| **Staging**    | `staging.app.pmlad.com` | `staging.api.pmlad.com` |
| **Local**      | `localhost:3000`        | `localhost:3001`        |

`pmlad.com` root serves as marketing/landing page (optional at launch).

### DNS Configuration

Azure Front Door handles routing:

```
pmlad.com             -> marketing (static, optional)
app.pmlad.com         -> Azure App Service (Next.js)
api.pmlad.com         -> Azure App Service (NestJS)
staging.app.pmlad.com -> Azure App Service staging slot (Next.js)
staging.api.pmlad.com -> Azure App Service staging slot (NestJS)
```

SSL certificates managed by Azure Front Door (automatic renewal).

---

## Deployment Model

### Environments

| Environment | Purpose                   | URL Pattern                                   |
| ----------- | ------------------------- | --------------------------------------------- |
| Development | Local + CI                | localhost:3000 (web), localhost:3001 (api)    |
| Staging     | Pre-production validation | staging.app.pmlad.com / staging.api.pmlad.com |
| Production  | Live customers            | app.pmlad.com / api.pmlad.com                 |

### Deployment Pipeline

```
git push to main
       |
  GitHub Actions CI
  (lint, test, build, schema check)
       |
  Build container image
       |
  Push to Azure Container Registry
       |
  Deploy to staging
       |
  Smoke tests on staging
       |
  Manual approval gate
       |
  Deploy to production
       |
  Run database migrations (prisma migrate deploy)
       |
  Health check verification
```

### Current State vs Required

| Capability             | Current                          | Required                         |
| ---------------------- | -------------------------------- | -------------------------------- |
| Dockerfile             | Exists (multi-stage)             | Ready                            |
| CI pipeline            | GitHub Actions (test/lint/build) | Needs deploy steps               |
| Container registry     | None                             | Azure Container Registry         |
| Staging environment    | None                             | Azure App Service (staging slot) |
| Production environment | None                             | Azure App Service                |
| Database (managed)     | Local/Docker only                | Azure PostgreSQL                 |
| SSL/TLS                | None                             | Azure Front Door                 |
| Secrets management     | .env files                       | Azure Key Vault                  |
| Database migrations    | Prisma (manual)                  | Automated in deploy pipeline     |
| Health checks          | /v1/health endpoint exists       | Ready                            |
| Error tracking         | None                             | Sentry (needs integration)       |

---

## Secrets Management

### Current (Development)

- `.env` files (gitignored)
- `.env.compose` for Docker Compose

### Production (Required)

- Azure Key Vault for all secrets
- Environment variables injected at deploy time
- No secrets in container images or source code
- Required secrets:
  - `DATABASE_URL`
  - `CLERK_SECRET_KEY`
  - `CLERK_PUBLISHABLE_KEY`
  - `SENTRY_DSN`
  - `ADMIN_BOOTSTRAP_TOKEN` (initial setup only)

---

## Database Migrations

### Strategy

- Prisma Migrate for schema management
- Migrations run automatically on deploy (`prisma migrate deploy`)
- Backward-compatible migrations only (no breaking changes without coordination)
- Shadow database for migration validation (development only)

### Backup & Recovery

- Azure automated daily backups
- Point-in-time recovery (7-day window minimum)
- Manual backup before major migrations

---

## Authentication

**Provider:** Clerk

Clerk handles:

- User registration and login
- Email verification
- Session management
- JWT issuance
- Organization management (maps to PM Lad organizations)

The existing hand-rolled JWT utility (`apps/api/src/auth/jwt.util.ts`) will be replaced by Clerk JWT verification.

---

## Multi-Tenant Model

### Hierarchy

```
Organization (customer company)
  -> Entity (branch/portfolio)
    -> Property (building)
      -> Unit (apartment/space)
        -> Resident (occupant)
```

### Isolation

- Every query scoped by `organizationId`
- Application-level guards enforce isolation (`OrgEntityGuard`)
- Row-Level Security (RLS) planned as defense-in-depth
- Clerk organization model maps to PM Lad `Organization`

### Naming Convention

| Term             | Meaning                                                 |
| ---------------- | ------------------------------------------------------- |
| `organizationId` | Multi-tenant scope field (replaces legacy `tenantId`)   |
| Resident         | Property occupant (replaces legacy `Tenant` model name) |
| Organization     | Customer company using PM Lad                           |

---

## Roadmap Alignment

This architecture supports the launch roadmap phases:

- **Phase 1** (Identity): Clerk integration replaces hand-rolled JWT
- **Phase 5** (Infrastructure): Azure provisioning per this document
- **Phase 6** (Pipeline): GitHub Actions -> Azure Container Registry -> App Service

See: [`docs/roadmap/launch-roadmap.md`](../roadmap/launch-roadmap.md)

---

## Blockers for Production Deployment

1. ~~No Azure infrastructure provisioned~~ — Container Apps + PostgreSQL + ACR + Key Vault done (2026-03-09)
2. ~~No managed auth provider~~ — Clerk integrated (Phase 1, 2026-03-06)
3. ~~No staging environment~~ — Staging Container Apps needed (Phase 6)
4. ~~No secrets management~~ — Key Vault provisioned, 10 secrets populated (2026-03-09)
5. **No deploy pipeline** — CI tests but does not deploy (CD workflow needed — Phase 6)
6. ~~No Sentry integration~~ — @sentry/nextjs (web) + @sentry/nestjs (API) integrated and verified (2026-03-09)
7. ~~No DNS configured~~ — api.pmlad.com + app.pmlad.com with managed SSL (2026-03-09)
8. ~~PostgreSQL not provisioned~~ — pmlad-db in centralus, Burstable B1ms, PG 16 (2026-03-09)

---

**CTO Office — Guava AI Ltd.**
