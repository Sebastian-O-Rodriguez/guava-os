# Conventions — Git, Commits, Sprints

## Sprint Format

Sprints live in `pmlad/.shoal/plans/`:

- `current-sprint.md` — the active sprint
- `sprints/` — maintenance and archived sprint docs
- `reports/` — sprint summaries

### Sprint Structure

```markdown
# Sprint: <Name>

**Status:** In Progress | Complete
**Phase:** <roadmap phase>
**Owner:** Robo

## Goal
<one sentence>

## Task Groups

### Group: <name> (e.g., "API Endpoints")
| ID | Persona | Task | Status | Acceptance Criteria |
|----|---------|------|--------|---------------------|

### Group: <name> (e.g., "Dashboard UI")
| ID | Persona | Task | Status | Acceptance Criteria |
|----|---------|------|--------|---------------------|
```

Task statuses: `pending`, `in-progress`, `blocked`, `review`, `done`

## Branch Naming

Shoal enforces branches must start with: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

```
feat/<sprint>-<persona>-<task-slug>
```

Examples:
- `feat/phase4-backend-dashboard-apis`
- `feat/phase4-frontend-dashboard-ui`
- `feat/phase4-architect-read-models`
- `fix/phase4-qa-dashboard-validation`

## Commit Format

Conventional commits. Author is always Gorp.

```
<type>(<scope>): <description>

Gorp, Guava AI
<Persona>, <Sprint>
```

**Author flag:** `--author="Gorp, Guava AI <gorp@guava.ai>"`

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
**Scopes:** `api`, `web`, `db`, `ui`, `widgets`, `types`, `infra`

### Examples

```
feat(api): implement portfolio overview endpoint

Gorp, Guava AI
Backend, Phase-4
```

```
feat(web): add CEO dashboard with occupancy cards

Gorp, Guava AI
Frontend, Phase-4
```

## Push Convention

- Agents push their branch when task is complete
- One PR per task group (not per individual task)
- PR title: `[Phase-X/<Persona>] <group description>`
- PR body: task list with completion status
- Robo or CTO merges after QA sign-off

## Doc Convention

- Max ~100 lines per doc. If longer, split and link.
- PM Lad docs: no prefix (e.g., `roadmap.md`)
- Shoal framework docs: `shoal-` prefix (e.g., `shoal-roadmap.md`)
- Keep docs in the most relevant location, link from elsewhere
