/**
 * SprintDocument generation (GOS-29).
 *
 * Linear is the canonical backlog; guava-os owns planning. This module
 * GENERATES the gorp SprintDocument (the handoff contract) from a Linear
 * parent subtree — it is NOT a second planning authority. Content flows
 * one way: Linear tickets → gorp sprint schema. Gorp compiles it onward;
 * gorp never reads Linear (ADR_001).
 *
 * The generated document is NOT approved: approvedBy="operator:unapproved"
 * with a schema-valid placeholder timestamp until `approveSprint` records an
 * explicit operator approval. Compiling an unapproved doc yields a DRAFT
 * graph that gorp still refuses to run without its own operator approval
 * transition — the human gate is enforced twice.
 *
 * Deliberate exclusions (warned, never silent):
 *  - blocked issues (unresolved native blockers) are NOT emitted — blocked
 *    work stays blocked (GOS-28 semantics);
 *  - issues without exactly one persona label are NOT emitted (invalid per
 *    GOS-21 conventions);
 *  - backlog issues are NOT emitted (not scheduled);
 *  - dependencies pointing outside the sprint subtree are dropped with a
 *    warning (gorp rejects unknown task dependencies; cross-sprint edges stay
 *    Linear-level truth).
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import type { Config } from "./config.js";
import type { LinearIssue } from "./linear.js";

export interface SprintTask {
  taskId: string;
  objective: string;
  acceptanceCriteria: string[];
  dependencies: string[];
  scope: { allowedPaths: string[]; forbiddenPaths: string[] };
  gates: Array<{ executable: string; args: string[] }>;
  worker: string;
  review: "human" | "fixture-auto";
  maxAttempts: 1;
  escalation: "operator";
  persona?: string;
}

export interface SprintDocument {
  schemaVersion: 1;
  sprintId: string;
  project: { projectId: string };
  approvedBy: string;
  approvedAt: string;
  tasks: SprintTask[];
}

export interface GenerateResult {
  doc: SprintDocument;
  warnings: string[];
  excludedBlocked: LinearIssue[];
  excludedInvalid: LinearIssue[];
  excludedBacklog: LinearIssue[];
}

/** Placeholder until `approveSprint` records the explicit operator approval. */
export const UNAPPROVED_BY = "operator:unapproved";
/** Schema-valid date-time placeholder; replaced by approveSprint. */
export const UNAPPROVED_AT = "1970-01-01T00:00:00.000Z";

const HEADER_RE = /^#{1,4}\s+(.+?)\s*$/;

function description(issue: LinearIssue): string {
  return issue.description ?? "";
}

/** Extract the Acceptance criteria bullet list from a description. */
export function parseAcceptanceCriteria(descriptionText: string): string[] {
  const lines = descriptionText.split(/\r?\n/);
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    const header = HEADER_RE.exec(line);
    if (header) {
      const title = header[1].toLowerCase();
      if (/^acceptance/.test(title)) { inSection = true; continue; }
      if (inSection) break; // next section ends the acceptance block
      continue;
    }
    if (!inSection) continue;
    const m = /^\s*(?:[-*]|\d+[.)])\s+(.+?)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Extract scope paths from explicit markers in a description. */
export function parseScope(descriptionText: string): { allowedPaths: string[]; forbiddenPaths: string[] } {
  const extract = (key: string): string[] => {
    const idx = descriptionText.indexOf(key);
    if (idx === -1) return [];
    // take the marker line, strip Linear markdown-escape backslashes
    // (editors write ["docs/**"\] and \["..."]), then grab the array.
    const line = descriptionText.slice(idx).split(/\r?\n/)[0].replace(/\\/g, "");
    const m = /:\s*(\[.*\])/.exec(line);
    if (!m) return [];
    try {
      const v = JSON.parse(m[1]) as unknown;
      return Array.isArray(v) && v.every((x) => typeof x === "string") ? v as string[] : [];
    } catch {
      return [];
    }
  };
  const allowedPaths = extract("allowedPaths");
  const forbiddenPaths = extract("forbiddenPaths");
  return { allowedPaths, forbiddenPaths };
}

const PERSONA_TO_WORKER = "omp"; // real workers are OMP agents (ADR_001)

