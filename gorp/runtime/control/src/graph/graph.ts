/**
 * Graph domain operations: build a draft graph, and apply a legal state
 * transition producing a new graph value plus an appended transition record.
 *
 * Pure functions — no I/O. A clock is injected so tests are deterministic.
 */

import { GorpError } from "../errors/index.js";
import type {
  ActorType,
  ExecutionGraph,
  GraphNode,
  GraphState,
  ProjectIdentity,
  Provenance,
  TransitionRecord,
} from "../contracts/types.js";
import {
  TERMINAL_NODE_STATES,
  checkGraphTransition,
  checkNodeTransition,
  isAuthorizedActor,
  isTerminalNodeState,
} from "../state/transitions.js";
import type { NodeState } from "../contracts/types.js";

export interface Clock {
  now(): string; // ISO-8601
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

export interface CreateGraphInput {
  readonly graphId: string;
  readonly project: ProjectIdentity;
  readonly baseCommit: string;
  readonly nodes: readonly GraphNode[];
  readonly createdBy: string;
  readonly createdByType: ActorType;
  readonly source?: string;
}

/** Build a new DRAFT, UNAPPROVED graph. Does not validate the single-node rule (that is a store/runtime concern). */
export function buildDraftGraph(input: CreateGraphInput, clock: Clock = systemClock): ExecutionGraph {
  const provenance: Provenance = {
    createdBy: input.createdBy,
    createdByType: input.createdByType,
    createdAt: clock.now(),
    ...(input.source !== undefined ? { source: input.source } : {}),
  };
  return {
    schemaVersion: 1,
    graphId: input.graphId,
    project: input.project,
    baseCommit: input.baseCommit,
    approvalStatus: "unapproved",
    provenance,
    status: "draft",
    nodes: input.nodes,
    transitions: [],
  };
}

let transitionCounter = 0;

/** Deterministic-friendly transition id: <entity>-<from>-<to>-<seq>. */
function nextTransitionId(entityType: string, from: string, to: string): string {
  transitionCounter += 1;
  return `${entityType}-${from}-${to}-${String(transitionCounter).padStart(4, "0")}`;
}

export interface GraphTransitionInput {
  readonly to: GraphState;
  readonly actorType: string; // untrusted; validated here
  readonly actorId: string;
  readonly reasonCode: string;
  readonly reasonText: string;
}

/**
 * Apply a graph-level transition. Returns a NEW graph value; never mutates the
 * input. Throws structured errors on any illegal transition or unauthorized
 * actor — with no side effects (the caller therefore cannot persist a bad state).
 */
export function applyGraphTransition(
  graph: ExecutionGraph,
  input: GraphTransitionInput,
  clock: Clock = systemClock,
): ExecutionGraph {
  if (!input.reasonCode || !/^[A-Z][A-Z0-9_]*$/.test(input.reasonCode)) {
    throw new GorpError("INVALID_ARGUMENT", "reasonCode must be an UPPER_SNAKE code", {
      reasonCode: input.reasonCode,
    });
  }
  if (!input.reasonText || input.reasonText.trim().length === 0) {
    throw new GorpError("INVALID_ARGUMENT", "reasonText is required", {});
  }
  if (!isAuthorizedActor(input.actorType)) {
    // Notably rejects 'worker'.
    throw new GorpError("ILLEGAL_STATE_TRANSITION", "actor is not authorized to transition state", {
      actorType: input.actorType,
      authorized: ["operator", "orchestrator", "system"],
    });
  }
  const actor: ActorType = input.actorType;
  const from = graph.status;
  const to = input.to;

  const result = checkGraphTransition(from, to, actor);
  if (!result.allowed) {
    throw new GorpError("ILLEGAL_STATE_TRANSITION", `illegal graph transition ${from} -> ${to}`, {
      from,
      to,
      actorType: actor,
      reason: result.reason,
    });
  }

  // Completion invariant: a graph may only complete when EVERY node is
  // terminal (promoted/rejected/cancelled/failed). Fail closed, no mutation.
  if (to === "completed") {
    const nonTerminal = graph.nodes
      .filter((n) => !isTerminalNodeState(n.state))
      .map((n) => ({ nodeId: n.nodeId, state: n.state }));
    if (nonTerminal.length > 0) {
      throw new GorpError("ILLEGAL_STATE_TRANSITION", "graph cannot complete: nodes are not terminal", {
        from,
        to,
        actorType: actor,
        reason: "nodes_not_terminal",
        nonTerminalNodes: nonTerminal,
        terminalStates: TERMINAL_NODE_STATES,
      });
    }
  }

  const record: TransitionRecord = {
    transitionId: nextTransitionId("graph", from, to),
    entityType: "graph",
    entityId: graph.graphId,
    fromState: from,
    toState: to,
    actorType: actor,
    actorId: input.actorId,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    timestamp: clock.now(),
  };

  const approvalStatus = to === "approved" ? "approved" : graph.approvalStatus;

  return {
    ...graph,
    status: to,
    approvalStatus,
    transitions: [...graph.transitions, record], // append-only
  };
}

export interface NodeTransitionInput {
  readonly nodeId: string;
  readonly to: NodeState;
  readonly actorType: string; // untrusted; validated here
  readonly actorId: string;
  readonly reasonCode: string;
  readonly reasonText: string;
}

/**
 * Apply a node-level transition. Same guarantees as applyGraphTransition:
 * returns a NEW graph value, throws structured errors with no side effects on
 * any illegal transition or unauthorized actor (workers are always rejected).
 * Entering `running` increments the node's attempt counter.
 */
export function applyNodeTransition(
  graph: ExecutionGraph,
  input: NodeTransitionInput,
  clock: Clock = systemClock,
): ExecutionGraph {
  if (!input.reasonCode || !/^[A-Z][A-Z0-9_]*$/.test(input.reasonCode)) {
    throw new GorpError("INVALID_ARGUMENT", "reasonCode must be an UPPER_SNAKE code", {
      reasonCode: input.reasonCode,
    });
  }
  if (!input.reasonText || input.reasonText.trim().length === 0) {
    throw new GorpError("INVALID_ARGUMENT", "reasonText is required", {});
  }
  if (!isAuthorizedActor(input.actorType)) {
    // Notably rejects 'worker'.
    throw new GorpError("ILLEGAL_STATE_TRANSITION", "actor is not authorized to transition state", {
      actorType: input.actorType,
      authorized: ["operator", "orchestrator", "system"],
    });
  }
  const actor: ActorType = input.actorType;
  const node = graph.nodes.find((n) => n.nodeId === input.nodeId);
  if (!node) {
    throw new GorpError("INVALID_ARGUMENT", "unknown nodeId", { nodeId: input.nodeId });
  }
  const from = node.state;
  const to = input.to;

  const result = checkNodeTransition(from, to, actor);
  if (!result.allowed) {
    throw new GorpError("ILLEGAL_STATE_TRANSITION", `illegal node transition ${from} -> ${to}`, {
      nodeId: node.nodeId,
      from,
      to,
      actorType: actor,
      reason: result.reason,
    });
  }

  const record: TransitionRecord = {
    transitionId: nextTransitionId("node", from, to),
    entityType: "node",
    entityId: node.nodeId,
    fromState: from,
    toState: to,
    actorType: actor,
    actorId: input.actorId,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    timestamp: clock.now(),
  };

  const nextNode: GraphNode = {
    ...node,
    state: to,
    attempt: to === "running" ? node.attempt + 1 : node.attempt,
  };

  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.nodeId === node.nodeId ? nextNode : n)),
    transitions: [...graph.transitions, record], // append-only
  };
}
