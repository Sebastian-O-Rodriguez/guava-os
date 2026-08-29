/**
 * Linear data types and graph builder.
 *
 * READ-ONLY: This module never calls Linear. It receives pre-fetched
 * issue data via stdin and builds the execution graph.
 * No mutation methods exist anywhere in the CLI.
 *
 * DATA FLOW:
 *   Caller (MCP tools) → JSON stdin → buildGraph() → IssueGraph
 *   The CLI has no network layer. Linear reachability is determined
 *   by the caller providing data, not by the CLI querying Linear.
 */

import type { Config } from "./config.js";
import { allDomains } from "./config.js";

export interface LinearIssue {
  id: string;
  /** Canonical Linear identifier (e.g. `GUA-113`) — sole identity after creation. */
  identifier: string;
  title: string;
  status: string;
  statusType: string;
  priority: { value: number; name: string };
  labels: string[];
  parentId?: string;
  project: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  assignee?: string;
  /** Markdown body — the issue's Why/Scope/Acceptance description (the subagent's task contract). */
  description?: string;
  /** Out-edges of native "blocks" relations (this issue blocks these ids). */
  blocks?: string[];
  /** Full comment thread, oldest first (Linear default order). */
  comments?: LinearComment[];
}

/** A single comment in an issue's thread. */
export interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** Display name of the author (undefined when the user was deleted). */
  author?: string;
}

export interface ParentHealth {
  id: string;
  title: string;
  status: string;
  subtasks: LinearIssue[];
  done: number;
  inProgress: number;
  todo: number;
  backlog: number;
  total: number;
  hasRoleLabels: boolean;
  hasSubtasks: boolean;
}

export interface ExecutableSubtask {
  id: string;
  title: string;
  priority: number;
  priorityName: string;
  role: string;
  parentId?: string;
  updatedAt: string;
}

export interface NotPromotedSubtask {
  id: string;
  title: string;
  role: string;
  status: string;
}

export interface BlockedSubtask {
  id: string;
  title: string;
  role: string;
  reason: string;
}

export interface InvalidSubtask {
  id: string;
  title: string;
  violation: string;
}

/** Canonical summary — computed once, consumed by all formatters and exit logic. */
export interface GraphSummary {
  totalExecutable: number;
  totalNotPromoted: number;
  totalBlocked: number;
  totalInvalid: number;
  activeParentCount: number;
}

/**
 * Declares which data capabilities were available when the graph was built.
 * Consumers MUST check capabilities before treating a category as authoritative.
 */
export interface GraphCapabilities {
  /**
   * True when the issue data carried native blocks-relation edges.
   * Blocked classification is authoritative ONLY for blockers that are
   * themselves present in the dataset (search cannot enumerate incoming
   * relations from issues outside the snapshot).
   */
  dependencyRelationsLoaded: boolean;
  /**
   * True when blocker data was loaded from a partial snapshot and
   * external blockers (issues outside the dataset) may exist undetected.
   * Executable classification may include false-ready work when this
   * flag is true: a blocked-by relation from an out-of-snapshot issue
   * is invisible to buildGraph. Consumers MUST surface a warning.
   *
   * This flag is always true when `dependencyRelationsLoaded` is true
   * under current snapshot-fetch semantics. It can become false only
   * when a future caller guarantees complete blocker data (full
   * workspace fetch with transitive closure).
   */
  hasExternalBlockerGap: boolean;
}

export interface IssueGraph {
  parents: ParentHealth[];
  executable: Map<string, ExecutableSubtask[]>;
  notPromoted: NotPromotedSubtask[];
  blocked: BlockedSubtask[];
  invalid: InvalidSubtask[];
  summary: GraphSummary;
  capabilities: GraphCapabilities;
}

