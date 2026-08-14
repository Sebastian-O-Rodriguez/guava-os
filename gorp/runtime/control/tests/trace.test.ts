import { describe, it, expect } from "vitest";
import { buildTrace, type TraceEvent } from "../src/inspect/inspect.js";
import type { RunRecord, TransitionRecord, WorkerResult } from "../src/contracts/types.js";

const AT = "2026-07-15T10:00:00.000Z";

/** Transition factory — minimal fields. */
function tr(
  partial: Partial<TransitionRecord> & {
    readonly entityType: "graph" | "node";
    readonly entityId: string;
    readonly fromState: string;
    readonly toState: string;
    readonly reasonCode: string;
  },
): TransitionRecord {
  return {
    transitionId: `tx-${partial.reasonCode}-${partial.entityType}`,
    actorType: "orchestrator",
    actorId: "orch",
    reasonText: `${partial.fromState} → ${partial.toState}`,
    timestamp: AT,
    ...partial,
  };
}

/** RunRecord factory — minimal construction. */
function rr(partial: Partial<RunRecord> & {
  readonly runId: string;
  readonly graphId: string;
  readonly nodeId: string;
  readonly finalStatus: RunRecord["finalStatus"];
}): RunRecord {
  return {
    schemaVersion: 1,
    projectId: "p1",
    governanceVersion: "1.0.0",
    baseCommit: "abc123",
    workerAdapter: "fixture",
    startedAt: AT,
    ...partial,
  } as unknown as RunRecord; // cast: partial may omit required fields for test brevity
}

/** WorkerResult factory. */
function wr(outcome: "succeeded" | "failed" = "succeeded"): WorkerResult {
  return {
    schemaVersion: 1,
    graphId: "g1",
    nodeId: "n1",
    runId: "run-1",
    workerAdapter: "fixture",
    outcome,
    startedAt: AT,
    endedAt: AT,
  };
}

// ── Successful run transitions (full loop) ──────────────────────────────
const FULL_TRANSITIONS: TransitionRecord[] = [
  tr({ entityType: "graph", entityId: "g1", fromState: "draft", toState: "approved", reasonCode: "OPERATOR_APPROVAL", actorType: "operator", actorId: "op" }),
  tr({ entityType: "graph", entityId: "g1", fromState: "approved", toState: "running", reasonCode: "RUN_START" }),
  tr({ entityType: "node", entityId: "n1", fromState: "pending", toState: "ready", reasonCode: "NODE_ELIGIBLE" }),
  tr({ entityType: "node", entityId: "n1", fromState: "ready", toState: "running", reasonCode: "WORKER_START" }),
  tr({ entityType: "node", entityId: "n1", fromState: "running", toState: "awaiting_review", reasonCode: "GATE_PASSED" }),
  tr({ entityType: "node", entityId: "n1", fromState: "awaiting_review", toState: "approved", reasonCode: "REVIEW_APPROVED", actorType: "operator", actorId: "reviewer" }),
  tr({ entityType: "node", entityId: "n1", fromState: "approved", toState: "promoted", reasonCode: "PROMOTED" }),
];

const FULL_DECISIONS = [
  { decision: "start-run", reasonCode: "NODE_ELIGIBLE", reasonText: "node n1 selected", at: AT },
  { decision: "create-sandbox", reasonCode: "SANDBOX_ISOLATION", reasonText: "worktree gorpx at base abc123", at: AT },
  { decision: "persist-worker-result", reasonCode: "WORKER_SUCCEEDED", reasonText: "outcome succeeded", at: AT },
  { decision: "persist-gate-record", reasonCode: "SCOPE_GATE", reasonText: "validation passed", at: AT },
  { decision: "await-review", reasonCode: "GATE_PASSED", reasonText: "sandbox kept for review", at: AT },
] as const;

// ── Tests ───────────────────────────────────────────────────────────────

