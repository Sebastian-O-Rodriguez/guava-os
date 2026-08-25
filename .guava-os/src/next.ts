/**
 * Next directive generator.
 *
 * Compiles the execution graph into operator-ready launch directives.
 * One directive per domain: the highest-priority executable subtask, plus the
 * OMP agent type that domain routes to.
 *
 * READ-ONLY: No mutation, claiming, assignment, or side effects.
 * Derives entirely from the canonical IssueGraph — no independent
 * classification or recomputation.
 */

import type { IssueGraph, ExecutableSubtask, GraphCapabilities } from "./linear.js";
import { priorityLabel } from "./linear.js";
import type { Config } from "./config.js";
import { agentForDomain } from "./config.js";

export interface Directive {
  domain: string;
  /** OMP agent type this domain routes to (e.g. reviewer, designer, task). */
  agent: string;
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
    domains_with_work: number;
    domains_without_work: number;
    total_executable: number;
  };
  capabilities: GraphCapabilities;
}

function buildBranch(config: Config, domain: string, task: ExecutableSubtask): string {
  const prefix = config.linear.issue_prefix.toLowerCase();
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
  return config.branch_pattern
    .replace("{domain}", domain)
    .replace("{prefix}", prefix)
    .replace("{id}", idNum)
    .replace("{slug}", slug);
}

function buildContext(
  domain: string,
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
  if (graph.capabilities.hasExternalBlockerGap) {
    ctx.push("external blockers may exist outside snapshot");
  }

  // Queue depth
  if (queue.length > 1) {
    ctx.push(`${queue.length} executable ${domain} items total`);
  }

  return ctx;
}

export function generateNext(
  graph: IssueGraph,
  config: Config,
  domainFilter?: string,
): NextResult {
  const directives: Directive[] = [];
  let withWork = 0;
  let withoutWork = 0;

  for (const [domain, queue] of graph.executable) {
    if (domainFilter && domain !== domainFilter) continue;

    if (queue.length === 0) {
      withoutWork++;
      continue;
    }

    withWork++;
    const top = queue[0];

    directives.push({
      domain,
      agent: agentForDomain(config, domain),
      issue_id: top.id,
      title: top.title,
      branch: buildBranch(config, domain, top),
      priority: { value: top.priority, label: priorityLabel(top.priority) },
      parent_id: top.parentId,
      context: buildContext(domain, queue, graph),
    });
  }

  // Deterministic sort: by priority value ascending, then domain alphabetically
  directives.sort((a, b) => {
    if (a.priority.value !== b.priority.value) return a.priority.value - b.priority.value;
    return a.domain.localeCompare(b.domain);
  });

  return {
    directives,
    summary: {
      domains_with_work: withWork,
      domains_without_work: withoutWork,
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
    lines.push("  (no executable work for any domain)");
    lines.push("");
    lines.push(`SUMMARY: ${result.summary.domains_with_work} domains with work, ${result.summary.total_executable} executable total`);
    return lines.join("\n");
  }

  lines.push("NEXT");

  for (const d of result.directives) {
    lines.push("");
    lines.push(`${d.domain}`);
    lines.push(`  AGENT:    ${d.agent}`);
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
  lines.push(`SUMMARY: ${result.summary.domains_with_work} domains with work, ${result.summary.total_executable} executable total`);

  if (result.capabilities.hasExternalBlockerGap && result.directives.length > 0) {
    lines.push("NOTE: External blockers may exist outside the snapshot — directives may target issues blocked by out-of-dataset work.");
  }

  return lines.join("\n");
}