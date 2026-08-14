/**
 * Validate — detects protocol violations from an execution graph.
 *
 * READ-ONLY: Pure function. Takes graph + config, returns violations.
 * No network calls. No mutations. No side effects.
 */

import type { Config } from "./config.js";
import { allPersonaLabels } from "./config.js";
import type { IssueGraph, LinearIssue } from "./linear.js";

export type ViolationSeverity = "error" | "warning";

export interface Violation {
  code: string;
  name: string;
  severity: ViolationSeverity;
  issue_id: string;
  detail: string;
}

export interface ValidateSummary {
  errors: number;
  warnings: number;
  total: number;
}

export interface ValidateResult {
  summary: ValidateSummary;
  violations: Violation[];
}

/**
 * Run all violation checks against the execution graph.
 * Returns a deterministic, sorted list of violations.
 */
export function runValidate(graph: IssueGraph, issues: LinearIssue[], config: Config): ValidateResult {
  const violations: Violation[] = [];
  const personaLabels = allPersonaLabels(config);
  const activeParentStatuses = config.active_parent_statuses;

  // Build a full issue lookup (ANY nesting level) + children-by-parent map.
  // Parent existence/status checks must see nested containers, not just
  // top-level issues (nested decomposition — wave → container → leaves).
  const allById = new Map<string, LinearIssue>();
  const subtasksByParent = new Map<string, LinearIssue[]>();

  for (const issue of issues) {
    if (issue.canceledAt) continue;
    allById.set(issue.id, issue);
    if (issue.parentId) {
      const existing = subtasksByParent.get(issue.parentId) || [];
      existing.push(issue);
      subtasksByParent.set(issue.parentId, existing);
    }
  }

  // Containers (issues with ≥1 child) are groupings, not deliverables —
  // persona/queue checks apply to deliverables only (GUA-111).
  const containerIds = new Set(
    issues.filter((i) => !i.canceledAt && subtasksByParent.has(i.id)).map((i) => i.id),
  );

  // ── V302: orphan_sub_issue ──
  for (const issue of issues) {
    if (issue.canceledAt) continue;
    if (issue.parentId && !allById.has(issue.parentId)) {
      violations.push({
        code: "V302",
        name: "orphan_sub_issue",
        severity: "warning",
        issue_id: issue.id,
        detail: `Sub-issue references parent ${issue.parentId} not found in project dataset`,
      });
    }
  }

  // ── V303: parent_not_active ──
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (!issue.parentId) continue;
    if (issue.status !== config.statuses.todo) continue;

    const parent = allById.get(issue.parentId);
    if (parent && !activeParentStatuses.includes(parent.status)) {
      violations.push({
        code: "V303",
        name: "parent_not_active",
        severity: "error",
        issue_id: issue.id,
        detail: `Parent ${parent.id} status "${parent.status}" is not active (requires: ${activeParentStatuses.join(" or ")})`,
      });
    }
  }

  // ── V304: empty_parent ──
  // Fires for active top-level issues that have NO children AND NO persona label.
  // Standalone deliverables (have persona) are excluded — they're executable candidates.
  // Real containers (have children) are excluded — they group work.
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (issue.parentId) continue; // child deliverables — handled by other codes
    if (!activeParentStatuses.includes(issue.status)) continue;

    // Skip if this issue has non-canceled children (it's a real container)
    const hasChildren = issues.some(i => i.parentId === issue.id && !i.canceledAt);
    if (hasChildren) continue;

    // Skip if it has a persona label (it's a standalone deliverable)
    const hasPersona = issue.labels.some(l => personaLabels.includes(l));
    if (hasPersona) continue;

    // Degenerate: no children, no persona — an empty parent with no reason to exist
    violations.push({
      code: "V304",
      name: "empty_parent",
      severity: "warning",
      issue_id: issue.id,
      detail: `Parent issue in "${issue.status}" has no sub-issues`,
    });
  }

  // ── V305: subtask_overflow ──
  // Enforced invariant (GOS-39): children per parent ≤ max_subtasks_per_parent.
  // Cap applies per parent; split work across multiple parents to stay within it.
  // Applies to EVERY container (nested ones too), not just top-level parents.
  const subtaskCap = config.invariants?.max_subtasks_per_parent ?? 3;
  for (const [id] of subtasksByParent) {
    const parent = allById.get(id);
    if (!parent || parent.canceledAt || parent.statusType === "completed") continue;
    const subs = (subtasksByParent.get(id) || []).filter((s) => !s.canceledAt);
    if (subs.length > subtaskCap) {
      violations.push({
        code: "V305",
        name: "subtask_overflow",
        severity: "error",
        issue_id: id,
        detail: `Parent ${parent.id} has ${subs.length} sub-issues, exceeds max_subtasks_per_parent ${subtaskCap} — split across multiple parents`,
      });
    }
  }

  // ── V306: container_persona_label ──
  // Containers are groupings and must carry NO persona label (GOS-21: labels
  // classify deliverables; parents never execute). A persona label on a
  // container is metadata drift — flag so it can be cleaned via
  // `pm update <id> --label <remaining labels>`.
  for (const id of containerIds) {
    const container = allById.get(id);
    if (!container) continue;
    const matched = container.labels.filter((l) => personaLabels.includes(l));
    if (matched.length > 0) {
      violations.push({
        code: "V306",
        name: "container_persona_label",
        severity: "warning",
        issue_id: id,
        detail: `Container carries persona label(s): ${matched.join(", ")} — containers are groupings and must have no persona label (remove via pm update)`,
      });
    }
  }

  // ── V400: missing_persona_label ──
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (containerIds.has(issue.id)) continue;

    const matched = issue.labels.filter(l => personaLabels.includes(l));
    if (matched.length === 0) {
      violations.push({
        code: "V400",
        name: "missing_persona_label",
        severity: "error",
        issue_id: issue.id,
        detail: "Sub-issue has no persona label — not routable to any agent",
      });
    }
  }

  // ── V401: multiple_persona_labels ──
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (containerIds.has(issue.id)) continue;

    const matched = issue.labels.filter(l => personaLabels.includes(l));
    if (matched.length > 1) {
      violations.push({
        code: "V401",
        name: "multiple_persona_labels",
        severity: "error",
        issue_id: issue.id,
        detail: `Sub-issue has multiple persona labels: ${matched.join(", ")}`,
      });
    }
  }

  // ── V402: unknown_persona_label ──
  // Labels on sub-issues that look like they could be persona labels but aren't in config.
  // We check for labels that are NOT in personaLabels and NOT in the known non-persona set.
  const knownNonPersona = new Set(["Feature", "Bug", "Improvement"]);
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;

    for (const label of issue.labels) {
      if (!personaLabels.includes(label) && !knownNonPersona.has(label)) {
        violations.push({
          code: "V402",
          name: "unknown_persona_label",
          severity: "warning",
          issue_id: issue.id,
          detail: `Label "${label}" is not a configured persona or known category label`,
        });
      }
    }
  }

  // ── V500: queue_overflow ──
  const todoCountByPersona = new Map<string, number>();
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (containerIds.has(issue.id)) continue;
    if (issue.status !== config.statuses.todo) continue;

    const matched = issue.labels.filter(l => personaLabels.includes(l));
    if (matched.length === 1) {
      const persona = matched[0];
      todoCountByPersona.set(persona, (todoCountByPersona.get(persona) || 0) + 1);
    }
  }
  for (const [persona, count] of todoCountByPersona) {
    if (count > config.invariants.max_todo_per_persona) {
      violations.push({
        code: "V500",
        name: "queue_overflow",
        severity: "warning",
        issue_id: `(${persona})`,
        detail: `${count} Todo sub-issues for persona "${persona}" exceeds max ${config.invariants.max_todo_per_persona}`,
      });
    }
  }

  // Sort: severity (error first), then code, then issue_id
  violations.sort((a, b) => {
    const sevOrder = a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1;
    if (sevOrder !== 0) return sevOrder;
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    return a.issue_id.localeCompare(b.issue_id);
  });

  const errors = violations.filter(v => v.severity === "error").length;
  const warnings = violations.filter(v => v.severity === "warning").length;

  return {
    summary: { errors, warnings, total: violations.length },
    violations,
  };
}

export function formatValidate(result: ValidateResult): string {
  const lines: string[] = [];

  if (result.violations.length === 0) {
    lines.push("VALIDATE: no violations found");
    return lines.join("\n");
  }

  // Group by severity
  const errors = result.violations.filter(v => v.severity === "error");
  const warnings = result.violations.filter(v => v.severity === "warning");

  if (errors.length > 0) {
    lines.push("ERRORS");
    for (const v of errors) {
      lines.push(`  ${v.code} ${v.name.padEnd(26)} ${v.issue_id.padEnd(12)} ${v.detail}`);
    }
  }

  if (warnings.length > 0) {
    if (errors.length > 0) lines.push("");
    lines.push("WARNINGS");
    for (const v of warnings) {
      lines.push(`  ${v.code} ${v.name.padEnd(26)} ${v.issue_id.padEnd(12)} ${v.detail}`);
    }
  }

  lines.push("");
  lines.push(`SUMMARY: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.total} total`);

  return lines.join("\n");
}
