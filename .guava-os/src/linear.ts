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
import { allPersonaLabels } from "./config.js";

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
  /** Markdown body (needed for sprint generation). */
  description?: string;
  /** Out-edges of native "blocks" relations (this issue blocks these ids). */
  blocks?: string[];
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
  hasPersonaLabels: boolean;
  hasSubtasks: boolean;
}

export interface ExecutableSubtask {
  id: string;
  title: string;
  priority: number;
  priorityName: string;
  persona: string;
  parentId: string;
  updatedAt: string;
}

export interface NotPromotedSubtask {
  id: string;
  title: string;
  persona: string;
  status: string;
}

export interface BlockedSubtask {
  id: string;
  title: string;
  persona: string;
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
  const personaLabels = allPersonaLabels(config);
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

  // Separate parents and sub-issues using Linear's native parentId relationship
  const parentMap = new Map<string, LinearIssue>();
  const subtasksByParent = new Map<string, LinearIssue[]>();
  const allSubtasks: LinearIssue[] = [];

  for (const issue of issues) {
    if (issue.canceledAt) continue;

    if (issue.parentId) {
      allSubtasks.push(issue);
      const existing = subtasksByParent.get(issue.parentId) || [];
      existing.push(issue);
      subtasksByParent.set(issue.parentId, existing);
    } else {
      parentMap.set(issue.id, issue);
    }
  }

  // Build parent health
  const parents: ParentHealth[] = [];
  for (const [id, parent] of parentMap) {
    const subs = subtasksByParent.get(id) || [];
    const done = subs.filter(s => s.statusType === "completed").length;
    const inProgress = subs.filter(s =>
      s.status === config.statuses.in_progress || s.status === config.statuses.in_review
    ).length;
    const todo = subs.filter(s => s.status === config.statuses.todo).length;
    const backlog = subs.filter(s => s.statusType === "backlog").length;
    const hasPersonaLabels = subs.length > 0 && subs.every(s =>
      s.labels.some(l => personaLabels.includes(l))
    );

    parents.push({
      id, title: parent.title, status: parent.status,
      subtasks: subs, done, inProgress, todo, backlog,
      total: subs.length, hasPersonaLabels,
      hasSubtasks: subs.length > 0,
    });
  }

  // Categorize sub-issues
  const executable = new Map<string, ExecutableSubtask[]>();
  const notPromoted: NotPromotedSubtask[] = [];
  const blocked: BlockedSubtask[] = [];
  const invalid: InvalidSubtask[] = [];

  for (const persona of personaLabels) {
    executable.set(persona, []);
  }

  for (const sub of allSubtasks) {
    if (sub.statusType === "completed") continue;

    const matchedLabels = sub.labels.filter(l => personaLabels.includes(l));

    // INVALID: missing persona label
    if (matchedLabels.length === 0) {
      invalid.push({
        id: sub.id, title: sub.title,
        violation: "missing persona label",
      });
      continue;
    }

    const persona = matchedLabels[0];

    // INVALID: multiple persona labels
    if (matchedLabels.length > 1) {
      invalid.push({
        id: sub.id, title: sub.title,
        violation: `multiple persona labels: ${matchedLabels.join(", ")}`,
      });
      continue;
    }

    // NOT_PROMOTED: sub-issue in Backlog
    if (sub.statusType === "backlog") {
      notPromoted.push({
        id: sub.id, title: sub.title, persona, status: sub.status,
      });
      continue;
    }

    // In Progress or In Review — actively being worked, not in any category
    if (sub.status !== config.statuses.todo) {
      continue;
    }

    // Status is Todo — check parent eligibility
    const parent = parentMap.get(sub.parentId!);

    // INVALID: parent not found in dataset (orphan sub-issue)
    if (!parent) {
      invalid.push({
        id: sub.id, title: sub.title,
        violation: `parent ${sub.parentId} not found in project issues`,
      });
      continue;
    }

    // INVALID: parent not active
    if (!activeParentStatuses.includes(parent.status)) {
      invalid.push({
        id: sub.id, title: sub.title,
        violation: `parent ${parent.id} status "${parent.status}" is not active (requires: ${activeParentStatuses.join(" or ")})`,
      });
      continue;
    }

    // BLOCKED: native relation blocker not yet completed (GOS-28).
    if (dependencyRelationsLoaded) {
      const blockers = blockedBy.get(sub.id);
      if (blockers && blockers.size > 0) {
        const unresolved: string[] = [];
        for (const bid of blockers) {
          const b = parentMap.get(bid) ?? issues.find((i) => i.id === bid);
          if (b && b.statusType !== "completed" && !b.canceledAt) {
            unresolved.push(b.title);
          }
        }
        if (unresolved.length > 0) {
          blocked.push({
            id: sub.id, title: sub.title, persona,
            reason: `blocked by: ${unresolved.join(", ")}`,
          });
          continue;
        }
      }
    }

    // Eligible
    const queue = executable.get(persona)!;
    queue.push({
      id: sub.id,
      title: sub.title,
      priority: sub.priority.value,
      priorityName: sub.priority.name,
      persona,
      parentId: sub.parentId!,
      updatedAt: sub.updatedAt,
    });
  }

  // Sort each persona queue: priority asc (1=urgent), then oldest updatedAt, then lowest ID
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
    !issues.find(i => i.id === p.id)?.canceledAt && p.status !== config.statuses.done
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
    summary, capabilities: { dependencyRelationsLoaded },
  };
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "None", 1: "P0/Urgent", 2: "P1/High", 3: "P2/Medium", 4: "P3/Low",
};

export function priorityLabel(value: number): string {
  return PRIORITY_LABELS[value] || `P${value}`;
}
