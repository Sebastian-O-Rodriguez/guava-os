# GitHub Authorization

> Authority: `ADR_001.md` (Amendment 2) →
> `docs/architecture/guava-os-operating-contract.md` → this doc.

GitHub owns authorization — the machine enforcement that replaces gorp's
transition table and fail-closed promotion.

## Branch topology

```
production   ← protected: PR from staging + required review + required CI
staging      ← protected: PR from dev/* + QA review + required CI
dev/backend   dev/frontend   (workers push directly)
```

## Branch protection rules

| Branch | Require PR | Approving reviews | Required status checks | Direct push |
|---|---|---|---|---|
| `production` | yes | 1 (operator) | CI | blocked |
| `staging` | yes | 1 (QA) | CI | blocked |
| `dev/*` | no | — | — | workers push |

Configure via GitHub repo settings → Branches → protection rules (or `gh api
repos/{owner}/{repo}/branches/{branch}/protection`).

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs the deterministic gate — typecheck + tests — as
required status checks on every PR to `staging` and `production`. This is the
machine-enforced "no stale gate": the exact commit being merged is tested.

## QA review (guava-os OMP agent)

The QA review is the **judgment** step (acceptance vs diff), separate from CI's
deterministic gate. It runs as a guava-os OMP agent with the `reviewer` role,
triggered on schedule or PR-open:

1. Read the open issues in `In Review` and the `dev/<role>` → `staging` diff.
2. Check each acceptance criterion against the diff; run `verify`.
3. **Approve** → merge the PR to `staging`; move the issue to `Done`.
4. **Reject** → comment the reason on the issue; move status back to
   `In Progress`.

CI owns determinism; QA owns judgment. The operator owns the second gate
(`staging` → `production`).

## The split

| Gate | Owner | What it enforces |
|---|---|---|
| Typecheck + test | GitHub Actions (CI) | deterministic, non-bypassable |
| Acceptance vs diff | guava-os QA agent | judgment |
| staging → production | operator | second review |

Commit subjects carry `GUA-### <outcome>` so QA can map commits to issues and
acceptance criteria.
