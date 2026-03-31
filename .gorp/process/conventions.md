# Conventions

## Git

- **Branches**: `feat/`, `fix/`, `chore/`, `docs/`
- **Commits**: Conventional format — `type(scope): description`
- **Scopes**: `app`, `db`, `ui`, `infra`, `docs`
- **Never push directly to main** — feature branches + PRs

## Sprint

- `.gorp/plans/roadmap.md` — CTO-maintained, agents never modify
- `.gorp/plans/current-sprint.md` — active task breakdown
- `.gorp/journal/` — one file per agent per day
- Sprint tasks must have: ID, agent, title, status, acceptance criteria

## Code

- TypeScript strict mode
- No `any` types
- Server actions in `src/actions/`
- Prisma client in `src/lib/db.ts`
- Components follow shadcn/ui patterns
- Dark theme only (v1)

## Quality

Run before every PR:

```bash
npx tsc --noEmit
npx eslint . --max-warnings 0
npx prettier --check .
npx next build
npx vitest run
```