export function buildGraph(issues: LinearIssue[], config: Config): IssueGraph {
  const domainLabels = allDomains(config);
  const activeParentStatuses = config.active_parent_statuses;

  // Blocks edges: out = this issue blocks X; inverse (blockedBy) computed
  // from the full dataset so either side of a relation can drive the check.
  const dependencyRelationsLoaded = issues.some((i) => (i.blocks?.length ?? 0) > 0);
  const blockedBy = new Map<string, Set<string>>();
  if (dependencyRelationsLoaded) {
    for (const issue of issues) {
      for (const target of issue.blocks ?? []) {
        const set = blockedBy.get(target) ?? new Set<string>();
        set.add(issue.id);
        blockedBy.set(target, set);
      }
    }
  }

  // Compute which IDs are someone's parent (used for container detection).
  // A container is an issue that has ≥1 non-canceled child pointing at it.
  const childOf = new Set<string>();
  const subtasksByParent = new Map<string, LinearIssue[]>();
  for (const issue of issues) {
    if (issue.canceledAt) continue;
    if (issue.parentId) {
      childOf.add(issue.parentId);
      const existing = subtasksByParent.get(issue.parentId) || [];
      existing.push(issue);
      subtasksByParent.set(issue.parentId, existing);
    }
  }

  // Build a lookup for all issues (needed for parent validation in deliverables).
  const allById = new Map<string, LinearIssue>();
  for (const issue of issues) {
    if (issue.canceledAt) continue;
    allById.set(issue.id, issue);
  }

  // Classify every non-canceled issue as container or deliverable.
  const containerIds = new Set<string>();
  const deliverables: LinearIssue[] = [];
  for (const issue of issues) {
    if (issue.canceledAt) continue;
    if (childOf.has(issue.id)) {
      containerIds.add(issue.id);
    } else {
      deliverables.push(issue);
    }
  }

  // Build parent health from containers only.
  const parents: ParentHealth[] = [];
  for (const id of containerIds) {
    const container = allById.get(id)!;
    const subs = subtasksByParent.get(id) || [];
    const done = subs.filter(s => s.statusType === "completed").length;
    const inProgress = subs.filter(s =>
      s.status === config.statuses.in_progress || s.status === config.statuses.in_review
    ).length;
    const todo = subs.filter(s => s.status === config.statuses.todo).length;
    const backlog = subs.filter(s => s.statusType === "backlog").length;
    const hasRoleLabels = subs.length > 0 && subs.every(s =>
      s.labels.some(l => domainLabels.includes(l))
    );

    parents.push({
      id, title: container.title, status: container.status,
      subtasks: subs, done, inProgress, todo, backlog,
      total: subs.length, hasRoleLabels,
      hasSubtasks: subs.length > 0,
    });
  }

  // Categorize deliverables (standalone + child).
  const executable = new Map<string, ExecutableSubtask[]>();
  const notPromoted: NotPromotedSubtask[] = [];
  const blocked: BlockedSubtask[] = [];
  const invalid: InvalidSubtask[] = [];

  for (const domain of domainLabels) {
    executable.set(domain, []);
  }

  for (const issue of deliverables) {
    if (issue.statusType === "completed") continue;

    const matchedLabels = issue.labels.filter(l => domainLabels.includes(l));

    // INVALID: missing domain label
    if (matchedLabels.length === 0) {
      invalid.push({
        id: issue.id, title: issue.title,
        violation: "missing domain label",
      });
      continue;
    }

    const domain = matchedLabels[0];

    // INVALID: multiple domain labels
    if (matchedLabels.length > 1) {
      invalid.push({
        id: issue.id, title: issue.title,
        violation: `multiple domain labels: ${matchedLabels.join(", ")}`,
      });
      continue;
    }

    // NOT_PROMOTED: deliverable in Backlog
    if (issue.statusType === "backlog") {
      notPromoted.push({
        id: issue.id, title: issue.title, role: domain, status: issue.status,
      });
      continue;
    }

    // In Progress or In Review — actively being worked, not in any category
    if (issue.status !== config.statuses.todo) {
      continue;
    }

    // Status is Todo — parent checks only for child deliverables.
    if (issue.parentId) {
      const parent = allById.get(issue.parentId);

      // INVALID: parent not found in dataset (orphan)
      if (!parent) {
        invalid.push({
          id: issue.id, title: issue.title,
          violation: `parent ${issue.parentId} not found in project issues`,
        });
        continue;
      }

      // INVALID: parent not active
      if (!activeParentStatuses.includes(parent.status)) {
        invalid.push({
          id: issue.id, title: issue.title,
          violation: `parent ${parent.id} status "${parent.status}" is not active (requires: ${activeParentStatuses.join(" or ")})`,
        });
        continue;
      }
    }

    // BLOCKED: native relation blocker not yet completed (GOS-28).
    // Applies to BOTH standalone and child deliverables.
    if (dependencyRelationsLoaded) {
      const blockers = blockedBy.get(issue.id);
      if (blockers && blockers.size > 0) {
        const unresolved: string[] = [];
        for (const bid of blockers) {
          const b = allById.get(bid) ?? issues.find((i) => i.id === bid);
          if (b && b.statusType !== "completed" && !b.canceledAt) {
            unresolved.push(b.title);
          }
        }
        if (unresolved.length > 0) {
          blocked.push({
            id: issue.id, title: issue.title, role: domain,
            reason: `blocked by: ${unresolved.join(", ")}`,
          });
          continue;
        }
      }
    }

    // Eligible
    const queue = executable.get(domain)!;
    queue.push({
      id: issue.id,
      title: issue.title,
      priority: issue.priority.value,
      priorityName: issue.priority.name,
      role: domain,
      parentId: issue.parentId,
      updatedAt: issue.updatedAt,
    });
  }

  // Sort each domain queue: priority asc (1=urgent), then oldest updatedAt, then lowest ID
  for (const [, queue] of executable) {
    queue.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  }

  // Compute canonical summary — single source of truth for all consumers
  let totalExecutable = 0;
  for (const [, queue] of executable) {
    totalExecutable += queue.length;
  }
  const activeParentCount = parents.filter(p =>
    p.status !== config.statuses.done
  ).length;

  const summary: GraphSummary = {
    totalExecutable,
    totalNotPromoted: notPromoted.length,
    totalBlocked: blocked.length,
    totalInvalid: invalid.length,
    activeParentCount,
  };

  return {
    parents, executable, notPromoted, blocked, invalid,
    summary, capabilities: { dependencyRelationsLoaded, hasExternalBlockerGap: dependencyRelationsLoaded },
  };
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "None", 1: "P0/Urgent", 2: "P1/High", 3: "P2/Medium", 4: "P3/Low",
};

export function priorityLabel(value: number): string {
  return PRIORITY_LABELS[value] || `P${value}`;
}
