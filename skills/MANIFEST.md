# Skills Manifest (canonical store)

Single source of truth: `~/.agents/skills/<name>/`. Consumers reference these via
symlinks only (project `.omp/skills`). No duplicate real copies live elsewhere.
Domain-organized; see `~/dev/guava-os/manual/src/content/docs/skills.md` for the
same tables rendered in the manual.

## Control plane (guava-os)

| Skill | Purpose |
|---|---|
| `add-skill` | skill management |
| `planning` | sprint planning / board health |
| `linear` | all Linear ops via `pm` |
| `dispatch` | fan issues to role subagents |
| `review` | QA review + promotion |
| `verify` | quality gates |
| `handoff` | session continuity |

## Core (loaded by every agent)

| Skill | Provenance |
|---|---|
| `engineering-principles` | distilled — pstack principles |
| `tdd` | distilled — mattpocock / pstack |
| `diagnosing-bugs` | distilled — mattpocock / pstack |
| `writing-for-agents` | distilled — mattpocock |
| `technical-writing` | distilled — pstack |
| `diagrammatic-writing` | authored — Drucker |
| `diagrammatic-review` | authored — Drucker |

## Product Manager

| Skill | Provenance |
|---|---|
| `to-tickets` | distilled — mattpocock |
| `grilling` | distilled — mattpocock |

## QA

| Skill | Provenance |
|---|---|
| `code-review` | distilled — mattpocock / pstack |
| `test-strategy` | distilled — Jeffallan |

## Security

| Skill | Provenance |
|---|---|
| `secure-coding` | distilled — Jeffallan |
| `security-review` | distilled — Jeffallan |

## Backend

| Skill | Provenance |
|---|---|
| `python-backend` | distilled — Jeffallan |
| `sql-postgres` | distilled — Jeffallan |
| `api-design` | distilled — Jeffallan |

## Frontend / Designer

| Skill | Provenance |
|---|---|
| `react-nextjs` | distilled — Jeffallan |
| `reveal-presentation` | authored — reveal.js |
| `gsap-core` (+ `gsap-frameworks` `gsap-performance` `gsap-plugins` `gsap-react` `gsap-scrolltrigger` `gsap-timeline` `gsap-utils`) | workspace (GSAP) |
| `rive` | agents ecosystem |

## DevOps

| Skill | Provenance |
|---|---|
| `ci-cd` | distilled — Jeffallan |
| `terraform` | distilled — Jeffallan |
| `observability` | distilled — Jeffallan |

## AI / ML

| Skill | Provenance |
|---|---|
| `rag` | distilled — Jeffallan |
| `prompt-engineering` | distilled — Jeffallan |
| `pandas-data` | distilled — Jeffallan |

## Compression / comms (Hermes)

| Skill | Provenance |
|---|---|
| `caveman` (+ `caveman-commit` `caveman-compress` `caveman-help` `caveman-review` `caveman-stats`) | workspace (Hermes) |
| `cavecrew` | workspace (Hermes) |

## Ecosystem

| Skill | Provenance |
|---|---|
| `supabase` (+ `supabase-postgres-best-practices`) | supabase org |
| `vercel` (+ `vercel-cli-with-tokens` `vercel-composition-patterns` `vercel-optimize` `vercel-react-best-practices` `vercel-react-native-skills` `vercel-react-view-transitions`) | vercel-labs / workspace |
| `deploy-to-vercel` | vercel-labs |

## Harness-provided (shipped with OMP; not in this store)

Loaded natively by OMP; update with the harness, not here.

`agents-sdk`, `cloudflare`, `cloudflare-email-service`, `cloudflare-one`,
`cloudflare-one-migrations`, `durable-objects`, `sandbox-migrate-to-next`,
`sandbox-next`, `sandbox-stable`, `turnstile-spin`, `web-perf`,
`workers-best-practices`, `wrangler`.

## Adding a skill

Follow `~/.agents/skills/add-skill/SKILL.md`. Never create real skill dirs
outside this store.

## Consumers (reference via symlink)

- `/Users/sebroot/dev/guava-os/.omp/skills/*`
- `/Users/sebroot/dev/repos/resume-site/.omp/skills/*`