describe("buildTrace (GOS-54 deterministic trace)", () => {
  it("empty inputs produce empty trace", () => {
    const trace = buildTrace({ nodeId: "n1", transitions: [], runRecord: null, workerResult: null });
    expect(trace).toEqual([]);
  });

  it("steps are sequential (0, 1, 2, …)", () => {
    const trace = buildTrace({
      nodeId: "n1",
      transitions: FULL_TRANSITIONS,
      runRecord: rr({
        runId: "run-1", graphId: "g1", nodeId: "n1", finalStatus: "succeeded",
        controlDecisions: [...FULL_DECISIONS],
      }),
      workerResult: wr("succeeded"),
    });
    expect(trace.length).toBeGreaterThan(0);
    trace.forEach((e, i) => expect(e.step).toBe(i));
  });

  it("events are ordered deterministically (phase-rank tie-break when timestamps equal)", () => {
    const trace = buildTrace({
      nodeId: "n1",
      transitions: FULL_TRANSITIONS,
      runRecord: rr({
        runId: "run-1", graphId: "g1", nodeId: "n1", finalStatus: "succeeded",
        controlDecisions: [...FULL_DECISIONS],
      }),
      workerResult: wr("succeeded"),
    });

    const eventNames = trace.map((e) => e.event);

    // Relative milestone order (weak: just assert each is present and in correct order)
    const idx = (name: string) => eventNames.indexOf(name);

    expect(idx("graph-approved")).toBeLessThan(idx("run-started"));
    expect(idx("run-started")).toBeLessThan(idx("node-ready"));
    expect(idx("node-ready")).toBeLessThan(idx("worker-dispatched"));
    expect(idx("worker-dispatched")).toBeLessThan(idx("start-run"));
    expect(idx("start-run")).toBeLessThan(idx("create-sandbox"));
    expect(idx("worker-invoked")).toBeLessThan(idx("worker-returned"));
    expect(idx("worker-returned")).toBeLessThan(idx("persist-worker-result"));
    expect(idx("persist-worker-result")).toBeLessThan(idx("persist-gate-record"));
    expect(idx("persist-gate-record")).toBeLessThan(idx("gate-passed"));
    expect(idx("gate-passed")).toBeLessThan(idx("await-review"));
    expect(idx("await-review")).toBeLessThan(idx("review-approved"));
    expect(idx("review-approved")).toBeLessThan(idx("promoted"));

    // All `at` values match the fixed clock
    trace.forEach((e) => expect(e.at).toBe(AT));

    // Details present on transitions
    const gApproved = trace.find((e) => e.event === "graph-approved");
    expect(gApproved!.details).toEqual({
      from: "draft", to: "approved", actor: "op", reason: "draft → approved",
    });

    // Decision details present
    const createSb = trace.find((e) => e.event === "create-sandbox");
    expect(createSb!.details).toEqual({
      reasonCode: "SANDBOX_ISOLATION",
      reasonText: "worktree gorpx at base abc123",
    });
  });

  it("usage absent — no usage event", () => {
    const trace = buildTrace({
      nodeId: "n1",
      transitions: [],
      runRecord: rr({ runId: "run-1", graphId: "g1", nodeId: "n1", finalStatus: "succeeded" }),
      workerResult: null,
    });
    expect(trace.map((e) => e.event)).not.toContain("usage");
  });

  it("usage present — usage event with details", () => {
    const usageObj = { tokensIn: 5000, tokensOut: 2000, tokensTotal: 7000, costUsd: 0.05, durationMs: 15000 };
    const runRecord = rr({
      runId: "run-1", graphId: "g1", nodeId: "n1", finalStatus: "succeeded",
      endedAt: "2026-07-15T10:01:00.000Z",
    });
    // Inject usage via cast (Task B's surface)
    (runRecord as Record<string, unknown>)["usage"] = usageObj;

    const trace = buildTrace({
      nodeId: "n1",
      transitions: [],
      runRecord,
      workerResult: null,
    });
    const usageEvent = trace.find((e) => e.event === "usage");
    expect(usageEvent).toBeTruthy();
    expect(usageEvent!.details).toEqual(usageObj);
    expect(usageEvent!.at).toBe("2026-07-15T10:01:00.000Z");
  });

  it("profile present — worker-profile event", () => {
    const profile = { persona: "builder", model: "deepseek-v4", promptHash: "5ec…c4a" };
    const runRecord = rr({
      runId: "run-1", graphId: "g1", nodeId: "n1", finalStatus: "succeeded",
      profile,
    });
    const trace = buildTrace({
      nodeId: "n1",
      transitions: [],
      runRecord,
      workerResult: null,
    });
    const profileEvent = trace.find((e) => e.event === "worker-profile");
    expect(profileEvent).toBeTruthy();
    expect(profileEvent!.details).toEqual({ persona: "builder", model: "deepseek-v4", promptHash: "5ec…c4a" });
  });

  it("profile absent — no worker-profile event", () => {
    const trace = buildTrace({
      nodeId: "n1",
      transitions: [],
      runRecord: rr({ runId: "run-1", graphId: "g1", nodeId: "n1", finalStatus: "succeeded" }),
      workerResult: null,
    });
    expect(trace.map((e) => e.event)).not.toContain("worker-profile");
  });

  it("failed run trace ends with node-failed, no review/promote events", () => {
    const failedTransitions: TransitionRecord[] = [
      tr({ entityType: "graph", entityId: "g1", fromState: "draft", toState: "approved", reasonCode: "OPERATOR_APPROVAL" }),
      tr({ entityType: "graph", entityId: "g1", fromState: "approved", toState: "running", reasonCode: "RUN_START" }),
      tr({ entityType: "node", entityId: "n1", fromState: "pending", toState: "ready", reasonCode: "NODE_ELIGIBLE" }),
      tr({ entityType: "node", entityId: "n1", fromState: "ready", toState: "running", reasonCode: "WORKER_START" }),
      tr({ entityType: "node", entityId: "n1", fromState: "running", toState: "failed", reasonCode: "GATE_FAILED" }),
      tr({ entityType: "graph", entityId: "g1", fromState: "running", toState: "failed", reasonCode: "GATE_FAILED" }),
    ];
    const failedDecisions = [
      { decision: "start-run", reasonCode: "NODE_ELIGIBLE", at: AT },
      { decision: "create-sandbox", reasonCode: "SANDBOX_ISOLATION", at: AT },
      { decision: "persist-worker-result", reasonCode: "WORKER_SUCCEEDED", at: AT },
      { decision: "persist-gate-record", reasonCode: "SCOPE_GATE", reasonText: "validation failed", at: AT },
      { decision: "fail-run", reasonCode: "GATE_FAILED", at: AT },
      { decision: "destroy-sandbox", reasonCode: "FAIL_CLOSED", at: AT },
    ] as const;

    const trace = buildTrace({
      nodeId: "n1",
      transitions: failedTransitions,
      runRecord: rr({
        runId: "run-1", graphId: "g1", nodeId: "n1", finalStatus: "failed",
        controlDecisions: [...failedDecisions],
      }),
      workerResult: wr("succeeded"),
    });

    const eventNames = trace.map((e) => e.event);
    expect(eventNames).toContain("node-failed");
    expect(eventNames).toContain("graph-failed");
    expect(eventNames).toContain("fail-run");
    expect(eventNames).toContain("destroy-sandbox");
    expect(eventNames).not.toContain("review-approved");
    expect(eventNames).not.toContain("promoted");

    // gate-failed path: persist-gate-record before fail-run
    const idx = (name: string) => eventNames.indexOf(name);
    expect(idx("persist-gate-record")).toBeGreaterThan(-1);
    expect(idx("fail-run")).toBeGreaterThan(idx("persist-gate-record"));
    expect(idx("node-failed")).toBeGreaterThan(idx("fail-run"));
    expect(idx("graph-failed")).toBeGreaterThan(idx("node-failed"));
    expect(idx("destroy-sandbox")).toBeGreaterThan(idx("graph-failed"));
  });

  it("multi-node graph filters node transitions to target nodeId", () => {
    const mixedTransitions: TransitionRecord[] = [
      tr({ entityType: "graph", entityId: "g1", fromState: "draft", toState: "approved", reasonCode: "OPERATOR_APPROVAL" }),
      tr({ entityType: "node", entityId: "n1", fromState: "pending", toState: "ready", reasonCode: "NODE_ELIGIBLE" }),
      tr({ entityType: "node", entityId: "n2", fromState: "pending", toState: "ready", reasonCode: "NODE_ELIGIBLE" }),
      tr({ entityType: "node", entityId: "n1", fromState: "ready", toState: "running", reasonCode: "WORKER_START" }),
      tr({ entityType: "node", entityId: "n2", fromState: "ready", toState: "running", reasonCode: "WORKER_START" }),
    ];

    const trace = buildTrace({ nodeId: "n1", transitions: mixedTransitions, runRecord: null, workerResult: null });

    const eventNames = trace.map((e) => e.event);
    expect(eventNames).toContain("node-ready"); // should be present exactly once
    expect(eventNames.filter((e) => e === "node-ready")).toHaveLength(1);
    expect(eventNames.filter((e) => e === "worker-dispatched")).toHaveLength(1);
    // graph transitions included for all
    expect(eventNames).toContain("graph-approved");
  });

  it("worker missing means no worker-invoked/returned events", () => {
    const trace = buildTrace({
      nodeId: "n1",
      transitions: [],
      runRecord: rr({ runId: "run-1", graphId: "g1", nodeId: "n1", finalStatus: "failed" }),
      workerResult: null,
    });
    expect(trace).toEqual([]);
  });

  it("worker without startedAt/endedAt (fails before invocation) has no milestone", () => {
    const w: WorkerResult = {
      schemaVersion: 1, graphId: "g1", nodeId: "n1", runId: "run-1",
      workerAdapter: "fixture", outcome: "failed",
      startedAt: "", endedAt: "", // falsy strings
    };
    const trace = buildTrace({ nodeId: "n1", transitions: [], runRecord: null, workerResult: w });
    expect(trace.map((e) => e.event)).not.toContain("worker-invoked");
    expect(trace.map((e) => e.event)).not.toContain("worker-returned");
  });
});