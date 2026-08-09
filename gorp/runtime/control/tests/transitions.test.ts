import { describe, it, expect } from "vitest";
import {
  checkGraphTransition,
  checkNodeTransition,
  isAuthorizedActor,
  GRAPH_STATES,
  NODE_STATES,
  ACTOR_TYPES,
} from "../src/state/transitions.js";
import { buildDraftGraph, applyGraphTransition, type Clock } from "../src/graph/graph.js";
import { isGorpError } from "../src/errors/index.js";
import type { GraphNode } from "../src/contracts/types.js";

const fixedClock: Clock = { now: () => "2026-07-14T12:00:00.000Z" };

function node(): GraphNode {
  return {
    nodeId: "node-1",
    taskType: "fixture-mutation",
    objective: "o",
    acceptanceCriteria: ["a"],
    allowedPaths: [".gorp/fixtures/slice/**"],
    forbiddenPaths: [],
    requiredCommands: [],
    expectedArtifacts: [],
    workerAdapter: "fixture",
    dependencies: [],
    state: "pending",
    attempt: 0,
  };
}

function draft() {
  return buildDraftGraph(
    {
      graphId: "g1",
      project: { projectId: "p1" },
      baseCommit: "0123456",
      nodes: [node()],
      createdBy: "op",
      createdByType: "operator",
    },
    fixedClock,
  );
}

describe("state vocabulary", () => {
  it("encodes the full Sprint 1 graph + node states", () => {
    expect(GRAPH_STATES).toEqual([
      "draft", "approved", "running", "blocked", "failed", "completed", "cancelled",
    ]);
    expect(NODE_STATES).toEqual([
      "pending", "ready", "running", "blocked", "failed",
      "awaiting_review", "approved", "rejected", "promoted", "cancelled",
    ]);
  });
  it("workers are not an authorized actor", () => {
    expect(isAuthorizedActor("worker")).toBe(false);
    expect(ACTOR_TYPES.includes("operator")).toBe(true);
    for (const a of ACTOR_TYPES) expect(isAuthorizedActor(a)).toBe(true);
  });
});

describe("transition table checks", () => {
  it("draft -> approved allowed only for operator", () => {
    expect(checkGraphTransition("draft", "approved", "operator").allowed).toBe(true);
    expect(checkGraphTransition("draft", "approved", "orchestrator").reason).toBe("actor_not_permitted");
  });
  it("draft -> running is not a legal transition", () => {
    expect(checkGraphTransition("draft", "running", "operator").reason).toBe("no_such_transition");
    expect(checkGraphTransition("draft", "running", "orchestrator").reason).toBe("no_such_transition");
  });
  it("approved -> running allowed only for orchestrator", () => {
    expect(checkGraphTransition("approved", "running", "orchestrator").allowed).toBe(true);
    expect(checkGraphTransition("approved", "running", "operator").reason).toBe("actor_not_permitted");
  });
  it("node awaiting_review -> approved is operator-only", () => {
    expect(checkNodeTransition("awaiting_review", "approved", "operator").allowed).toBe(true);
    expect(checkNodeTransition("awaiting_review", "approved", "orchestrator").reason).toBe("actor_not_permitted");
  });
});

describe("applyGraphTransition enforcement (no mutation on failure)", () => {
  it("draft -> approved succeeds for operator and sets approvalStatus", () => {
    const g = draft();
    const next = applyGraphTransition(
      g,
      { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OPERATOR_APPROVAL", reasonText: "ok" } as never,
      fixedClock,
    );
    expect(next.status).toBe("approved");
    expect(next.approvalStatus).toBe("approved");
    expect(next.transitions).toHaveLength(1);
    expect(next.transitions[0]!.fromState).toBe("draft");
    expect(next.transitions[0]!.toState).toBe("approved");
    expect(next.transitions[0]!.actorType).toBe("operator");
    // input graph is unchanged (immutability / append-only)
    expect(g.status).toBe("draft");
    expect(g.transitions).toHaveLength(0);
  });

  it("draft -> running fails without mutating", () => {
    const g = draft();
    try {
      applyGraphTransition(
        g,
        { to: "running", actorType: "orchestrator", actorId: "orch", reasonCode: "X", reasonText: "y" } as never,
        fixedClock,
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect(isGorpError(e) && e.code).toBe("ILLEGAL_STATE_TRANSITION");
    }
    expect(g.status).toBe("draft");
  });

  it("worker actor is rejected as unauthorized", () => {
    const approved = applyGraphTransition(
      draft(),
      { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OK", reasonText: "ok" } as never,
      fixedClock,
    );
    try {
      applyGraphTransition(
        approved,
        { to: "running", actorType: "worker", actorId: "w", reasonCode: "OK", reasonText: "y" } as never,
        fixedClock,
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect(isGorpError(e) && e.code).toBe("ILLEGAL_STATE_TRANSITION");
      if (isGorpError(e)) expect(e.details["actorType"]).toBe("worker");
    }
  });

  it("approved -> running succeeds only for orchestrator", () => {
    const approved = applyGraphTransition(
      draft(),
      { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OK", reasonText: "ok" } as never,
      fixedClock,
    );
    const running = applyGraphTransition(
      approved,
      { to: "running", actorType: "orchestrator", actorId: "orch", reasonCode: "START", reasonText: "begin" } as never,
      fixedClock,
    );
    expect(running.status).toBe("running");
    expect(running.transitions).toHaveLength(2); // append-only history preserved
  });

  it("rejects malformed reason code", () => {
    try {
      applyGraphTransition(
        draft(),
        { to: "approved", actorType: "operator", actorId: "op", reasonCode: "bad code", reasonText: "x" } as never,
        fixedClock,
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect(isGorpError(e) && e.code).toBe("INVALID_ARGUMENT");
    }
  });
});
