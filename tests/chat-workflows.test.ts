import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase and helpers — factories must be self-contained (hoisted)
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
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }));
    // Make thenable for non-single() queries
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

vi.mock("../lib/user-sb", () => ({
  getOrCreateUser: vi.fn().mockResolvedValue("test-user-id"),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { supabaseAdmin } from "../lib/supabase";
import { normalize } from "../lib/chat-normalizer";
import { proposeAction, buildAction } from "../lib/chat-executor";
import { executeAction } from "../lib/actions/executor";
import { computeActualForMetric, buildStructuredLog } from "../lib/progress";
import type { ClassifierOutput } from "../lib/chat-scenarios";
import type { NormalizedInput } from "../lib/chat-normalizer";
import type { EstimatedNutritionEntry } from "../lib/chat-scenarios";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

function makeClassified(
  scenario: string,
  params: Record<string, unknown>,
  confidence = 0.95,
): ClassifierOutput {
  return { scenario: scenario as ClassifierOutput["scenario"], params, confidence };
}

function setupCategoryMock(categories: Array<{ id: string; name: string; type: string }>) {
  mockFrom.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    const insertFn = vi.fn().mockResolvedValue({ error: null });

    chain.insert = insertFn;
    chain.select = vi.fn(self);
    chain.eq = vi.fn(self);
    chain.gte = vi.fn(self);
    chain.lte = vi.fn(self);
    chain.in = vi.fn(self);
    chain.order = vi.fn(self);
    chain.limit = vi.fn(self);
    chain.update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    chain.single = vi.fn().mockImplementation(() => {
      if (table === "categories") {
        // Return first matching category
        return Promise.resolve({ data: categories[0] ?? null });
      }
      return Promise.resolve({ data: null });
    });
    chain.then = (resolve: (v: unknown) => void) => {
      if (table === "categories") {
        return Promise.resolve({ data: categories }).then(resolve);
      }
      if (table === "logs") {
        return Promise.resolve({ data: [] }).then(resolve);
      }
      if (table === "goals") {
        return Promise.resolve({ data: [] }).then(resolve);
      }
      return Promise.resolve({ data: null }).then(resolve);
    };

    return chain;
  });
}

function getInsertCalls(): unknown[] {
  const calls: unknown[] = [];
  for (const call of mockFrom.mock.results) {
    const chain = call.value;
    if (chain?.insert?.mock?.calls?.length > 0) {
      calls.push(...chain.insert.mock.calls);
    }
  }
  return calls;
}

function wasInsertCalled(): boolean {
  return getInsertCalls().length > 0;
}

// ---------------------------------------------------------------------------
// Test: Normalizer
// ---------------------------------------------------------------------------

describe("Chat Workflow: Normalizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCategoryMock([
      { id: "cat-nutrition", name: "Nutrition", type: "nutrition" },
    ]);
  });

  it("normalizes 'i ate a cheeseburger' → log_nutrition with categoryId", async () => {
    const classified = makeClassified("log_nutrition", {
      entries: [{ item: "cheeseburger" }],
    });
    const result = await normalize(classified, "test-user");

    expect(result.intent).toBe("log_nutrition");
    expect(result.category).toBe("nutrition");
    expect(result.categoryId).toBe("cat-nutrition");
    expect(result.confidence).toBe(0.95);
  });

  it("normalizes 'i finished reading' → mark_habit with title", async () => {
    const classified = makeClassified("mark_habit", { habit: "reading" });
    const result = await normalize(classified, "test-user");

    expect(result.intent).toBe("mark_habit");
    expect(result.title).toBe("reading");
    expect(result.period).toBe("daily");
  });

  it("normalizes 'i read for 20 minutes' → increment_goal with count+unit", async () => {
    const classified = makeClassified("increment_goal", {
      habit: "reading",
      value: 20,
      unit: "minutes",
    });
    const result = await normalize(classified, "test-user");

    expect(result.intent).toBe("increment_goal");
    expect(result.count).toBe(20);
    expect(result.unit).toBe("minutes");
    expect(result.title).toBe("reading");
  });
});

// ---------------------------------------------------------------------------
// Test: Propose (no DB writes)
// ---------------------------------------------------------------------------

