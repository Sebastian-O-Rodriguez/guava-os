import { describe, it, expect } from "vitest";
import {
  classifierOutputSchema,
  logNutritionParamsSchema,
  logGymParamsSchema,
  logRunParamsSchema,
  setGoalParamsSchema,
  addCategoryParamsSchema,
  queryProgressParamsSchema,
} from "../chat-scenarios";

// ---------------------------------------------------------------------------
// classifierOutputSchema
// ---------------------------------------------------------------------------

describe("classifierOutputSchema", () => {
  it("accepts a valid scenario with params", () => {
    const result = classifierOutputSchema.safeParse({
      scenario: "log_nutrition",
      params: { entries: [] },
    });
    expect(result.success).toBe(true);
  });

  it("accepts every known scenario value", () => {
    const scenarios = [
      "log_nutrition",
      "log_gym",
      "log_run",
      "set_goal",
      "add_category",
      "query_progress",
      "unknown",
    ] as const;

    for (const scenario of scenarios) {
      const result = classifierOutputSchema.safeParse({ scenario, params: {} });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown scenario value", () => {
    const result = classifierOutputSchema.safeParse({
      scenario: "delete_everything",
      params: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing scenario", () => {
    const result = classifierOutputSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// logNutritionParamsSchema
// ---------------------------------------------------------------------------

describe("logNutritionParamsSchema", () => {
  it("accepts a complete entry", () => {
    const result = logNutritionParamsSchema.safeParse({
      entries: [{ item: "chicken breast", calories: 300, protein: 50, fat: 5, carbs: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an entry without the optional carbs field", () => {
    const result = logNutritionParamsSchema.safeParse({
      entries: [{ item: "steak", calories: 450, protein: 45, fat: 22 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty entries array", () => {
    const result = logNutritionParamsSchema.safeParse({ entries: [] });
    expect(result.success).toBe(true);
  });

  it("rejects missing required calories field", () => {
    const result = logNutritionParamsSchema.safeParse({
      entries: [{ item: "egg", protein: 6, fat: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-number calories", () => {
    const result = logNutritionParamsSchema.safeParse({
      entries: [{ item: "egg", calories: "300", protein: 6, fat: 5 }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// logGymParamsSchema
// ---------------------------------------------------------------------------

describe("logGymParamsSchema", () => {
  it("accepts bodyPart alone", () => {
    const result = logGymParamsSchema.safeParse({ bodyPart: "chest" });
    expect(result.success).toBe(true);
  });

  it("accepts bodyPart with optional notes", () => {
    const result = logGymParamsSchema.safeParse({ bodyPart: "legs", notes: "heavy squats" });
    expect(result.success).toBe(true);
  });

  it("rejects missing bodyPart", () => {
    const result = logGymParamsSchema.safeParse({ notes: "great session" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// logRunParamsSchema
// ---------------------------------------------------------------------------

describe("logRunParamsSchema", () => {
  it("accepts miles alone", () => {
    const result = logRunParamsSchema.safeParse({ miles: 3.1 });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = logRunParamsSchema.safeParse({
      miles: 5,
      duration: "42:30",
      notes: "morning run",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing miles", () => {
    const result = logRunParamsSchema.safeParse({ duration: "30:00" });
    expect(result.success).toBe(false);
  });

  it("rejects non-number miles", () => {
    const result = logRunParamsSchema.safeParse({ miles: "3.1" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setGoalParamsSchema
// ---------------------------------------------------------------------------

describe("setGoalParamsSchema", () => {
  it("accepts a valid daily goal", () => {
    const result = setGoalParamsSchema.safeParse({
      categoryName: "nutrition",
      metric: "calories",
      target: 2500,
      period: "daily",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a weekly period", () => {
    const result = setGoalParamsSchema.safeParse({
      categoryName: "gym",
      metric: "sessions",
      target: 3,
      period: "weekly",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid period value", () => {
    const result = setGoalParamsSchema.safeParse({
      categoryName: "gym",
      metric: "sessions",
      target: 3,
      period: "monthly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing target", () => {
    const result = setGoalParamsSchema.safeParse({
      categoryName: "gym",
      metric: "sessions",
      period: "weekly",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addCategoryParamsSchema
// ---------------------------------------------------------------------------

describe("addCategoryParamsSchema", () => {
  it("accepts name alone", () => {
    const result = addCategoryParamsSchema.safeParse({ name: "yoga" });
    expect(result.success).toBe(true);
  });

  it("accepts name with a known type", () => {
    const result = addCategoryParamsSchema.safeParse({ name: "lifting", type: "gym" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown type value", () => {
    const result = addCategoryParamsSchema.safeParse({ name: "yoga", type: "flexibility" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = addCategoryParamsSchema.safeParse({ type: "custom" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// queryProgressParamsSchema
// ---------------------------------------------------------------------------

describe("queryProgressParamsSchema", () => {
  it("accepts empty input and defaults timeframe to week", () => {
    const result = queryProgressParamsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeframe).toBe("week");
    }
  });

  it("accepts explicit timeframe values", () => {
    for (const timeframe of ["today", "week", "month"] as const) {
      const result = queryProgressParamsSchema.safeParse({ timeframe });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid timeframe value", () => {
    const result = queryProgressParamsSchema.safeParse({ timeframe: "year" });
    expect(result.success).toBe(false);
  });

  it("accepts an optional category filter", () => {
    const result = queryProgressParamsSchema.safeParse({
      timeframe: "week",
      category: "gym",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("gym");
    }
  });
});
