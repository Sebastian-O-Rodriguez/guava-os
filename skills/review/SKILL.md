---
name: review
description: "QA review and promotion — read the diff, check acceptance, run tests, approve (merge to staging) or reject. Evidence is git + PR + CI. guava-os decides; GitHub enforces."
domain: qa
role: reviewer
order: 3
load_when: a promotion verdict is required
guidance: diff vs acceptance | run tests | approve or reject with reason

metadata:
  author: guava-os
  version: "0.2.0"
---

## Review

guava-os owns review decisions (operator/QA-facing). GitHub enforces them via
branch protection and required review. Evidence is the diff, the commit
history, and CI results — there is no custom audit chain (ADR_001 Amendment 2).

## Acceptance review

For each issue in In Review: read the issue's acceptance criteria, inspect the
diff (`git`), run tests (`verify`), and check the result comment. Then verdict.

## Promotion gates

Two gates, both GitHub-enforced:

1. **dev → staging** — QA review: diff is in-scope, acceptance criteria met,
   tests green. **Approve** = merge PR `dev/<domain>` → `staging`. **Reject** =
   comment the reason on the issue, move status back to In Progress.
2. **staging → production** — a second, separate operator review before merge.

## Verdict surface

```bash
gos pm comment <id> --body "Verdict: <approve|reject>. Evidence: ..."
gos pm move <id> --status "Done"          # on approve
gos pm move <id> --status "In Progress"   # on reject
```

Merge via `git`/PR — GitHub branch protection is the enforcement.

## Retrospective

At sprint close: what shipped, what stalled, board hygiene. Feed the next
planning pass.

## Uses

- `pm get-issue`, `pm comment`, `pm move` — verdict + board update
- `git` — diff inspection, merge
- `verify` — tests
- GitHub PR — required review + status checks