describe("Chat Workflow: Propose (no DB writes)", () => {
  it("proposes nutrition with 'Sound right?'", () => {
    const input: NormalizedInput = {
      intent: "log_nutrition",
      userId: "test-user",
      category: "nutrition",
      categoryId: "cat-nutrition",
      categoryName: "Nutrition",
      params: { entries: [{ item: "cheeseburger" }] },
      confidence: 0.95,
    };
    const estimates: EstimatedNutritionEntry[] = [
      { item: "cheeseburger", calories: 530, protein: 25, fat: 30, carbs: 40 },
    ];

    const result = proposeAction(input, estimates);

    expect(result.status).toBe("proposed");
    expect(result.message).toContain("~530 cal");
    expect(result.message).toContain("Sound right?");
  });

  it("proposes gym session without requiring body part", () => {
    const input: NormalizedInput = {
      intent: "log_gym",
      userId: "test-user",
      category: "habit",
      categoryId: "cat-gym",
      categoryName: "Gym",
      params: {},
      confidence: 0.92,
    };

    const result = proposeAction(input);
    expect(result.status).toBe("proposed");
    expect(result.message).toContain("gym session");
  });

  it("proposes set_goal with 'Go ahead?'", () => {
    const input: NormalizedInput = {
      intent: "set_goal",
      userId: "test-user",
      title: "sessions",
      count: 1,
      period: "daily",
      categoryId: "cat-custom",
      categoryName: "Stretching",
      params: { metric: "sessions", target: 1, period: "daily" },
      confidence: 0.85,
    };

    const result = proposeAction(input);
    expect(result.status).toBe("proposed");
    expect(result.message).toContain("Go ahead?");
  });

  it("confirmation-required flow does NOT write before confirmation", () => {
    vi.clearAllMocks();

    const input: NormalizedInput = {
      intent: "log_nutrition",
      userId: "test-user",
      categoryId: "cat-nutrition",
      categoryName: "Nutrition",
      params: {},
      confidence: 0.95,
    };

    // proposeAction is synchronous — no DB calls possible
    proposeAction(input, [
      { item: "burger", calories: 500, protein: 20, fat: 25, carbs: 40 },
    ]);

    expect(wasInsertCalled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test: buildAction (produces Action, no DB writes)
// ---------------------------------------------------------------------------

describe("Chat Workflow: buildAction", () => {
  it("builds Action from normalized nutrition input", () => {
    const input: NormalizedInput = {
      intent: "log_nutrition",
      userId: "test-user",
      category: "nutrition",
      categoryId: "cat-nutrition",
      categoryName: "Nutrition",
      params: {},
      confidence: 0.95,
    };
    const estimates: EstimatedNutritionEntry[] = [
      { item: "cheeseburger", calories: 530, protein: 25, fat: 30, carbs: 40 },
    ];

    const action = buildAction(input, estimates);

    expect(action).not.toBeNull();
    expect(action!.intent).toBe("log_nutrition");
    expect(action!.userId).toBe("test-user");
    expect(action!.categoryId).toBe("cat-nutrition");
    expect(action!.status).toBe("proposed");
    expect(action!.id).toBeTruthy();
    expect(action!.payload).toEqual({
      intent: "log_nutrition",
      entries: [{ item: "cheeseburger", calories: 530, protein: 25, fat: 30, carbs: 40, unknown: undefined }],
    });
  });

  it("builds Action from normalized gym input", () => {
    const input: NormalizedInput = {
      intent: "log_gym",
      userId: "test-user",
      category: "habit",
      categoryId: "cat-gym",
      categoryName: "Gym",
      params: { bodyPart: "chest" },
      confidence: 0.92,
    };

    const action = buildAction(input);

    expect(action).not.toBeNull();
    expect(action!.intent).toBe("log_gym");
    expect(action!.payload).toEqual({
      intent: "log_gym",
      bodyPart: "chest",
      notes: undefined,
    });
  });

  it("builds Action from normalized run input", () => {
    const input: NormalizedInput = {
      intent: "log_run",
      userId: "test-user",
      count: 3,
      unit: "miles",
      category: "habit",
      categoryId: "cat-running",
      categoryName: "Running",
      params: { miles: 3, duration: "25:00" },
      confidence: 0.9,
    };

    const action = buildAction(input);

    expect(action).not.toBeNull();
    expect(action!.payload).toEqual({
      intent: "log_run",
      miles: 3,
      duration: "25:00",
      notes: undefined,
    });
  });

  it("returns null for unknown intent", () => {
    const input: NormalizedInput = {
      intent: "unknown",
      userId: "test-user",
      params: {},
      confidence: 0.5,
    };

    const action = buildAction(input);
    expect(action).toBeNull();
  });

  it("buildAction does not write to DB", () => {
    vi.clearAllMocks();

    const input: NormalizedInput = {
      intent: "log_gym",
      userId: "test-user",
      categoryId: "cat-gym",
      categoryName: "Gym",
      params: { bodyPart: "legs" },
      confidence: 0.9,
    };

    buildAction(input);
    expect(wasInsertCalled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test: Execute via action executor (DB writes via scripts)
// ---------------------------------------------------------------------------

describe("Chat Workflow: Execute via action executor (DB writes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCategoryMock([
      { id: "cat-nutrition", name: "Nutrition", type: "nutrition" },
    ]);
  });

  it("executes log_nutrition Action → mutation='nutrition_logged'", async () => {
    const input: NormalizedInput = {
      intent: "log_nutrition",
      userId: "test-user",
      category: "nutrition",
      categoryId: "cat-nutrition",
      categoryName: "Nutrition",
      params: { entries: [{ item: "cheeseburger" }] },
      confidence: 0.95,
    };
    const estimates: EstimatedNutritionEntry[] = [
      { item: "cheeseburger", calories: 530, protein: 25, fat: 30, carbs: 40 },
    ];

    const action = buildAction(input, estimates);
    expect(action).not.toBeNull();

    const result = await executeAction(action!);

    expect(result.status).toBe("executed");
    expect(result.mutation).toBe("nutrition_logged");
    expect(result.message).toContain("Logged 1 item");
    expect(wasInsertCalled()).toBe(true);
  });

  it("executes log_gym Action → mutation='gym_logged'", async () => {
    setupCategoryMock([{ id: "cat-gym", name: "Gym", type: "gym" }]);

    const input: NormalizedInput = {
      intent: "log_gym",
      userId: "test-user",
      category: "habit",
      categoryId: "cat-gym",
      categoryName: "Gym",
      params: {},
      confidence: 0.92,
    };

    const action = buildAction(input);
    expect(action).not.toBeNull();

    const result = await executeAction(action!);

    expect(result.status).toBe("executed");
    expect(result.mutation).toBe("gym_logged");
    expect(wasInsertCalled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: Error handling
// ---------------------------------------------------------------------------

describe("Chat Workflow: Error handling", () => {
  it("executes even when categoryId was resolved via fallback", async () => {
    vi.clearAllMocks();
    setupCategoryMock([]);

    const input: NormalizedInput = {
      intent: "mark_habit",
      userId: "test-user",
      title: "meditation",
      category: "habit",
      categoryId: "fallback-cat-id",
      categoryName: "Custom",
      params: { habit: "meditation" },
      confidence: 0.9,
    };

    const action = buildAction(input);
    expect(action).not.toBeNull();

    const result = await executeAction(action!);

    expect(result.status).toBe("executed");
    expect(result.message).toBeTruthy();
    expect(wasInsertCalled()).toBe(true);
  });

  it("failed script returns visible error result", async () => {
    vi.clearAllMocks();
    // Set up mock where insert throws
    mockFrom.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.insert = vi.fn().mockRejectedValue(new Error("DB down"));
      chain.select = vi.fn(self);
      chain.eq = vi.fn(self);
      chain.gte = vi.fn(self);
      chain.lte = vi.fn(self);
      chain.in = vi.fn(self);
      chain.order = vi.fn(self);
      chain.limit = vi.fn(self);
      chain.single = vi.fn().mockResolvedValue({ data: null });
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [] }).then(resolve);
      return chain;
    });

    const input: NormalizedInput = {
      intent: "log_gym",
      userId: "test-user",
      category: "habit",
      categoryId: "cat-gym",
      categoryName: "Gym",
      params: {},
      confidence: 0.92,
    };

    const action = buildAction(input);
    expect(action).not.toBeNull();

    const result = await executeAction(action!);

    expect(result.status).toBe("error");
    expect(result.message).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Test: Unknown input
// ---------------------------------------------------------------------------

describe("Chat Workflow: Unknown input", () => {
  it("unknown intent returns null from buildAction", () => {
    const input: NormalizedInput = {
      intent: "unknown",
      userId: "test-user",
      params: {},
      confidence: 0.98,
    };

    const action = buildAction(input);
    expect(action).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test: Unit inference from chat
// ---------------------------------------------------------------------------

describe("Chat Workflow: Unit inference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCategoryMock([
      { id: "cat-running", name: "Running", type: "running" },
      { id: "cat-custom", name: "Custom", type: "custom" },
    ]);
  });

  it("set_goal 'run 5 miles/week' → unit=miles", async () => {
    const classified = makeClassified("set_goal", {
      categoryName: "running",
      metric: "miles",
      target: 5,
      unit: "miles",
      period: "weekly",
    });

    const input = await normalize(classified, "test-user");

    expect(input.unit).toBe("miles");
    expect(input.count).toBe(5);
    expect(input.period).toBe("weekly");
  });

  it("set_goal 'read 30 min/day' → unit=minutes", async () => {
    const classified = makeClassified("set_goal", {
      categoryName: "custom",
      metric: "reading",
      target: 30,
      unit: "min",
      period: "daily",
    });

    const input = await normalize(classified, "test-user");

    expect(input.unit).toBe("minutes");
    expect(input.count).toBe(30);
    expect(input.period).toBe("daily");
  });

  it("set_goal '3 workouts/week' → unit=count", async () => {
    const classified = makeClassified("set_goal", {
      categoryName: "custom",
      metric: "workouts",
      target: 3,
      unit: "times",
      period: "weekly",
    });

    const input = await normalize(classified, "test-user");

    expect(input.unit).toBe("count");
    expect(input.count).toBe(3);
    expect(input.period).toBe("weekly");
  });

  it("set_goal with no explicit unit infers from metric name", async () => {
    const classified = makeClassified("set_goal", {
      categoryName: "running",
      metric: "miles",
      target: 10,
      period: "weekly",
    });

    const input = await normalize(classified, "test-user");

    expect(input.unit).toBe("miles");
  });

  it("set_goal with no explicit unit infers minutes from metric", async () => {
    const classified = makeClassified("set_goal", {
      categoryName: "custom",
      metric: "minutes",
      target: 30,
      period: "daily",
    });

    const input = await normalize(classified, "test-user");

    expect(input.unit).toBe("minutes");
  });

  it("mark_habit always gets unit=count", async () => {
    const classified = makeClassified("mark_habit", {
      habit: "meditate",
    });

    const input = await normalize(classified, "test-user");

    expect(input.unit).toBe("count");
  });

  it("log_run always gets unit=miles", async () => {
    const classified = makeClassified("log_run", {
      miles: 3,
    });

    const input = await normalize(classified, "test-user");

    expect(input.unit).toBe("miles");
  });
});

// ---------------------------------------------------------------------------
// Test: Full loop integration — goal creation + log write + multi-goal matching
// ---------------------------------------------------------------------------

describe("Integration: run log increments both distance and session goals", () => {
  it("'ran 1 mile' log matches miles/week goal AND count/week goal", async () => {
    // --- Setup: two weekly running goals ---
    const milesGoal = { metric: "miles", unit: "miles", target: 5, period: "weekly" };
    const sessionsGoal = { metric: "sessions", unit: "count", target: 3, period: "weekly" };

    // --- Simulate: user says "ran 1 mile" → structured log ---
    // 1. Normalize the chat input
    vi.clearAllMocks();
    setupCategoryMock([{ id: "cat-running", name: "Running", type: "running" }]);
    const classified = makeClassified("log_run", { miles: 1 });
    const input = await normalize(classified, "test-user");

    expect(input.unit).toBe("miles");
    expect(input.count).toBe(1);

    // 2. Build the structured log (same as what quick-log writes)
    const logData = buildStructuredLog(1, "miles");
    expect(logData).toEqual({ distance: 1, distance_unit: "miles", count: 1 });

    // --- Verify: both goals match this single log ---
    const logs = [logData];

    // Miles goal: unit=miles → reads distance field where distance_unit=miles
    const milesActual = computeActualForMetric(
      milesGoal.metric,
      milesGoal.unit,
      "running",
      logs,
    );
    expect(milesActual).toBe(1); // 1 mile logged

    // Sessions goal: unit=count → reads count field
    const sessionsActual = computeActualForMetric(
      sessionsGoal.metric,
      sessionsGoal.unit,
      "running",
      logs,
    );
    expect(sessionsActual).toBe(1); // 1 session logged

    // --- Accumulation: 3 runs of varying distance ---
    const threeLogs = [
      buildStructuredLog(1, "miles"),   // 1 mile
      buildStructuredLog(2.5, "miles"), // 2.5 miles
      buildStructuredLog(0.5, "miles"), // 0.5 miles
    ];

    const totalMiles = computeActualForMetric("miles", "miles", "running", threeLogs);
    expect(totalMiles).toBe(4); // 1 + 2.5 + 0.5

    const totalSessions = computeActualForMetric("sessions", "count", "running", threeLogs);
    expect(totalSessions).toBe(3); // 3 runs = 3 sessions

    // Miles goal: 4/5 = 80%
    expect(totalMiles / milesGoal.target).toBeCloseTo(0.8);
    // Sessions goal: 3/3 = 100%
    expect(totalSessions / sessionsGoal.target).toBe(1);
  });

  it("legacy run log { miles: 2 } still matches miles goal", () => {
    const legacyLog = { miles: 2 };
    const actual = computeActualForMetric("miles", "miles", "running", [legacyLog]);
    expect(actual).toBe(2);
  });

  it("duration log matches minutes goal", () => {
    const log = buildStructuredLog(30, "minutes");
    expect(log).toEqual({ duration: 30, duration_unit: "minutes", count: 1 });

    const minutesActual = computeActualForMetric("reading", "minutes", "custom", [log]);
    expect(minutesActual).toBe(30);

    const countActual = computeActualForMetric("sessions", "count", "custom", [log]);
    expect(countActual).toBe(1);
  });
});
