/**
 * Graph drift computation: compare a persisted execution graph against a
 * desired-state input (SprintDocument) to produce a readable diff.
 *
 * Read-only operation — never mutates.
 */
import type { ExecutionGraph, GraphNode, NodeState, RequiredCommand } from "../contracts/types.js";

// ── Sprint document shape (subset used for comparison) ──────────────────────

interface SprintTask {
  readonly taskId: string;
  readonly taskType?: string;
  readonly objective: string;
  readonly acceptanceCriteria: readonly string[];
  readonly dependencies: readonly string[];
  readonly scope: { readonly allowedPaths: readonly string[]; readonly forbiddenPaths: readonly string[] };
  readonly gates: readonly RequiredCommand[];
  readonly expectedArtifacts?: readonly string[];
  readonly worker: string;
  readonly review: "human" | "fixture-auto";
  readonly persona?: string;
}

interface SprintDoc {
  readonly sprintId: string;
  readonly project: { readonly projectId: string };
  readonly tasks: readonly SprintTask[];
}

// ── Drift diff types ────────────────────────────────────────────────────────

export interface TaskFieldChange {
  readonly field: string;
  readonly sprint: string;
  readonly graph: string;
}

export interface DriftDiff {
  /** Task IDs in sprint but not in graph. */
  readonly added: readonly string[];
  /** Task IDs in graph but not in sprint. */
  readonly removed: readonly string[];
  /** Tasks present in both with field-level deltas. */
  readonly tasksChanged: readonly {
    readonly taskId: string;
    readonly changes: readonly TaskFieldChange[];
  }[];
  /** Per-task dependency edge deltas. Only tasks with changed edges appear. */
  readonly dependenciesChanged: readonly {
    readonly taskId: string;
    readonly added: readonly string[];
    readonly removed: readonly string[];
  }[];
  /** Current graph node states. Keyed by nodeId; only present for tasks in the graph. */
  readonly nodeStates: Readonly<Record<string, NodeState>>;
  /** True if any kind of drift (or non-pending node states) exists. */
  readonly hasDrift: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Canonical (key-sorted, compact) JSON — order-insensitive structural equality. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canon(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

function eq(a: unknown, b: unknown): boolean {
  return canon(a) === canon(b);
}

function nodeStatesFromGraph(graph: ExecutionGraph): Record<string, NodeState> {
  const out: Record<string, NodeState> = {};
  for (const n of graph.nodes) {
    out[n.nodeId] = n.state;
  }
  return out;
}

function sprintToNodeFields(t: SprintTask): Omit<GraphNode, "nodeId" | "state" | "attempt"> {
  return {
    taskType: t.taskType ?? "sprint-task",
    objective: t.objective,
    acceptanceCriteria: [...t.acceptanceCriteria],
    allowedPaths: [...t.scope.allowedPaths],
    forbiddenPaths: [...t.scope.forbiddenPaths],
    requiredCommands: t.gates.map((g) => ({
      executable: g.executable,
      args: [...g.args],
      ...(g.timeoutMs !== undefined ? { timeoutMs: g.timeoutMs } : {}),
    })),
    expectedArtifacts: [...(t.expectedArtifacts ?? [])],
    workerAdapter: t.worker,
    dependencies: [...t.dependencies],
    ...(t.persona ? { persona: t.persona } : {}),
  };
}

// ── Drift computation ───────────────────────────────────────────────────────

/**
 * Compare a compiled execution graph against a desired-state sprint document.
 * Returns a structured drift diff. PURE — never mutates.
 */
export function computeGraphDrift(graph: ExecutionGraph, sprintDoc: unknown): DriftDiff {
  if (!sprintDoc || typeof sprintDoc !== "object" || Array.isArray(sprintDoc)) {
    throw new Error("computeGraphDrift: sprintDoc must be an object");
  }
  const sprint = sprintDoc as SprintDoc;
  if (!Array.isArray(sprint.tasks)) {
    throw new Error("computeGraphDrift: sprintDoc.tasks must be an array");
  }

  const graphNodeIds = new Set(graph.nodes.map((n) => n.nodeId));
  const sprintTaskIds = new Set(sprint.tasks.map((t) => t.taskId));

  const graphById = new Map(graph.nodes.map((n) => [n.nodeId, n] as const));

  // Added: in sprint, not in graph
  const added = sprint.tasks
    .filter((t) => !graphNodeIds.has(t.taskId))
    .map((t) => t.taskId);

  // Removed: in graph, not in sprint
  const removed = graph.nodes
    .filter((n) => !sprintTaskIds.has(n.nodeId))
    .map((n) => n.nodeId);

  // Tasks changed: in both, field-level deltas
  const tasksChanged: Array<{ taskId: string; changes: TaskFieldChange[] }> = [];
  for (const t of sprint.tasks) {
    if (!graphNodeIds.has(t.taskId)) continue;
    const n = graphById.get(t.taskId)!;
    const desired = sprintToNodeFields(t);
    const changes: TaskFieldChange[] = [];

    const cmp = (field: string, a: unknown, b: unknown) => {
      if (!eq(a, b)) {
        changes.push({ field, sprint: canon(a), graph: canon(b) });
      }
    };

    cmp("objective", desired.objective, n.objective);
    cmp("acceptanceCriteria", desired.acceptanceCriteria, n.acceptanceCriteria);
    cmp("allowedPaths", desired.allowedPaths, n.allowedPaths);
    cmp("forbiddenPaths", desired.forbiddenPaths, n.forbiddenPaths);
    cmp("requiredCommands", desired.requiredCommands, n.requiredCommands);
    cmp("expectedArtifacts", desired.expectedArtifacts, n.expectedArtifacts);
    cmp("worker", t.worker, n.workerAdapter);
    cmp("persona", t.persona ?? null, n.persona ?? null);

    if (changes.length > 0) {
      tasksChanged.push({ taskId: t.taskId, changes });
    }
  }

  // Dependency edge deltas
  const dependenciesChanged: Array<{ taskId: string; added: string[]; removed: string[] }> = [];
  for (const t of sprint.tasks) {
    if (!graphNodeIds.has(t.taskId)) continue;
    const n = graphById.get(t.taskId)!;
    const sprintDeps = new Set<string>(t.dependencies);
    const graphDeps = new Set<string>(n.dependencies);

    const depAdded: string[] = [];
    const depRemoved: string[] = [];
    for (const d of sprintDeps) {
      if (!graphDeps.has(d)) depAdded.push(d);
    }
    for (const d of graphDeps) {
      if (!sprintDeps.has(d)) depRemoved.push(d);
    }

    if (depAdded.length > 0 || depRemoved.length > 0) {
      dependenciesChanged.push({
        taskId: t.taskId,
        added: depAdded,
        removed: depRemoved,
      });
    }
  }

  const nodeStates = nodeStatesFromGraph(graph);

  const hasDrift =
    added.length > 0 ||
    removed.length > 0 ||
    tasksChanged.length > 0 ||
    dependenciesChanged.length > 0;

  return {
    added,
    removed,
    tasksChanged,
    dependenciesChanged,
    nodeStates,
    hasDrift,
  };
}