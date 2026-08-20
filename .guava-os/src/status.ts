/**
 * Status formatters.
 *
 * Both human and JSON formatters read from the same IssueGraph
 * and use graph.summary for all counts. No independent recomputation.
 */

import type { IssueGraph } from "./linear.js";
import { priorityLabel } from "./linear.js";

export function formatStatus(graph: IssueGraph): string {
  const lines: string[] = [];
  const { summary, capabilities } = graph;

  // EXECUTABLE
  lines.push("EXECUTABLE");
  for (const [role, queue] of graph.executable) {
    if (queue.length === 0) {
      lines.push(`  ${role}:`.padEnd(16) + "(none)");
    } else {
      for (let i = 0; i < queue.length; i++) {
        const s = queue[i];
        const prefix = i === 0 ? `  ${role}:`.padEnd(16) : " ".repeat(16);
        lines.push(`${prefix}${s.id} [${priorityLabel(s.priority)}] "${s.title}"`);
      }
    }
  }

  // NOT_PROMOTED
  if (graph.notPromoted.length > 0) {
    lines.push("");
    lines.push("NOT_PROMOTED");
    for (const s of graph.notPromoted) {
      lines.push(`  ${s.id}  [${s.role}] "${s.title}"`);
    }
  }

  // BLOCKED
  if (graph.blocked.length > 0) {
    lines.push("");
    lines.push("BLOCKED");
    for (const b of graph.blocked) {
      lines.push(`  ${b.id}  [${b.role}] ${b.reason}`);
    }
  }
  if (!capabilities.dependencyRelationsLoaded) {
    lines.push("");
    lines.push("BLOCKED (dependency relations not loaded — blocker detection unavailable)");
  }
  if (capabilities.hasExternalBlockerGap && summary.totalExecutable > 0) {
    lines.push("");
    lines.push("NOTE: External blockers may exist outside the snapshot — executable items may be blocked by issues not in this dataset.");
  }

  // INVALID
  if (graph.invalid.length > 0) {
    lines.push("");
    lines.push("INVALID");
    for (const v of graph.invalid) {
      lines.push(`  ${v.id}  ${v.violation}`);
    }
  }

  // PARENTS
  lines.push("");
  lines.push("PARENTS");
  const displayParents = graph.parents.filter(p => p.status !== "Done");
  if (displayParents.length === 0) {
    lines.push("  (no active parents)");
  } else {
    for (const p of displayParents) {
      const completion = `${p.done}/${p.total}`;
      const parts: string[] = [];
      if (p.done > 0) parts.push(`${p.done} Done`);
      if (p.inProgress > 0) parts.push(`${p.inProgress} In Progress`);
      if (p.todo > 0) parts.push(`${p.todo} Todo`);
      if (p.backlog > 0) parts.push(`${p.backlog} Backlog`);
      const detail = parts.length > 0 ? `(${parts.join(", ")})` : "(no subtasks)";
      lines.push(`  ${p.id}  ${p.status.padEnd(13)} ${completion.padEnd(5)} subtasks  ${detail}`);
      if (!p.hasSubtasks) {
        lines.push(`         ^ WARNING: parent has no sub-issues`);
      } else if (!p.hasRoleLabels) {
        lines.push(`         ^ WARNING: some sub-issues missing role labels`);
      }
    }
  }

  // SUMMARY — uses canonical graph.summary, no recomputation
  lines.push("");
  lines.push(`SUMMARY: ${summary.totalExecutable} executable, ${summary.totalNotPromoted} not promoted, ${summary.totalBlocked} blocked, ${summary.totalInvalid} invalid, ${summary.activeParentCount} active parents`);

  return lines.join("\n");
}

export function formatStatusJson(graph: IssueGraph): object {
  const executable: Record<string, object[]> = {};
  for (const [role, queue] of graph.executable) {
    executable[role] = queue.map(s => ({
      id: s.id, title: s.title,
      priority: s.priority, priorityName: s.priorityName,
      role: s.role, parentId: s.parentId,
    }));
  }

  return {
    executable,
    not_promoted: graph.notPromoted.map(s => ({
      id: s.id, title: s.title, role: s.role, status: s.status,
    })),
    blocked: graph.blocked.map(b => ({
      id: b.id, title: b.title, role: b.role, reason: b.reason,
    })),
    invalid: graph.invalid.map(v => ({
      id: v.id, title: v.title, violation: v.violation,
    })),
    parents: graph.parents
      .filter(p => p.status !== "Done")
      .map(p => ({
        id: p.id, title: p.title, status: p.status,
        subtasks: p.total, done: p.done, inProgress: p.inProgress,
        todo: p.todo, backlog: p.backlog,
        hasRoleLabels: p.hasRoleLabels,
        hasSubtasks: p.hasSubtasks,
      })),
    summary: graph.summary,
    capabilities: graph.capabilities,
  };
}
