---
name: vercel
description: "Use when doing ANY task involving Vercel in this workspace. Triggers: deploying the resume-site (Astro) or other Vercel-hosted apps; vercel CLI (vercel login/whoami/link/pull/dev/build/deploy/env); git-integrated deployments on push to main; vercel.json or Project Settings (build command, output dir, framework preset); environment variables (PUBLIC_* for client-visible values); custom domains, apex/www, DNS records (A 76.76.21.21 / cname.vercel-dns.com), TLS; Vercel Web Analytics / Speed Insights (@vercel/analytics, <Analytics/> Astro component, dashboard); production vs preview deployments; build logs, deployment status and errors; multi-project repo routing."
domain: devops
role: task
order: 4
load_when: Vercel platform work is in scope
guidance: reuse existing project config | check env vars | preview before prod

metadata:
  author: guava-os
  version: "0.1.0"
---

# Vercel

Home for Vercel platform knowledge used in this workspace. The primary deployment today is **`resume-site`** (Astro 7 + `@astrojs/vercel` adapter), URLs documented in `docs/launch.md`.

## Key facts for this workspace

- **`resume-site`** is *this* resume site, deployed on Vercel from `Sebastian-O-Rodriguez/resume-site` (branch `main`). **Push to `main` auto-deploys.**
- **Domains (do not conflate):**
  - `sebastianr.dev` → **this resume site** (canonical production URL; apex `A` → `76.76.21.21`, `www` → `cname.vercel-dns.com`).
  - `guavaai.ai` → the **company site**, a separate Vercel deploy (most recent role; many projects originated there).
  - Source of truth: `src/data/site.ts` `links` + `docs/launch.md`.
- **Analytics:** Vercel Web Analytics via `@vercel/analytics` — `<Analytics />` is rendered in `src/layouts/Layout.astro` (base layout). Data appears in the Vercel dashboard → Analytics (must be enabled per project). Coexists with the site's own Supabase analytics.

## Core principles

**1. Vercel changes frequently — verify against current docs before relying on memory.**
CLI flags, Analytics/Speed Insights setup, and framework adapter behavior evolve. Confirm against `vercel.com/docs` or run `vercel --help` when unsure.

**2. Git-integrated deploys are the default; local CLI for everything else.**
For `resume-site`, pushing to `main` triggers a production deploy. Use the CLI (`vercel dev`, `vercel build`, `vercel deploy --prod`, `vercel env`, `vercel ls`, `vercel inspect`) for local preview, env, and status.

**3. Deterministic build contract.**
The project must build the same way locally and on Vercel: build command + output directory must match. For `resume-site`: framework preset Astro (auto), build `astro build` (auto), output dir `dist`. If `vercel build` / CI diverges from `npm run build`, fix the mismatch — do not mask it.

**4. Never commit secrets.**
`vercel env pull` writes `.env` locally (gitignored). Set production/preview env vars in the dashboard or via `vercel env add`. Client-visible values must use the `PUBLIC_` prefix (e.g. `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`) so Astro inlines them; anything else stays server-side.

**5. Domain changes need DNS + TLS verification.**
Adding/verifying a domain requires the DNS record to resolve before Vercel provisions TLS. Check with `dig`/`curl -sI https://<domain>` and confirm the 301/308 redirect and valid cert. A domain can be live at Vercel's edge while the deploy/site isn't serving yet (provisioning) — verify content reachability separately.

## Workflows

### CLI basics
```bash
vercel login               # interactive, opens browser
vercel whoami              # confirm auth
vercel link                # link this repo dir to a Vercel project
vercel pull                # fetch project env + settings (.vercel/)
vercel dev                 # local dev server for the project (port 3000 by default)
vercel build               # run a production build + output analysis
vercel deploy --prod       # deploy to production directly (without git)
vercel env pull            # write .env with remote env values (respect .gitignore)
vercel ls                  # list deployments for the linked project
vercel inspect <url|id>    # deployment details + build logs
```

### Astro-specific notes
- The **`@astrojs/vercel`** adapter is installed (`vite` output to `dist`) — no `vercel.json` needed for basic static output; add `vercel.json` only for custom redirects/headers/regions.
- Adding **`@vercel/analytics`**:
  1. `npm i @vercel/analytics`
  2. Add to the base layout:
     ```astro
     import Analytics from '@vercel/analytics/astro';
     // in <body>:
     <Analytics />
     ```
  3. Enable Analytics in the Vercel dashboard for the project; events start once a build deploys.
- Preview deployments get their own URL; `[data-deployment-id]`/`dataset` attributes end up in the built HTML (verify with `grep` on `dist`/`.vercel/output/static`).

### Diagnostics
- Deployment "succeeded" but page is 404/blank → check output dir (`dist`) and that `astro build` produced `index.html`; confirm framework preset.
- Env missing in build → confirm the var exists in the project settings and is spelled correctly in `.env.example`; `PUBLIC_` vars must be present at build time.
- Domain not loading → `dig +short <apex> A` (expect `76.76.21.21`), then `curl -sI https://<domain>` and confirm a `< 400` status + valid cert.
- Analytics empty → Analytics enabled in dashboard, `<Analytics />` in a shared layout, and a deploy landed after enabling.

## Verification

After any deploy/domain/env change: check `vercel ls` (deployment ready), hit the production URL (`curl -sI https://sebastianr.dev`), confirm the expected redirect + certificate, and validate the page contains the built markers (e.g. `<title>`, analytics script).
