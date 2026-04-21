/**
 * Thin input normalizer.
 *
 * Sits between classifier and scripts. Responsibilities:
 * - Canonical goal/category lookup (match user input to DB names)
 * - Period defaulting (daily if not specified)
 * - Payload cleanup for scripts
 * - Final shape validation
 *
 * Does NOT do: synonym mapping, NLP, language processing (classifier handles that).
 * Requires userId — all DB lookups are scoped to the authenticated user.
 */
import { findCategoryByName, findCategoryByType } from "./scripts/helpers";
import type { ClassifierOutput } from "./chat-scenarios";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export type NormalizedInput = {
  intent: string;
  userId: string;
  title?: string;
  period?: "daily" | "weekly";
  count?: number;
  unit?: string;
  category?: "nutrition" | "habit" | "goal";
  categoryId?: string | null;
  categoryName?: string | null;
  params: Record<string, unknown>;
  confidence: number;
};

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

export async function normalize(
  classified: ClassifierOutput,
  userId: string,
): Promise<NormalizedInput> {
  const { scenario, params, confidence } = classified;
  const p = params as Record<string, unknown>;

  switch (scenario) {
    case "log_nutrition":
      return normalizeNutrition(userId, p, confidence);
    case "log_gym":
      return normalizeGym(userId, p, confidence);
    case "log_run":
      return normalizeRun(userId, p, confidence);
    case "mark_habit":
      return normalizeMarkHabit(userId, p, confidence);
    case "increment_goal":
      return normalizeIncrementGoal(userId, p, confidence);
    case "set_goal":
      return normalizeSetGoal(userId, p, confidence);
    case "add_category":
      return normalizeAddCategory(userId, p, confidence);
    case "query_progress":
      return normalizeQueryProgress(userId, p, confidence);
    default:
      return { intent: "unknown", userId, params: p, confidence };
  }
}

// ---------------------------------------------------------------------------
// Per-scenario normalizers
// ---------------------------------------------------------------------------

async function normalizeNutrition(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const cat = await findCategoryByType(userId, "nutrition");
  return {
    intent: "log_nutrition",
    userId,
    category: "nutrition",
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? null,
    params: p,
    confidence,
  };
}

async function normalizeGym(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const cat = await findCategoryByType(userId, "gym");
  const bodyPart = typeof p.bodyPart === "string" ? p.bodyPart.toLowerCase() : undefined;
  return {
    intent: "log_gym",
    userId,
    title: bodyPart,
    category: "habit",
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? null,
    params: { ...p, bodyPart },
    confidence,
  };
}

async function normalizeRun(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const cat = await findCategoryByType(userId, "running");
  return {
    intent: "log_run",
    userId,
    count: typeof p.miles === "number" ? p.miles : undefined,
    unit: "miles",
    category: "habit",
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? null,
    params: p,
    confidence,
  };
}

async function normalizeMarkHabit(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const habitName = typeof p.habit === "string" ? p.habit.toLowerCase() : "";
  const cat = await findCategoryByName(userId, habitName);
  return {
    intent: "mark_habit",
    userId,
    title: habitName,
    category: "habit",
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? null,
    period: "daily",
    params: p,
    confidence,
  };
}

async function normalizeIncrementGoal(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const habitName = typeof p.habit === "string" ? p.habit.toLowerCase() : "";
  const cat = await findCategoryByName(userId, habitName);
  return {
    intent: "increment_goal",
    userId,
    title: habitName,
    count: typeof p.value === "number" ? p.value : undefined,
    unit: typeof p.unit === "string" ? p.unit : undefined,
    category: "goal",
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? null,
    period: "daily",
    params: p,
    confidence,
  };
}

async function normalizeSetGoal(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const categoryName = typeof p.categoryName === "string" ? p.categoryName.toLowerCase() : "";
  const cat = await findCategoryByName(userId, categoryName) ?? await findCategoryByType(userId, categoryName);
  const period = p.period === "weekly" ? "weekly" : "daily";
  return {
    intent: "set_goal",
    userId,
    title: typeof p.metric === "string" ? p.metric : undefined,
    count: typeof p.target === "number" ? p.target : undefined,
    period,
    category: "goal",
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? categoryName,
    params: p,
    confidence,
  };
}

async function normalizeAddCategory(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const name = typeof p.name === "string" ? p.name.trim() : "";
  return {
    intent: "add_category",
    userId,
    title: name,
    params: p,
    confidence,
  };
}

async function normalizeQueryProgress(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const timeframe = p.timeframe === "week" || p.timeframe === "month" ? p.timeframe : "today";
  return {
    intent: "query_progress",
    userId,
    params: { ...p, timeframe },
    confidence,
  };
}
