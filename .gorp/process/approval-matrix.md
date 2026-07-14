> **`DUPLICATE` — DEPRECATED (Wave A closeout, 2026-07-14).** Drifted copy of
> canonical Gorp doctrine (`~/dev/gorp/doctrine/approval-matrix.md`). Not
> authoritative. The autonomous Linear status/comment operations below are
> `DEPRECATED` — Linear is not the execution authority; authoritative execution
> state is the Gorp-native persisted graph. See
> `~/dev/repos/DOCUMENTATION-AUTHORITY-MAP.md`.

# Approval Matrix

## Auto-Approved (Builders Do Freely)

- Write code within assigned scope
- Run tests and quality gates
- Create feature branches
- Comment on Linear issues (claims, status, QA results)
- Read any project file

## Robo Autonomous (No Approval Needed)

- Backlog → Todo promotion (within MAX_TODO_PER_PERSONA cap)
- Parent issue activation (Todo → In Progress) when subtask claimed
- Parent issue completion (In Progress → Done) when all subtasks Done
- Dependency cascade promotion (re-evaluate blocked issues when blocker resolves)
- Stale claim reclamation (>48h, no activity, within RECLAIM_LIMIT)
- Invalid claim rejection (eligibility gate failure)
- Queue state reporting

## Human Required

- Issue creation or deletion
- Priority changes
- Scope modification (descriptions, acceptance criteria)
- Schema migration approval
- External dependency approval (new packages/services)
- Deploy authorization
- PR merge
- Resolving escalation-class events
- Roadmap modifications
- Supabase dashboard changes (RLS, auth settings)
- Environment variable changes
- Any destructive git operation
