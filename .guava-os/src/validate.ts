/**
 * Validate — detects protocol violations from an execution graph.
 *
 * READ-ONLY: Pure function. Takes graph + config, returns violations.
 * No network calls. No mutations. No side effects.
 */

import type { Config } from "./config.js";
import { allDomains, readinessLabels } from "./config.js";
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
  const domainLabels = allDomains(config);
  const typeLabels = config.types;
  const readiness = readinessLabels(config);
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
  // domain/queue checks apply to deliverables only (GUA-111).
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
  // Fires for active top-level issues that have NO children AND NO domain label.
  // Standalone deliverables (have domain) are excluded — they're executable candidates.
  // Real containers (have children) are excluded — they group work.
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (issue.parentId) continue; // child deliverables — handled by other codes
    if (!activeParentStatuses.includes(issue.status)) continue;

    // Skip if this issue has non-canceled children (it's a real container)
    const hasChildren = issues.some(i => i.parentId === issue.id && !i.canceledAt);
    if (hasChildren) continue;

    // Skip if it has a domain label (it's a standalone deliverable)
    const hasDomain = issue.labels.some(l => domainLabels.includes(l));
    if (hasDomain) continue;

    // Degenerate: no children, no domain — an empty parent with no reason to exist
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
  // The cap applies to ACTIVE containers (planning skill: "an active container
  // exceeds the cap"); a Backlog grouping is not a scheduled sprint, so an
  // oversized backlog parent is allowed until it becomes active. Applies to
  // nested containers too, not just top-level parents.
  const subtaskCap = config.invariants?.max_subtasks_per_parent ?? 3;
  for (const [id] of subtasksByParent) {
    const parent = allById.get(id);
    if (!parent || parent.canceledAt || parent.statusType === "completed") continue;
    if (!activeParentStatuses.includes(parent.status)) continue;
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

  // ── V306: container_domain_label ──
  // Containers are groupings and must carry NO domain label (GOS-21: labels
  // classify deliverables; parents never execute). A domain label on a
  // container is metadata drift — flag so it can be cleaned via
  // `pm update <id> --label <remaining labels>`.
  for (const id of containerIds) {
    const container = allById.get(id);
    if (!container) continue;
    const matched = container.labels.filter((l) => domainLabels.includes(l));
    if (matched.length > 0) {
      violations.push({
        code: "V306",
        name: "container_domain_label",
        severity: "warning",
        issue_id: id,
        detail: `Container carries domain label(s): ${matched.join(", ")} — containers are groupings and must have no domain label (remove via pm update)`,
      });
    }
  }

  // ── V400: missing_domain_label ──
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (containerIds.has(issue.id)) continue;

    const matched = issue.labels.filter(l => domainLabels.includes(l));
    if (matched.length === 0) {
      violations.push({
        code: "V400",
        name: "missing_domain_label",
        severity: "error",
        issue_id: issue.id,
        detail: "deliverable has no domain label — not routable",
      });
    }
  }

  // ── V402: unknown_label ──
  // Any label that is neither a configured domain, a work type, nor a
  // readiness label is unrecognized metadata drift.
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;

    for (const label of issue.labels) {
      if (!domainLabels.includes(label) && !typeLabels.includes(label) && !readiness.includes(label)) {
        violations.push({
          code: "V402",
          name: "unknown_label",
          severity: "warning",
          issue_id: issue.id,
          detail: `Label "${label}" is not a configured domain, type, or readiness label`,
        });
      }
    }
  }

  // ── V403: multiple_domain_labels ──
  // A deliverable maps to ONE domain (which skills to load). More than one is
  // ambiguous routing — warning, not error (domain rollout is additive).
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (containerIds.has(issue.id)) continue;
    const matched = issue.labels.filter(l => domainLabels.includes(l));
    if (matched.length > 1) {
      violations.push({
        code: "V403",
        name: "multiple_domain_labels",
        severity: "warning",
        issue_id: issue.id,
        detail: `Sub-issue has multiple domain labels: ${matched.join(", ")}`,
      });
    }
  }

  // ── V404: readiness_label_count ──
  // An open, non-container deliverable must carry EXACTLY ONE readiness label
  // (untriaged / ready / needs-rescoping). Zero or many is a routing error.
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (containerIds.has(issue.id)) continue;

    const matched = issue.labels.filter((l) => readiness.includes(l));
    if (matched.length !== 1) {
      violations.push({
        code: "V404",
        name: "readiness_label_count",
        severity: "error",
        issue_id: issue.id,
        detail: `Deliverable has ${matched.length} readiness label(s) — expected exactly 1 of [${readiness.join(", ")}]`,
      });
    }
  }

  // ── V405: missing_description_sections ──
  // An open deliverable's description must carry the three canonical sections.
  const REQUIRED_SECTIONS = ["## Why this exists", "## Scope", "## Acceptance criteria"];
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (containerIds.has(issue.id)) continue;

    const description = issue.description ?? "";
    const missing = REQUIRED_SECTIONS.filter((s) => !description.includes(s));
    if (missing.length > 0) {
      violations.push({
        code: "V405",
        name: "missing_description_sections",
        severity: "error",
        issue_id: issue.id,
        detail: `Description missing section(s): ${missing.join(", ")}`,
      });
    }
  }

  // ── V500: queue_overflow ──
  const todoCountByDomain = new Map<string, number>();
  for (const issue of issues) {
    if (issue.canceledAt || issue.statusType === "completed") continue;
    if (containerIds.has(issue.id)) continue;
    if (issue.status !== config.statuses.todo) continue;

    const matched = issue.labels.filter(l => domainLabels.includes(l));
    if (matched.length === 1) {
      const domain = matched[0];
      todoCountByDomain.set(domain, (todoCountByDomain.get(domain) || 0) + 1);
    }
  }
  for (const [domain, count] of todoCountByDomain) {
    if (count > config.invariants.max_todo_per_domain) {
      violations.push({
        code: "V500",
        name: "queue_overflow",
        severity: "warning",
        issue_id: `(${domain})`,
        detail: `${count} Todo sub-issues for domain "${domain}" exceeds max ${config.invariants.max_todo_per_domain}`,
      });
    }
  }
  // ── V307: external_blocker_gap ──
  // Fires when blocker relations were loaded from a partial snapshot and
  // executable candidates exist — external blockers (issues outside the
  // dataset) may be blocking these candidates undetected.
  if (graph.capabilities.hasExternalBlockerGap && graph.summary.totalExecutable > 0) {
    violations.push({
      code: "V307",
      name: "external_blocker_gap",
      severity: "warning",
      issue_id: "(executable)",
      detail: `${graph.summary.totalExecutable} executable candidate(s) may be blocked by issues outside this dataset — snapshot cannot enumerate incoming relations from out-of-snapshot issues`,
    });
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
