/**
 * Planner (final sprint): approved sprint document -> deterministic draft
 * execution graph. PLANNER ONLY — it executes nothing, approves nothing:
 * the produced graph is `draft`/`unapproved` and still needs the explicit
 * operator approval transition before any node can run.
 *
 * Deterministic: the same sprint document + base commit + clock produce a
 * byte-identical graph (stable ordering, no wall-clock, no randomness).
 *
 * Fail closed — a bad sprint is REJECTED, never repaired:
 *  - schema violations (sprint.schema.json);
 *  - duplicate task ids; unknown or self dependencies; DEPENDENCY CYCLES
 *    (the runtime's per-node policy would only discover a cycle as a wedge —
 *    the graph compiler refuses it up front);
 *  - review 'fixture-auto' on any non-fixture worker (no autonomy: only the
 *    deterministic fixture worker may be machine-approved);
 *  - worker names not registered in the runtime adapter registry;
 *  - capability lies are schema-rejected: maxAttempts must be 1 (no retries
 *    exist), escalation must be 'operator' (no other path exists).
 *
 * Mapping (task -> node): taskId->nodeId, objective/acceptanceCriteria as-is,
 * scope.allowedPaths/forbiddenPaths, gates->requiredCommands,
 * worker->workerAdapter, dependencies as-is, state 'pending', attempt 0.
 * review/maxAttempts/escalation are VALIDATED but not persisted in the graph:
 * the runtime enforces them structurally (review policy stops non-fixture
 * output; one run per node; operator-only recovery) rather than per-node
 * flags it would not read.
 */

import { GorpError } from "../errors/index.js";
import { validateAgainst } from "../contracts/validator.js";
import type { ExecutionGraph, GraphNode, RequiredCommand } from "../contracts/types.js";
import { buildDraftGraph, systemClock, type Clock } from "../graph/graph.js";
import { implementedAdapters } from "../worker/adapter.js";

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
}

interface Sprint {
  readonly sprintId: string;
  /** Project identity only — the repository path lives in the project registry. */
  readonly project: { readonly projectId: string };
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly tasks: readonly SprintTask[];
}

function reject(reason: string, details: Record<string, unknown> = {}): never {
  throw new GorpError("INVALID_ARGUMENT", `graph compiler rejected the sprint: ${reason}`, {
    compilerRejection: reason,
    ...details,
  });
}

/** Kahn's algorithm; rejects on any cycle, reporting the nodes stuck in it. */
function assertAcyclic(tasks: readonly SprintTask[]): void {
  const indegree = new Map<string, number>(tasks.map((t) => [t.taskId, 0]));
  for (const t of tasks) for (const _dep of t.dependencies) indegree.set(t.taskId, (indegree.get(t.taskId) ?? 0) + 1);
  const queue = tasks.filter((t) => (indegree.get(t.taskId) ?? 0) === 0).map((t) => t.taskId);
  let visited = 0;
  const dependents = new Map<string, string[]>();
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      const list = dependents.get(dep) ?? [];
      list.push(t.taskId);
      dependents.set(dep, list);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited++;
    for (const dependent of dependents.get(id) ?? []) {
      const d = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, d);
      if (d === 0) queue.push(dependent);
    }
  }
  if (visited !== tasks.length) {
    const stuck = [...indegree.entries()].filter(([, d]) => d > 0).map(([id]) => id);
    reject("dependency cycle detected", { cyclicTasks: stuck });
  }
}

export interface PlanOptions {
  /** Base commit recorded as graph provenance (typically the repo HEAD). */
  readonly baseCommit: string;
  readonly clock?: Clock;
}

/** Validate an approved execution request and deterministically compile it to a DRAFT graph. */
export function compileGraph(sprintDoc: unknown, opts: PlanOptions): ExecutionGraph {
  const check = validateAgainst("sprint", sprintDoc);
  if (!check.valid) {
    reject("sprint document failed schema validation", { issues: check.issues });
  }
  const sprint = sprintDoc as Sprint;

  // semantic validation, fail closed
  const ids = new Set<string>();
  for (const t of sprint.tasks) {
    if (ids.has(t.taskId)) reject("duplicate taskId", { taskId: t.taskId });
    ids.add(t.taskId);
  }
  for (const t of sprint.tasks) {
    for (const dep of t.dependencies) {
      if (dep === t.taskId) reject("task depends on itself", { taskId: t.taskId });
      if (!ids.has(dep)) reject("dependency references an unknown task", { taskId: t.taskId, dependency: dep });
    }
    if (!implementedAdapters().includes(t.worker)) {
      reject("worker names an unregistered adapter", { taskId: t.taskId, worker: t.worker, implemented: implementedAdapters() });
    }
    if (t.review === "fixture-auto" && t.worker !== "fixture") {
      reject("review 'fixture-auto' is only legal for the deterministic fixture worker", {
        taskId: t.taskId,
        worker: t.worker,
      });
    }
  }
  assertAcyclic(sprint.tasks);

  // deterministic mapping (document order preserved — it is the scheduler's tie-break)
  const nodes: GraphNode[] = sprint.tasks.map((t) => ({
    nodeId: t.taskId,
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
    state: "pending",
    attempt: 0,
  }));

  return buildDraftGraph(
    {
      graphId: sprint.sprintId,
      project: sprint.project,
      baseCommit: opts.baseCommit,
      nodes,
      createdBy: sprint.approvedBy,
      createdByType: "operator",
      source: `graph-compiler: sprint ${sprint.sprintId} approved ${sprint.approvedAt}`,
    },
    opts.clock ?? systemClock,
  );
}
