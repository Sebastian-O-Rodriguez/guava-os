/**
 * Worker adapter seam (Sprint 3B).
 *
 * The runtime never calls a concrete worker directly: it resolves the node's
 * `workerAdapter` name against this registry and invokes the adapter through
 * a contract-enforcing boundary. A new runtime plugs in here by
 * implementing WorkerAdapter and passing the same contract checks — no
 * runtime or scheduler change.
 *
 * Workers stay BLIND: an adapter receives only the sandbox handle and the
 * node's declarative spec. It gets no runtime config, no store, no state-home
 * path — it cannot transition graph state or touch runtime records even by
 * accident (and `worker` is not an authorized actor type regardless).
 *
 * Fail closed at the boundary:
 *  - unknown adapter name          -> NOT_IMPLEMENTED (before ANY mutation)
 *  - result violates the schema    -> WORKER_FAILED (contract violation)
 *  - result identity mismatch      -> WORKER_FAILED (contract violation)
 *    (graphId/nodeId/runId/workerAdapter must echo the invocation exactly)
 */

import { GorpError } from "../errors/index.js";
import { validateAgainst } from "../contracts/validator.js";
import type { GraphNode, WorkerResult } from "../contracts/types.js";
import type { Clock } from "../graph/graph.js";
import type { Sandbox } from "../sandbox/worktree.js";
import { FIXTURE_ADAPTER, runFixtureWorker } from "./fixture.js";
import { ompAdapter } from "./omp.js";

/** Everything a worker is allowed to know. Nothing else exists for it. */
export interface WorkerInvocation {
  readonly sandbox: Sandbox;
  readonly graphId: string;
  readonly runId: string;
  readonly node: GraphNode;
  readonly clock: Clock;
}

export interface WorkerAdapter {
  readonly name: string;
  /** Execute one node attempt inside the sandbox; resolve a contract-shaped
   *  result. ASYNC since Sprint 4A: real workers are external processes. */
  invoke(input: WorkerInvocation): Promise<WorkerResult>;
}

export const fixtureAdapter: WorkerAdapter = {
  name: FIXTURE_ADAPTER,
  invoke: async (input) => runFixtureWorker(input),
};
/** Static registry: fixture (deterministic) + omp (external process). */
const ADAPTERS: ReadonlyMap<string, WorkerAdapter> = new Map([
  [fixtureAdapter.name, fixtureAdapter],
  [ompAdapter.name, ompAdapter],
]);

export function implementedAdapters(): readonly string[] {
  return [...ADAPTERS.keys()];
}

/** Resolve by name. Fails closed BEFORE any mutation has happened. */
export function resolveWorkerAdapter(name: string): WorkerAdapter {
  const adapter = ADAPTERS.get(name);
  if (!adapter) {
    throw new GorpError("NOT_IMPLEMENTED", `worker adapter '${name}' is not implemented`, {
      workerAdapter: name,
      implemented: implementedAdapters(),
      mutation: false,
    });
  }
  return adapter;
}

function contractViolation(adapter: WorkerAdapter, violation: string, details: Record<string, unknown>): never {
  throw new GorpError("WORKER_FAILED", `worker adapter '${adapter.name}' violated the worker contract: ${violation}`, {
    workerAdapter: adapter.name,
    contractViolation: violation,
    ...details,
  });
}

/**
 * Invoke an adapter through the contract boundary. The result is never
 * trusted raw: it must validate against worker-result.schema.json and must
 * echo the invocation's identity exactly.
 */
export async function invokeAdapter(adapter: WorkerAdapter, input: WorkerInvocation): Promise<WorkerResult> {
  const result = await adapter.invoke(input);

  const check = validateAgainst("worker-result", result);
  if (!check.valid) {
    contractViolation(adapter, "result failed worker-result schema validation", { issues: check.issues });
  }
  if (result.graphId !== input.graphId || result.nodeId !== input.node.nodeId || result.runId !== input.runId) {
    contractViolation(adapter, "result identity does not echo the invocation", {
      expected: { graphId: input.graphId, nodeId: input.node.nodeId, runId: input.runId },
      got: { graphId: result.graphId, nodeId: result.nodeId, runId: result.runId },
    });
  }
  if (result.workerAdapter !== adapter.name) {
    contractViolation(adapter, "result claims a different workerAdapter", {
      expected: adapter.name,
      got: result.workerAdapter,
    });
  }
  // Sprint 5A: every NEW result must carry the worker's own account. (The
  // schema keeps `summary` optional so pre-5A persisted records stay valid;
  // the boundary is where the requirement lives.)
  if (typeof result.summary !== "string" || result.summary.trim().length === 0) {
    contractViolation(adapter, "result is missing the required non-empty summary", {});
  }
  return result;
}
