# Current Workflow

This is how Guava OS is used today. Every step involves human action.

## The Loop

```
1. Human plans work in Linear
2. Human creates parent issues and sub-issues with persona labels
3. Human promotes sub-issues from Backlog → Todo when ready
4. Operator exports Linear issue data
5. Operator runs: guava-os validate
6. Operator runs: guava-os status
7. Operator confirms Go / No-Go
8. Builders (agents) execute Todo sub-issues
9. Human reviews progress in Linear
10. Repeat
```

## Step by Step

### 1. Plan Work

Human/CTO creates parent issues in Linear representing features or work packages. Each parent gets sub-issues labeled with exactly one persona (architect, backend, frontend, or qa).

New sub-issues start in Backlog.

### 2. Promote Work

When ready to schedule work, human moves selected sub-issues from Backlog → Todo in Linear.

Guava OS does not do this. There is no automated promotion today.

### 3. Export Linear Data

The CLI needs issue data piped via stdin. The caller must fetch it.

**If using Claude Code / MCP tools:**

The MCP `list_issues` tool fetches project issues. Save or pipe the `issues` array.

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

### 7. Execute

Builders (agents) claim Todo sub-issues matching their persona, work on them, and submit for QA. This happens outside Guava OS.

### 8. Review

Human checks progress in Linear. When ready for the next batch, return to step 2.

## What Guava OS Does NOT Do in This Workflow

- It does not fetch Linear data (step 3 is manual)
- It does not promote sub-issues (step 2 is manual)
- It does not dispatch agents (step 7 is manual)
- It does not track progress (step 8 is in Linear)
- It does not make Go/No-Go decisions (step 6 is human judgment)

Guava OS is a checkpoint tool. It validates and reports. Humans decide and act.
