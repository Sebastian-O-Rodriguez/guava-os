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

  // Build parent lookup
  const parentMap = new Map<string, LinearIssue>();
  const subtasksByParent = new Map<string, LinearIssue[]>();

  for (const issue of issues) {
    if (issue.canceledAt) continue;
    if (issue.parentId) {
      const existing = subtasksByParent.get(issue.parentId) || [];
      existing.push(issue);
      subtasksByParent.set(issue.parentId, existing);
    } else {
      parentMap.set(issue.id, issue);
    }
  }

  // ── V302: orphan_sub_issue ──
  for (const issue of issues) {
    if (issue.canceledAt) continue;
    if (issue.parentId && !parentMap.has(issue.parentId)) {
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

    const parent = parentMap.get(issue.parentId);
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
  for (const [id, parent] of parentMap) {
    if (parent.canceledAt || parent.statusType === "completed") continue;
    if (!activeParentStatuses.includes(parent.status)) continue;

    const subs = subtasksByParent.get(id) || [];
    if (subs.length === 0) {
      violations.push({
        code: "V304",
        name: "empty_parent",
        severity: "warning",
        issue_id: id,
        detail: `Parent issue in "${parent.status}" has no sub-issues`,
      });
    }
  }

  // ── V400: missing_persona_label ──
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (!issue.parentId) continue; // only check sub-issues

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
    if (!issue.parentId) continue;

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
    if (!issue.parentId) continue;

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
    if (!issue.parentId) continue;
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
