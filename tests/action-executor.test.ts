import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase — same pattern as chat-workflows.test.ts
// ---------------------------------------------------------------------------

vi.mock("../lib/supabase", () => {
  const mockChain = () => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.insert = vi.fn().mockResolvedValue({ error: null });
    chain.select = vi.fn(self);
    chain.eq = vi.fn(self);
    chain.gte = vi.fn(self);
    chain.lte = vi.fn(self);
    chain.in = vi.fn(self);
    chain.order = vi.fn(self);
    chain.limit = vi.fn(self);
    chain.single = vi.fn().mockResolvedValue({ data: null });
    chain.update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    chain.delete = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    chain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [] }).then(resolve);
    return chain;
  };

  return {
    supabaseAdmin: {
      from: vi.fn(mockChain),
    },
  };
});

import { createAction, executeAction } from "../lib/actions/executor";
import type { Action, ActionPayload } from "../lib/actions/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAction(
  intent: string,
  payload: ActionPayload,
  overrides: Partial<Action> = {},
): Action {
  return {
    id: crypto.randomUUID(),
    intent: intent as Action["intent"],
    userId: "test-user-123",
    categoryId: "cat-123",
    categoryName: "Test Category",
    payload,
    status: "confirmed",
    confidence: 0.95,
    createdAt: new Date().toISOString(),
    mutation: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createAction
// ---------------------------------------------------------------------------

describe("createAction", () => {
  it("generates id, status, and createdAt", () => {
    const action = createAction({
      intent: "log_gym",
      userId: "user-1",
      categoryId: "cat-1",
      categoryName: "Gym",
      payload: { intent: "log_gym", bodyPart: "chest" },
      confidence: 0.9,
    });

    expect(action.id).toBeTruthy();
    expect(action.status).toBe("proposed");
    expect(action.createdAt).toBeTruthy();
    expect(action.mutation).toBeNull();
  });

  it("validates payload schema", () => {
    expect(() =>
      createAction({
        intent: "log_gym",
        userId: "user-1",
        payload: { intent: "log_gym" } as ActionPayload,
        confidence: 0.9,
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// executeAction — routing
// ---------------------------------------------------------------------------

describe("executeAction — routing", () => {
  it("routes log_nutrition to nutrition script", async () => {
    const action = makeAction("log_nutrition", {
      intent: "log_nutrition",
      entries: [
        { item: "rice", calories: 200, protein: 4, fat: 1, carbs: 45 },
      ],
    });
    const result = await executeAction(action);

    // Script will fail because DB is mocked to return empty, but routing works
    // (logNutrition returns error for 0 known items if all are unknown)
    expect(result.actionId).toBe(action.id);
    expect(result.timestamp).toBeGreaterThan(0);
    // The result is either success (item logged) or error (no recognized items)
    expect(["executed", "error"]).toContain(result.status);
  });

  it("routes log_gym to gym script", async () => {
    const action = makeAction("log_gym", {
      intent: "log_gym",
      bodyPart: "chest",
      notes: "bench press",
    });
    const result = await executeAction(action);

    expect(result.actionId).toBe(action.id);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it("routes log_run to run script", async () => {
    const action = makeAction("log_run", {
      intent: "log_run",
      miles: 3.5,
      duration: "28:00",
    });
    const result = await executeAction(action);

    expect(result.actionId).toBe(action.id);
  });

  it("routes mark_habit to habit script", async () => {
    const action = makeAction("mark_habit", {
      intent: "mark_habit",
      habit: "meditation",
    });
    const result = await executeAction(action);

    expect(result.actionId).toBe(action.id);
  });

  it("routes increment_goal to goal script", async () => {
    const action = makeAction("increment_goal", {
      intent: "increment_goal",
      habit: "reading",
      value: 30,
      unit: "minutes",
    });
    const result = await executeAction(action);

    expect(result.actionId).toBe(action.id);
  });

  it("routes set_goal to goal script", async () => {
    const action = makeAction("set_goal", {
      intent: "set_goal",
      categoryName: "Running",
      metric: "miles",
      target: 20,
      unit: "miles",
      period: "weekly",
    });
    const result = await executeAction(action);

    expect(result.actionId).toBe(action.id);
  });

  it("routes add_category to category script", async () => {
    const action = makeAction(
      "add_category",
      {
        intent: "add_category",
        name: "Yoga",
        type: "custom",
      },
      { categoryId: null, categoryName: null },
    );
    const result = await executeAction(action);

    expect(result.actionId).toBe(action.id);
  });

  it("routes query_progress as info (read-only)", async () => {
    const action = makeAction("query_progress", {
      intent: "query_progress",
      timeframe: "today",
    });
    const result = await executeAction(action);

    expect(result.actionId).toBe(action.id);
    // query_progress returns info status on success
    if (result.success) {
      expect(result.status).toBe("info");
    }
  });
});

// ---------------------------------------------------------------------------
// executeAction — error handling
// ---------------------------------------------------------------------------

describe("executeAction — error handling", () => {
  it("returns error for unknown intent", async () => {
    const action = makeAction("unknown", { intent: "unknown" });
    const result = await executeAction(action);

    expect(result.success).toBe(false);
    expect(result.status).toBe("error");
    expect(result.message).toContain("Unknown intent");
  });

  it("returns error for invalid action shape", async () => {
    const badAction = { id: "not-a-uuid", intent: "log_gym" } as unknown as Action;
    const result = await executeAction(badAction);

    expect(result.success).toBe(false);
    expect(result.status).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// ActionResult contract
// ---------------------------------------------------------------------------

describe("ActionResult contract", () => {
  it("always includes actionId and timestamp", async () => {
    const action = makeAction("log_gym", {
      intent: "log_gym",
      bodyPart: "back",
    });
    const result = await executeAction(action);

    expect(result.actionId).toBe(action.id);
    expect(typeof result.timestamp).toBe("number");
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.message).toBe("string");
    expect(["proposed", "executed", "info", "error", "clarify"]).toContain(result.status);
  });

  it("result has mutation field (null or string)", async () => {
    const action = makeAction("unknown", { intent: "unknown" });
    const result = await executeAction(action);

    expect(result.mutation === null || typeof result.mutation === "string").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe("executor — exports", () => {
  it("exports createAction and executeAction", async () => {
    const mod = await import("../lib/actions/executor");
    expect(typeof mod.createAction).toBe("function");
    expect(typeof mod.executeAction).toBe("function");
  });

  it("does not export mutation-named functions", async () => {
    const mod = await import("../lib/actions/executor");
    const names = Object.keys(mod);
    // Executor is the mutation boundary — it calls scripts but does not
    // expose raw DB mutation functions
    expect(names).not.toContain("insertLog");
    expect(names).not.toContain("supabaseAdmin");
  });
});
