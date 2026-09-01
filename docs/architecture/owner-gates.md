# Owner Gates

> **Status: DRAFT — not ratified.** This document is a proposed governance spec.
> It has not been approved by the owner and carries no authority until it is
> ratified. Nothing here describes current, enforced behavior; it describes
> mechanisms to be *proposed* and, if approved, wired into the tooling and docs
> listed under [Patch blocks](#patch-blocks).

## Purpose

Define the ownership seam for **owner decisions** — the small set of
operator-facing choices that only the owner may make (positioning, information
architecture, copy, animation semantics, launch). Everything below ensures an
execution agent can never silently make, or silently treat as made, one of
these decisions.

Three roles touch a decision:

| Role | Function |
|---|---|
| **Owner** | Decides and finally approves. |
| **Orchestrator** (guava-os / dispatcher) | Reviews evidence, challenges, frames the decision. |
| **Execution agent** (OMP subagent) | Inspects, drafts, implements approved decisions, tests. |

The invariants:

1. Only the owner **selects**. Everyone else **presents**.
2. An owner decision is **not code**: it is an issue (gate) that no agent can
   execute, and a comment that names the decision.
3. Selection has exactly one evidence form: an owner comment that names the
   decision.

---

## 1. Authority model

### Owner — decides and finally approves

The owner decides: **positioning, information architecture (IA), copy,
animation semantics, launch**. "Finally approves" means the owner is the
terminal authority; no agent may overturn, reinterpret, or pre-empt an owner
decision.

**May:**

- Decide positioning, IA, copy, animation semantics, launch.
- Approve or reject a framed decision.
- Reopen a previously decided gate with new information.
- Ratify the governance rules in this document.

**Forbidden:**

- Writing production code or driving dev branches.
- Dispatching subagents or driving the orchestrator.
- Merging to `staging`/`production` (GitHub owns authorization — the owner
  decides *what*, never *merges*).
- Approving **silently**: every approval must be recorded as a Linear comment
  naming the decision (see [Approval evidence](#5-approval-evidence)).
- Delegating the decision itself to an agent. The owner may delegate
  *research*, never *selection*.

### Orchestrator — reviews evidence, challenges, frames

The orchestrator (guava-os / the dispatch session) sits between the owner and
the execution agents. It runs the control plane: reads Linear, decomposes work,
dispatches subagents, verifies handoff.

**May:**

- Inspect and gather evidence (diff, test output, screenshots, options).
- Challenge an option: probe its assumptions, cost, risk, coverage.
- Frame a decision for the owner: present options with trade-offs, in a form
  the owner can approve in one move.
- Create and move **work** issues; dispatch execution agents to *inspect*,
  *draft*, *implement approved decisions*, or *test*.
- Record its framing as a comment (clearly labeled as framing, not decision).

**Forbidden:**

- Making the owner decision (selecting positioning/IA/copy/animation/launch).
- Substituting its own preference for the owner's and passing it off as the
  decision.
- Selecting an option and recording it as the owner's approval.
- Treating its own framing or an agent's recommendation as approval.
- Merging to `staging`/`production`.
- Moving an owner gate to `Done` without an owner comment naming the decision.

### Execution agent — inspects, drafts, implements, tests

The execution agent is any OMP subagent (`task`, `reviewer`, `scout`,
`designer`, `sonic`, `librarian`, `security-reviewer`). It executes **scoped
work**, never authority.

**May:**

- Inspect the codebase and report findings.
- Draft options (e.g. candidate IA, copy variants, animation storyboards).
- Implement an **already-approved** decision, strictly within the issue scope.
- Test, verify, and report evidence.
- Move its own work issue to `In Review`.

**Forbidden:**

- Making or selecting an owner decision. An agent may *draft options*; it never
  picks one.
- Implementing an unapproved decision, or inferring approval from context
  ("obviously we'd pick X").
- Selecting among options and presenting only its chosen one as if settled.
- Marking an owner gate `Done`, or writing the owner's approval comment.
- Claiming a decision is "approved" without an owner comment naming it.
- Merging to `staging`/`production`.

---

## 2. Gate representation in Linear

An owner decision is represented as an **owner gate** — an issue that is
**structurally non-executable**: no role label selects a subagent for it, so
the dispatch loop can never fan it out as work.

| Field | Rule |
|---|---|
| **Role label** | **None.** Owner gates carry no role label. The dispatcher's role→agent map has no entry for "no role", so a gate cannot be dispatched. |
| **Title** | Prefix `OWNER GATE —` (e.g. `OWNER GATE — site v7 positioning`). |
| **Description** | First line exactly: `OWNER DECISION REQUIRED — not dispatchable`. |
| **Status** | **Never `Todo`.** Gates are created `Backlog` and never moved to `Todo`. The dispatcher only loads `--status Todo`, so a gate is never selected. |
| **Done** | `Done` requires an **owner comment naming the decision** (see §5). An agent may not move a gate to `Done`. |

Mechanism labels:

- **Structural — no role label.** The dispatcher selects a subagent by the
  issue's role label (dispatch skill `Loop` step 2 and `Roles → agent type`
  table). An issue with no role label has no mapping and cannot be dispatched.
  A subagent is never spawned for it.
- **Structural — status never `Todo`.** The dispatcher loads open work via
  `pm search --status Todo`. A gate held in `Backlog` is invisible to dispatch.
- **Advisory — title prefix and description opener.** These instruct a
  human/agent reading the issue to stop, but nothing mechanically prevents a
  mislabeled gate from being read. They are the human-facing signal; the
  structural fields (no role label, non-`Todo` status) are the enforcement.
- **Advisory — `Done` requires an owner comment.** This is a convention unless
  the `pm move --status Done` tooling rejects a gate without an owner comment.
  §6 proposes that enforcement; until wired, it is advisory.

---

## 3. Dispatcher stop conditions

The dispatcher (project session) must **halt and surface**, not execute, when
it encounters any of:

1. An open issue with **no role label** → do not dispatch; report to the
   orchestrator as a candidate owner gate.
2. A title beginning **`OWNER GATE —`** → do not dispatch; surface to the owner.
3. A description opening **`OWNER DECISION REQUIRED — not dispatchable`** → do
   not dispatch; surface to the owner.
4. A gate in any status an agent might pick up (e.g. a gate that has drifted
   into `Todo`) → do not dispatch; flag the mislabeled gate and revert it out
   of `Todo`.
5. A worker returns a result that **selects** a decision (recommends one option
   as settled, or states a decision is "made"/"approved" without an owner
   comment) → reject the handoff; route the *options* (not the selection) to
   the owner.

Mechanism labels:

- **Structural — conditions 1 and 4.** The dispatcher's issue load (`--status
  Todo`) and role→agent map mechanically exclude unlabeled and non-`Todo`
  issues. A gate cannot reach a subagent through these paths.
- **Advisory — conditions 2, 3, and 5.** These are instructions to the
  dispatcher prompt (and to the reviewer/worker prompt). They work only if the
  dispatcher follows them; no code enforces them. They are belt-and-suspenders
  on top of the structural fields.

---

## 4. Reviewer / worker stop rules

**Review = evidence + options, never selection.** The reviewer (QA) and every
worker produce *findings* and *options*; the selection is always the owner's.

- A reviewer's verdict is **evidence**: what was checked, what passed/failed,
  what risks remain, and a set of **options** with trade-offs — never "therefore
  we should ship X".
- A worker's output is a **draft**: candidate implementations, variants, or
  findings — never a claim that the owner has decided.
- When a review or task touches an owner gate, the agent **stops at the gate**
  and produces evidence + options for the orchestrator to frame for the owner.
- Terminal handoff for a gate-touching issue is `In Review` (or a report back
  to the orchestrator), **never** `Done` on the gate itself.

Mechanism labels:

- **Advisory — all of §4.** These are prompt-level instructions (role docs +
  the authority-boundary block in §6). Nothing in code stops an agent from
  writing a recommendation; only the instruction and the `Done`-requires-comment
  convention (once enforced) bound it. This is the *only* feasible place for
  these rules: selection is a reasoning act, and reasoning cannot be enforced
  by a field — only by prompt + the structural gate fields that keep the
  decision itself off the execution path.

---

## 5. Approval evidence

An owner decision is **made** only when there exists a Linear comment, authored
by the owner, that **names the decision**. Examples:

- `Approved: positioning = "local-first dev loop", not "AI platform".`
- `Decision: IA = two top-level sections (Build / Govern). Launch = yes.`
- `Rejecting option A; copy = "..."`.

The comment must be on the gate issue, be attributable to the owner, and name
the specific choice. Absent this, the decision is **unmade**, regardless of how
much an agent has inspected, drafted, or recommended.

Mechanism labels:

- **Advisory — the comment is evidence, not a mechanical lock.** Nothing
  prevents an agent from proceeding without it; the `Done` gate and the
  authority-boundary prompt (once wired) make ignoring it a violation that is
  *detectable* and *rejectable*, not one that is impossible. Truly structural
  enforcement would require the promotion/merge tooling to refuse a `Done`
  (or a staging PR) on a gate without an owner comment — proposed in §6.

---

## 6. Prompt / model rules

An **authority-boundary block** is injected into every context an agent can
receive, so the boundary is present even when the agent never reads this spec.
It must appear in:

1. **The compiled worker context** — `manual/scripts/inject.mjs` (every worker
   prompt is assembled here).
2. **The role decision trees** — `docs/workflow/roles/*.md` (what a role agent
   is told at its step level).
3. **The dispatcher prompt** — the dispatch skill (stop conditions of §3).

Canonical block text:

```text
# AUTHORITY BOUNDARY
You are an execution agent. You may inspect, draft, implement APPROVED
decisions, and test. You may NOT decide positioning, information
architecture, copy, animation semantics, or launch. You may NOT select
among options or claim a decision is approved. A decision is approved
only by an owner comment on the gate issue that names the decision. If
this issue is an OWNER GATE (no role label, "OWNER DECISION REQUIRED"),
STOP: produce evidence + options, do not select, do not mark Done.
```

Mechanism labels:

- **Advisory — the block is prompt text.** It shapes model behavior but is not
  a hard gate; a sufficiently misdirected model can still overstep. This is
  inherent: model behavior is *instructed*, not *enforced*. The structural
  enforcement lives in the Linear fields (§2) and dispatcher mechanics (§3);
  the block is the **instruction layer** that makes the boundary legible and
  consistent across every agent. **Only-advisory is unavoidable here** — there
  is no deterministic rule engine in front of the model for "did it select or
  merely present?", so the boundary is enforced by prompt plus the *detectable*
  evidence contract (owner comment) rather than by impossibility.

- **Structural — `inject.mjs` refuses to compile a roleless task** (proposed
  patch below). If a task JSON has no role (an owner gate), the compiler exits
  rather than emitting a worker prompt. This is a real, code-enforced stop at
  the *assembly* layer — the one place the dispatcher's structural field (no
  role label) can be turned into an exception before any agent reads it.

---

## Patch blocks

The following patches are **proposed, NOT applied**. They are shown here as
diff-ready text so an approver can review the exact change each file would
receive. Line numbers reflect the files as of this draft and will shift if
siblings land concurrently.

### docs/architecture/linear-conventions.md

Append a new section after the `## Workflow` table (end of file, line 135):

```diff
@@ -135,3 +135,27 @@
 Transitions: Backlog → Todo → In Progress → In Review → Done (or → Canceled
 from any state). Status is the single source of workflow truth.
+
+## Owner gates (structurally non-executable)
+
+An owner decision (positioning, IA, copy, animation semantics, launch) is an
+**owner gate** — an issue no agent can execute:
+
+- **No role label.** Gates carry no role label; the role→agent map has no
+  entry for "no role", so a gate is never dispatched.
+- **Title prefix** `OWNER GATE —`.
+- **Description opener** — first line exactly
+  `OWNER DECISION REQUIRED — not dispatchable`.
+- **Status** — never `Todo`; gates are created `Backlog` and stay there.
+- **Done** requires an owner comment naming the decision (§owner-gates).
+
+An agent must not move a gate to `Done` or write its approval comment. The
+owner comment that names the decision is the sole approval evidence.
```

### docs/workflow/roles/reviewer.md

Append the stop rules after line 5 (end of file):

```diff
@@ -3,3 +3,12 @@
 `reviewer` checks a diff against the issue's acceptance criteria and runs
 tests. See `ROLE-TEMPLATE.md`. Primary skill: `review` (→ `verify`). Terminal:
 `pm comment` verdict + `pm move` Done (approve) or In Progress (reject).
+
+## Authority boundary
+
+Review = **evidence + options, never selection**. The reviewer reports what
+was checked, what passed/failed, remaining risks, and a set of options with
+trade-offs. It never selects an option, never writes "therefore ship X", and
+never moves an owner gate to `Done`. A decision is made only by an owner
+comment naming it. If the issue is an `OWNER GATE`, produce evidence + options
+and stop — do not select, do not mark Done.
```

### dispatch skill — `~/.agents/skills/dispatch/SKILL.md`

Add a gate check to `Loop` step 1 and a stop-condition section. Patch against
the current file (step 1 at line 20, `## Decision tree` at line 42):

```diff
@@ -20,6 +20,9 @@
 1. **Gate** — `gos work` (this project). Nothing open → close the session.
+   Before dispatch, drop every **owner gate**: an issue with **no role label**,
+   a title beginning `OWNER GATE —`, or a description opening
+   `OWNER DECISION REQUIRED — not dispatchable`. These are surfaced to the
+   owner, never dispatched.
@@ -42,6 +45,20 @@
 ## Decision tree
 
 Each role has its own decision tree under `docs/workflow/roles/`. The subagent
 follows its role's tree; the dispatcher does not implement.
+
+## Stop conditions (owner gates)
+
+Do **not** dispatch; surface to the orchestrator/owner instead, when an issue:
+
+1. has no role label, or
+2. title begins `OWNER GATE —`, or
+3. description opens `OWNER DECISION REQUIRED — not dispatchable`, or
+4. is an owner gate that has drifted into `Todo` (revert it out of `Todo`), or
+5. a worker result **selects** a decision (one option as settled, or claims a
+   decision is "made"/"approved" without an owner comment) — reject the
+   handoff and route the options, not the selection, to the owner.
```

### manual/scripts/inject.mjs

Two changes: (a) refuse to compile a roleless task, (b) emit the authority
boundary into every worker context.

```diff
@@ -63,6 +63,12 @@
 async function main() {
   const taskPath = process.argv[2];
   let task;
   if (taskPath) {
     task = JSON.parse(await readFile(taskPath, "utf8"));
   } else {
     const chunks = [];
     for await (const c of process.stdin) chunks.push(c);
     task = JSON.parse(Buffer.concat(chunks).toString("utf8"));
   }
+
+  if (!task.role || String(task.role).trim() === "") {
+    console.error("inject.mjs: refusing to compile a task with no role (owner gate / non-dispatchable issue)");
+    process.exit(2);
+  }
 
   const skills = await loadSkills();
   const core = skills[CORE_SKILL];
@@ -88,6 +94,16 @@
   L(`domain: ${task.domain}`);
   L(`issue: ${task.issue}`);
   L("");
+
+  L("# AUTHORITY BOUNDARY");
+  L("");
+  L("You are an execution agent. You may inspect, draft, implement APPROVED");
+  L("decisions, and test. You may NOT decide positioning, information");
+  L("architecture, copy, animation semantics, or launch. You may NOT select");
+  L("among options or claim a decision is approved. A decision is approved");
+  L("only by an owner comment on the gate issue that names the decision. If");
+  L("this issue is an OWNER GATE (no role label, \"OWNER DECISION REQUIRED\"),");
+  L("STOP: produce evidence + options, do not select, do not mark Done.");
+  L("");
 
   L("why:");
   L(`  ${task.why}`);
```

---

## Owner ratification checklist

The owner ratifies each item below by checking it. **None of these are checked;
this design is not approved.**

- [ ] Authority model: owner decides positioning / IA / copy / animation
  semantics / launch; orchestrator frames; execution agent drafts/implements
  approved decisions — with the forbidden-action lists as written in §1.
- [ ] Gate representation: no role label, `OWNER GATE —` title prefix,
  `OWNER DECISION REQUIRED — not dispatchable` description opener, status never
  `Todo`, `Done` requires an owner comment (§2).
- [ ] Dispatcher stop conditions (§3) adopted, including the roleless-issue and
  drifted-`Todo` conditions.
- [ ] Reviewer/worker stop rules: review = evidence + options, never selection
  (§4).
- [ ] Approval evidence: an owner comment naming the decision is the sole
  evidence of a made decision (§5).
- [ ] Authority-boundary block injected via `inject.mjs` and role docs, plus the
  `inject.mjs` roleless-task refusal guard (§6).
- [ ] `pm move --status Done` enforced to reject a gate without an owner
  comment (promotes §2/§5 from advisory to structural).
- [ ] Patch blocks for `linear-conventions.md`, `reviewer.md`, the dispatch
  skill, and `inject.mjs` approved for application.
