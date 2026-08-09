/**
 * Canonical source-neutral state model + transition table.
 *
 * Enforces which (from -> to) transitions are legal and which actor types may
 * perform them. Workers are NOT an actor type and can never transition state.
 * Arbitrary state assignment is impossible: every state change must be an
 * entry in these tables.
 *
 * Wave A exercises early transitions (through `running`) but the full Sprint 1
 * vocabulary is encoded now to avoid schema/table churn in Waves B and C.
 */

import type { ActorType, GraphState, NodeState } from "../contracts/types.js";

export interface TransitionRule<S extends string> {
  readonly from: S;
  readonly to: S;
  /** Actor types permitted to perform this transition. */
  readonly actors: readonly ActorType[];
}

/**
 * Graph-level transitions.
 * - Operator owns the approval boundary (draft -> approved) and cancellation.
 * - Orchestrator drives execution lifecycle (approved -> running -> terminal).
 * - System may record failure/blocked as a safety fallback.
 */
export const GRAPH_TRANSITIONS: readonly TransitionRule<GraphState>[] = [
  { from: "draft", to: "approved", actors: ["operator"] },
  { from: "draft", to: "cancelled", actors: ["operator"] },
  { from: "approved", to: "running", actors: ["orchestrator"] },
  { from: "approved", to: "cancelled", actors: ["operator"] },
  { from: "running", to: "blocked", actors: ["orchestrator", "system"] },
  { from: "running", to: "failed", actors: ["orchestrator", "system"] },
  { from: "running", to: "completed", actors: ["orchestrator"] },
  { from: "running", to: "cancelled", actors: ["operator"] },
  { from: "blocked", to: "running", actors: ["orchestrator"] },
  { from: "blocked", to: "cancelled", actors: ["operator"] },
  { from: "failed", to: "cancelled", actors: ["operator"] },
];

/**
 * Node-level transitions (full Sprint 1 vocabulary; used by Waves B/C).
 * Node topology/state is only ever changed by orchestrator/system/operator —
 * never by a worker.
 */
export const NODE_TRANSITIONS: readonly TransitionRule<NodeState>[] = [
  { from: "pending", to: "ready", actors: ["orchestrator", "system"] },
  { from: "pending", to: "cancelled", actors: ["operator"] },
  { from: "ready", to: "running", actors: ["orchestrator"] },
  { from: "ready", to: "cancelled", actors: ["operator"] },
  { from: "running", to: "blocked", actors: ["orchestrator", "system"] },
  { from: "running", to: "failed", actors: ["orchestrator", "system"] },
  { from: "running", to: "awaiting_review", actors: ["orchestrator", "system"] },
  { from: "blocked", to: "ready", actors: ["orchestrator"] },
  { from: "blocked", to: "cancelled", actors: ["operator"] },
  { from: "failed", to: "ready", actors: ["orchestrator"] },
  { from: "failed", to: "cancelled", actors: ["operator"] },
  { from: "awaiting_review", to: "approved", actors: ["operator"] },
  { from: "awaiting_review", to: "rejected", actors: ["operator"] },
  // Retry verdict (Sprint 5A): the operator sends the node back for a fresh
  // attempt. The run's records are retained; the node re-enters pending and
  // the next run gets a new runId. Operator-only — never automatic.
  { from: "awaiting_review", to: "pending", actors: ["operator"] },
  { from: "rejected", to: "ready", actors: ["orchestrator"] },
  { from: "rejected", to: "cancelled", actors: ["operator"] },
  { from: "approved", to: "promoted", actors: ["orchestrator"] },
];

export const GRAPH_STATES: readonly GraphState[] = [
  "draft", "approved", "running", "blocked", "failed", "completed", "cancelled",
];

export const NODE_STATES: readonly NodeState[] = [
  "pending", "ready", "running", "blocked", "failed",
  "awaiting_review", "approved", "rejected", "promoted", "cancelled",
];

/**
 * Node states from which no further work happens. A graph may only complete
 * when EVERY node is terminal (enforced in applyGraphTransition).
 */
export const TERMINAL_NODE_STATES: readonly NodeState[] = [
  "promoted", "rejected", "cancelled", "failed",
];

export function isTerminalNodeState(state: NodeState): boolean {
  return (TERMINAL_NODE_STATES as readonly string[]).includes(state);
}

export const ACTOR_TYPES: readonly ActorType[] = ["operator", "orchestrator", "system"];

/** Anything not in ACTOR_TYPES (notably 'worker') is an unauthorized actor. */
export function isAuthorizedActor(actor: string): actor is ActorType {
  return (ACTOR_TYPES as readonly string[]).includes(actor);
}

export interface TransitionCheck {
  readonly allowed: boolean;
  /** 'no_such_transition' if from->to is not in the table; 'actor_not_permitted' if it is but the actor may not. */
  readonly reason: "ok" | "no_such_transition" | "actor_not_permitted";
}

function check<S extends string>(
  table: readonly TransitionRule<S>[],
  from: S,
  to: S,
  actor: ActorType,
): TransitionCheck {
  const rule = table.find((r) => r.from === from && r.to === to);
  if (!rule) return { allowed: false, reason: "no_such_transition" };
  if (!rule.actors.includes(actor)) return { allowed: false, reason: "actor_not_permitted" };
  return { allowed: true, reason: "ok" };
}

export function checkGraphTransition(from: GraphState, to: GraphState, actor: ActorType): TransitionCheck {
  return check(GRAPH_TRANSITIONS, from, to, actor);
}

export function checkNodeTransition(from: NodeState, to: NodeState, actor: NodeStateActor): TransitionCheck {
  return check(NODE_TRANSITIONS, from, to, actor);
}

type NodeStateActor = ActorType;
