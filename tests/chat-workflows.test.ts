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
import { proposeAction, executeAction } from "../lib/chat-executor";
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
// Test: Execute (DB writes via scripts)
// ---------------------------------------------------------------------------

describe("Chat Workflow: Execute (DB writes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCategoryMock([
      { id: "cat-nutrition", name: "Nutrition", type: "nutrition" },
    ]);
  });

  it("executes log_nutrition → mutation='nutrition_logged'", async () => {
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

    const result = await executeAction(input, estimates);

    expect(result.status).toBe("executed");
    expect(result.mutation).toBe("nutrition_logged");
    expect(result.message).toContain("Logged 1 item");
    expect(wasInsertCalled()).toBe(true);
  });

  it("executes log_gym → mutation='gym_logged'", async () => {
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

    const result = await executeAction(input);

    expect(result.status).toBe("executed");
    expect(result.mutation).toBe("gym_logged");
    expect(wasInsertCalled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: Error handling
// ---------------------------------------------------------------------------

describe("Chat Workflow: Error handling", () => {
  it("returns visible error when category not found", async () => {
    vi.clearAllMocks();
    setupCategoryMock([]);

    const input: NormalizedInput = {
      intent: "mark_habit",
      userId: "test-user",
      title: "meditation",
      category: "habit",
      categoryId: null,
      categoryName: null,
      params: { habit: "meditation" },
      confidence: 0.9,
    };

    const result = await executeAction(input);

    expect(result.status).toBe("clarify");
    expect(result.message).toBeTruthy();
    expect(result.message.length).toBeGreaterThan(0);
    expect(wasInsertCalled()).toBe(false);
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

    const result = await executeAction(input);

    expect(result.status).toBe("error");
    expect(result.message).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Test: Unknown input
// ---------------------------------------------------------------------------

describe("Chat Workflow: Unknown input", () => {
  it("unknown intent calls no mutation script", async () => {
    vi.clearAllMocks();

    const input: NormalizedInput = {
      intent: "unknown",
      userId: "test-user",
      params: {},
      confidence: 0.98,
    };

    const result = await executeAction(input);

    expect(result.status).toBe("info");
    expect(wasInsertCalled()).toBe(false);
  });
});