/** Generate a SprintDocument from a Linear parent subtree. Pure + deterministic. */
export function generateSprint(
  issues: LinearIssue[],
  parentId: string,
  projectId: string,
  config: Config,
): GenerateResult {
  const warnings: string[] = [];
  const children = issues.filter((i) => i.parentId === parentId);

  // Blocks edges for blocked detection (dataset-internal, same as buildGraph).
  const blockedBy = new Map<string, Set<string>>();
  for (const i of issues) {
    for (const target of i.blocks ?? []) {
      const set = blockedBy.get(target) ?? new Set<string>();
      set.add(i.id);
      blockedBy.set(target, set);
    }
  }
  const byId = new Map(issues.map((i) => [i.id, i]));
  const personaLabels = new Set(config.personas);

  const excludedBlocked: LinearIssue[] = [];
  const excludedInvalid: LinearIssue[] = [];
  const excludedBacklog: LinearIssue[] = [];
  const included: LinearIssue[] = [];

  for (const c of children) {
    if (c.statusType === "completed" || c.canceledAt) continue;
    if (c.status === config.statuses.backlog) {
      excludedBacklog.push(c);
      warnings.push(`excluded (backlog): ${c.title}`);
      continue;
    }
    const persona = c.labels.filter((l) => personaLabels.has(l));
    if (persona.length !== 1) {
      excludedInvalid.push(c);
      warnings.push(`excluded (persona label missing or ambiguous): ${c.title}`);
      continue;
    }
    const blockers = blockedBy.get(c.id);
    const unresolved = (blockers ? [...blockers] : [])
      .map((bid) => byId.get(bid))
      .filter((b) => b && b.statusType !== "completed" && !b.canceledAt)
      .map((b) => b!.title);
    if (unresolved.length > 0) {
      excludedBlocked.push(c);
      warnings.push(`excluded (blocked by ${unresolved.join(", ")}): ${c.title}`);
      continue;
    }
    included.push(c);
  }

  const includedIds = new Set(included.map((i) => i.id));
  const tasks: SprintTask[] = [];
  for (const c of included) {
    const desc = description(c);
    const ac = parseAcceptanceCriteria(desc);
    if (ac.length === 0) warnings.push(`no Acceptance criteria section; fell back to title: ${c.title}`);
    const { allowedPaths, forbiddenPaths } = parseScope(desc);
    if (allowedPaths.length === 0) warnings.push(`scope defaulted to whole tree (no allowedPaths marker): ${c.title}`);
    const deps: string[] = [];
    for (const bid of blockedBy.get(c.id) ?? []) {
      const b = byId.get(bid);
      if (!b) continue;
      if (!includedIds.has(bid)) {
        warnings.push(`dependency outside sprint subtree dropped: ${c.title} ← ${b.title}`);
        continue;
      }
      deps.push(bid);
    }
    const personaLabel = c.labels.find((l) => personaLabels.has(l));
    tasks.push({
      taskId: c.id, // issue ID preserved through to the graph
      objective: c.title,
      acceptanceCriteria: ac.length > 0 ? ac : [c.title],
      dependencies: deps,
      scope: {
        allowedPaths: allowedPaths.length > 0 ? allowedPaths : ["**"],
        forbiddenPaths,
      },
      gates: [],
      worker: PERSONA_TO_WORKER,
      review: "human",
      maxAttempts: 1,
      persona: personaLabel,
      escalation: "operator",
    });
  }

  return {
    doc: {
      schemaVersion: 1,
      sprintId: parentId,
      project: { projectId },
      approvedBy: UNAPPROVED_BY,
      approvedAt: UNAPPROVED_AT,
      tasks,
    },
    warnings,
    excludedBlocked,
    excludedInvalid,
    excludedBacklog,
  };
}

/** Record explicit operator approval on a generated SprintDocument file. */
export function approveSprint(file: string, actor: string): SprintDocument {
  const raw = readFileSync(file, "utf-8");
  const doc = JSON.parse(raw) as SprintDocument;
  if (!doc || !Array.isArray(doc.tasks)) {
    throw new Error(`Not a SprintDocument: ${file}`);
  }
  doc.approvedBy = actor;
  doc.approvedAt = new Date().toISOString();
  const tmp = `${file}.approving`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2) + "\n", "utf-8");
  renameSync(tmp, file);
  return doc;
}