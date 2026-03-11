# Sprint: Phase 5+6 — Production Infrastructure & Deployment Pipeline

**Status:** Complete
**Phase:** 5+6
**Owner:** CTO (direct)
**Completed:** 2026-03-10

## Summary

Provisioned Azure infrastructure and created CI/CD pipeline. Code on `main` auto-deploys to staging with smoke tests, then to production.

## Architecture Pivot

Subscription has zero VM quota — pivoted from App Service to **Azure Container Apps** (serverless, consumption-based).

## Azure Resources

| Resource | Azure Name | Status |
|----------|-----------|--------|
| Resource Group | `pmlad-prod` (eastus) | Done |
| Container Registry | `pmladacr.azurecr.io` (eastus) | Done |
| Key Vault | `pmlad-vault` (eastus) | Done |
| PostgreSQL Flexible | `pmlad-db` (centralus, B1ms, PG 16) | Done |
| Container Apps Env | `pmlad-env` (eastus) | Done |
| Container Apps | `pmlad-api`, `pmlad-web`, staging variants | Done |
| Custom Domains | `api.pmlad.com`, `app.pmlad.com` (managed SSL) | Done |
| Sentry | Web + API projects | Done |
| Service Principal | `pmlad-gh-deploy` | Done |
| GitHub Environments | `staging` + `production` | Done |

## CD Pipeline

```
push to main → CI Gate → Build Images (ACR) → Deploy Staging → Smoke Tests → Deploy Production → Sentry Release
```

## Key Gotchas

- Health endpoint is `/health` not `/v1/health` (global prefix commented out)
- API Dockerfile must build `@pmlad/types`, `@pmlad/utils` and copy `tsconfig.base.json`
- Use Container Apps `secretref:` for passwords with special chars (`!`)
- Container Apps min-replicas=0 causes cold starts (~30s)
- GitHub free plan doesn't support environment approval gates
- Web returns 307 (Clerk redirect) for unauthenticated GET / — valid
