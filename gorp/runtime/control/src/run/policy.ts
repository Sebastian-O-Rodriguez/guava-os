/**
 * Run eligibility policy (Sprint 2A).
 *
 * The single-node shape check that used to live in the STORAGE layer is gone:
 * multi-node graphs persist freely (the schema is the only storage gate).
 * Shape and eligibility rules live here, at run time, per chosen node:
 *
 *  - the caller must name the node explicitly — there is NO fallback to the
 *    first node; a missing or unknown nodeId fails closed;
 *  - graph integrity: node ids unique, every dependency references an
 *    existing node, no self-dependency;
 *  - the chosen node must be `pending` (one attempt, no retries);
 *  - every dependency of the chosen node must already be `promoted`
 *    (dependency ordering without a scheduler: the operator runs nodes in
 *    order; nothing here selects, queues, or parallelizes).
 *
 * Workers still cannot change topology: nodes/dependencies only change via
 * graph documents authored before approval, never at run time.
 */

import { GorpError } from "../errors/index.js";
import type { ExecutionGraph, GraphNode } from "../contracts/types.js";

/** Look up a node by explicit id. Fails closed on missing/unknown. */
export function selectNode(graph: ExecutionGraph, nodeId: string | undefined): GraphNode {
  if (!nodeId || nodeId.trim().length === 0) {
    throw new GorpError("INVALID_ARGUMENT", "nodeId is required (no fallback to the first node)", {});
  }
  const node = graph.nodes.find((n) => n.nodeId === nodeId);
  if (!node) {
    throw new GorpError("INVALID_ARGUMENT", "unknown nodeId", {
      nodeId,
      knownNodes: graph.nodes.map((n) => n.nodeId),
    });
  }
  return node;
}

/** Graph-integrity rules that any node run depends on. */
export function assertGraphIntegrity(graph: ExecutionGraph): void {
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    if (ids.has(n.nodeId)) {
      throw new GorpError("UNSUPPORTED_GRAPH_SHAPE", "duplicate nodeId in graph", { nodeId: n.nodeId });
    }
    ids.add(n.nodeId);
  }
  for (const n of graph.nodes) {
    for (const dep of n.dependencies) {
      if (dep === n.nodeId) {
        throw new GorpError("UNSUPPORTED_GRAPH_SHAPE", "node depends on itself", { nodeId: n.nodeId });
      }
      if (!ids.has(dep)) {
        throw new GorpError("UNSUPPORTED_GRAPH_SHAPE", "dependency references an unknown node", {
          nodeId: n.nodeId,
          dependency: dep,
        });
      }
    }
  }
}

/** The chosen node may run now: pending, with every dependency promoted. */
export function assertNodeRunnable(graph: ExecutionGraph, node: GraphNode): void {
  assertGraphIntegrity(graph);
  if (node.state !== "pending") {
    throw new GorpError("STATE_CONFLICT", "node is not pending (a run starts only from pending; another attempt requires the operator's review retry verdict)", {
      nodeId: node.nodeId,
      state: node.state,
    });
  }
  const unmet = node.dependencies.filter(
    (dep) => graph.nodes.find((n) => n.nodeId === dep)!.state !== "promoted",
  );
  if (unmet.length > 0) {
    throw new GorpError("STATE_CONFLICT", "node has unpromoted dependencies", {
      nodeId: node.nodeId,
      unmetDependencies: unmet,
    });
  }
}
