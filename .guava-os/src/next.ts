/**
 * Next directive generator.
 *
 * Compiles the execution graph into operator-ready launch directives.
 * One directive per persona: the highest-priority executable subtask.
 *
 * READ-ONLY: No mutation, claiming, assignment, or side effects.
 * Derives entirely from the canonical IssueGraph — no independent
 * classification or recomputation.
 */

import type { IssueGraph, ExecutableSubtask, GraphCapabilities } from "./linear.js";
import { priorityLabel } from "./linear.js";
import type { Config } from "./config.js";

export interface Directive {
  persona: string;
  issue_id: string;
  title: string;
  branch: string;
  priority: { value: number; label: string };
  parent_id?: string;
  context: string[];
  /** Reserved for future dependency projection. Not populated in Phase 2A. */
  _reserved?: Record<string, unknown>;
}

export interface NextResult {
  directives: Directive[];
  summary: {
    personas_with_work: number;
    personas_without_work: number;
    total_executable: number;
  };
  capabilities: GraphCapabilities;
}

function buildBranch(config: Config, persona: string, task: ExecutableSubtask): string {
  const prefix = config.linear.issue_prefix;
  // Extract numeric part from issue ID (e.g., "GUA-17" → "17", "TST-10" → "10")
  const idNum = task.id.includes("-") ? task.id.split("-").slice(1).join("-") : task.id;
  const MAX_SLUG = 40;
  const full = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  let slug: string;
  if (full.length <= MAX_SLUG) {
    slug = full;
  } else {
    // Truncate at last complete word boundary within limit
    const truncated = full.slice(0, MAX_SLUG);
    const lastDash = truncated.lastIndexOf("-");
    slug = lastDash > 0 ? truncated.slice(0, lastDash) : truncated;
  }
  return `${persona}/${prefix.toLowerCase()}-${idNum}-${slug}`;
}

function buildContext(
  persona: string,
  queue: ExecutableSubtask[],
  graph: IssueGraph,
): string[] {
  const ctx: string[] = [];

  // Parent status
  const parentId = queue[0]?.parentId;
  if (parentId) {
    const parent = graph.parents.find(p => p.id === parentId);
    if (parent) {
      ctx.push(`parent ${parent.id} ${parent.status.toLowerCase()}`);
    }
  }

  // Dependency data availability
  if (!graph.capabilities.dependencyRelationsLoaded) {
    ctx.push("dependency detection unavailable");
  } else if (graph.blocked.length > 0) {
    ctx.push(`${graph.blocked.length} blocked by unresolved dependencies`);
  }

  // Queue depth
  if (queue.length > 1) {
    ctx.push(`${queue.length} executable ${persona} items total`);
  }

  return ctx;
}

export function generateNext(
  graph: IssueGraph,
  config: Config,
  personaFilter?: string,
): NextResult {
  const directives: Directive[] = [];
  let withWork = 0;
  let withoutWork = 0;

  for (const [persona, queue] of graph.executable) {
    if (personaFilter && persona !== personaFilter) continue;

    if (queue.length === 0) {
      withoutWork++;
      continue;
    }

    withWork++;
    const top = queue[0];

    directives.push({
      persona,
      issue_id: top.id,
      title: top.title,
      branch: buildBranch(config, persona, top),
      priority: { value: top.priority, label: priorityLabel(top.priority) },
      parent_id: top.parentId,
      context: buildContext(persona, queue, graph),
    });
  }

  // Deterministic sort: by priority value ascending, then persona alphabetically
  directives.sort((a, b) => {
    if (a.priority.value !== b.priority.value) return a.priority.value - b.priority.value;
    return a.persona.localeCompare(b.persona);
  });

  return {
    directives,
    summary: {
      personas_with_work: withWork,
      personas_without_work: withoutWork,
      total_executable: graph.summary.totalExecutable,
    },
    capabilities: graph.capabilities,
  };
}

export function formatNext(result: NextResult): string {
  const lines: string[] = [];

  if (result.directives.length === 0) {
    lines.push("NEXT");
    lines.push("");
    lines.push("  (no executable work for any persona)");
    lines.push("");
    lines.push(`SUMMARY: ${result.summary.personas_with_work} personas with work, ${result.summary.total_executable} executable total`);
    return lines.join("\n");
  }

  lines.push("NEXT");

  for (const d of result.directives) {
    lines.push("");
    lines.push(`${d.persona}`);
    lines.push(`  ISSUE:    ${d.issue_id}`);
    lines.push(`  TITLE:    ${d.title}`);
    lines.push(`  PRIORITY: ${d.priority.label}`);
    lines.push(`  PARENT:   ${d.parent_id}`);
    lines.push(`  BRANCH:   ${d.branch}`);

    if (d.context.length > 0) {
      lines.push("");
      lines.push("  CONTEXT");
      for (const c of d.context) {
        lines.push(`    - ${c}`);
      }
    }
  }

  lines.push("");
  lines.push(`SUMMARY: ${result.summary.personas_with_work} personas with work, ${result.summary.total_executable} executable total`);

  return lines.join("\n");
}
