# Current Workflow

> **Superseded by `.omp/skills/planning/SKILL.md` + `.omp/skills/execution/SKILL.md`.**
> This doc describes the classifier-only loop. The full governed pipeline is:
> `project root → OMP session → GOS planning → Linear → IssueGraph → executable
> work → SprintDocument → gorp graph → persona-aware OMP worker → gates → human
> review → approve/reject/retry → promote → Linear refresh`.

## The Loop (classifier only)

```
1. Human plans work in Linear
2. Human creates parent issues and sub-issues with persona labels
3. Human promotes sub-issues from Backlog → Todo when ready
4. Operator runs: guava-os pm search ... | guava-os validate
5. Operator runs: guava-os pm search ... | guava-os status
6. Operator confirms Go / No-Go
7. Governed execution: sprint generate → wf plan → gorp compile-graph → dispatch
8. Human reviews at the gorp review gate → approve/reject/retry → promote
9. Linear refreshed via pm
10. Repeat

> **Authority note (2026-07).** The loop above describes how this classifier is used over Linear input data. Steps 8-9 are superseded for governed work: agents execute through Gorp-governed sprints, and review happens at the Gorp review gate. guava-os is the control plane; Gorp is the execution engine — execution state is never derived from Linear.

## Step by Step

### 1. Plan Work

Human/CTO creates parent issues in Linear representing features or work packages. Each parent gets sub-issues labeled with exactly one persona (architect, backend, frontend, or qa).

New sub-issues start in Backlog.

### 2. Promote Work

When ready to schedule work, human moves selected sub-issues from Backlog → Todo in Linear.

Guava OS does not do this. There is no automated promotion today.

### 3. Export Linear Data

The CLI needs issue data piped via stdin. The caller must fetch it.

**Using guava-os tooling:**

```
guava-os pm search --project guava-os --json | guava-os validate
```

Search returns the full issue snapshot (relations included, GOS-28); pipe it
to status/validate/next.

**If exporting manually:**

Use Linear's API or export features to produce a JSON array of issues.

### 4. Validate

```bash
cat issues.json | .guava-os/bin/guava-os validate
```

If exit code is 0: no errors. Proceed to status.

If exit code is 1: fix errors in Linear before continuing. See the validate guide for remediation.

### 5. Check Status

```bash
cat issues.json | .guava-os/bin/guava-os status
```

Review the executable queue. Confirm the right sub-issues are showing for each persona.

### 6. Go / No-Go

**Go** if:
- validate exits 0
- status shows expected executable work
- warnings reviewed

**No-Go** if:
- validate has errors
- status shows unexpected empty queue
- unexplained anomalies in parent health

### 7. Governed Execution

`guava-os sprint generate` → `guava-os wf plan` → gorp compiles graph →
persona-aware OMP workers execute in sandboxes → gates → human review at the
gorp review gate.

### 8. Review & Promote

Human reviews at the gorp review gate. `guava-os wf approve/reject/retry`
records decisions; `guava-os wf promote` promotes approved work. Linear is
refreshed via `pm`.

## What Guava OS Does NOT Do in the Classifier Workflow

- The classifier commands do not fetch Linear data (`pm search` handles it)
- The classifier commands do not promote sub-issues (gorp handles promotion)
- The classifier commands do not dispatch agents (gorp dispatches workers)
- guava-os `pm`/`sprint`/`wf` DO call Linear, mutate state, and drive
  execution — see `.omp/skills/planning/SKILL.md`.
