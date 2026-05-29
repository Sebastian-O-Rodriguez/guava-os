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
import { findCategoryByName, findCategoryByType, resolveCategory } from "./scripts/helpers";
import type { ClassifierOutput } from "./chat-scenarios";
import type { GoalUnit } from "./types";

// ---------------------------------------------------------------------------
// Unit inference — maps raw strings to valid GoalUnit values
// ---------------------------------------------------------------------------

const UNIT_ALIASES: Record<string, GoalUnit> = {
  // count
  count: "count", times: "count", sessions: "count", reps: "count", sets: "count",
  workouts: "count", workout: "count", session: "count", time: "count", x: "count",
  // minutes
  minutes: "minutes", min: "minutes", mins: "minutes", minute: "minutes",
  // hours
  hours: "hours", hr: "hours", hrs: "hours", hour: "hours",
  // miles
  miles: "miles", mile: "miles", mi: "miles",
  // km
  km: "km", kilometers: "km", kilometre: "km", kilometres: "km",
  // grams
  grams: "grams", gram: "grams", g: "grams",
  // calories
  calories: "calories", cal: "calories", cals: "calories", kcal: "calories",
};

function inferUnit(raw: unknown): GoalUnit {
  if (typeof raw !== "string" || !raw) return "count";
  const key = raw.toLowerCase().trim();
  return UNIT_ALIASES[key] ?? "count";
}

/** Infer unit from metric name when no explicit unit is provided */
function inferUnitFromMetric(metric: string): GoalUnit {
  const m = metric.toLowerCase();
  if (m === "miles" || m.includes("mile")) return "miles";
  if (m === "km" || m.includes("kilometer") || m.includes("kilometre")) return "km";
  if (m === "calories" || m === "cal") return "calories";
  if (m === "protein" || m === "fat" || m === "carbs") return "grams";
  if (m.includes("min")) return "minutes";
  if (m.includes("hour") || m.includes("hr")) return "hours";
  return "count";
}

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
  const cat = await resolveCategory(userId, "nutrition");
  return {
    intent: "log_nutrition",
    userId,
    category: "nutrition",
    categoryId: cat.id,
    categoryName: cat.name,
    params: p,
    confidence,
  };
}

async function normalizeGym(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const cat = await resolveCategory(userId, "gym");
  const bodyPart = typeof p.bodyPart === "string" ? p.bodyPart.toLowerCase() : undefined;
  return {
    intent: "log_gym",
    userId,
    title: bodyPart,
    category: "habit",
    categoryId: cat.id,
    categoryName: cat.name,
    params: { ...p, bodyPart },
    confidence,
  };
}

async function normalizeRun(
  userId: string,
  p: Record<string, unknown>,
  confidence: number,
): Promise<NormalizedInput> {
  const cat = await resolveCategory(userId, "running");
  return {
    intent: "log_run",
    userId,
    count: typeof p.miles === "number" ? p.miles : undefined,
    unit: "miles",
    category: "habit",
    categoryId: cat.id,
    categoryName: cat.name,
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
  const cat = await findCategoryByName(userId, habitName) ??
    await resolveCategory(userId, "custom");
  return {
    intent: "mark_habit",
    userId,
    title: habitName,
    unit: "count",
    category: "habit",
    categoryId: cat.id,
    categoryName: cat.name,
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
  const cat = await findCategoryByName(userId, habitName) ??
    await resolveCategory(userId, "custom");
  return {
    intent: "increment_goal",
    userId,
    title: habitName,
    count: typeof p.value === "number" ? p.value : undefined,
    unit: inferUnit(p.unit),
    category: "goal",
    categoryId: cat.id,
    categoryName: cat.name,
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
  // Try name match first, then type match, then auto-create via resolveCategory
  const cat =
    await findCategoryByName(userId, categoryName) ??
    await findCategoryByType(userId, categoryName) ??
    await resolveCategory(userId, categoryName || "custom");
  const period = p.period === "weekly" ? "weekly" : "daily";
  const metric = typeof p.metric === "string" ? p.metric : "sessions";
  // Unit: prefer explicit from classifier, else infer from metric name
  const unit = p.unit ? inferUnit(p.unit) : inferUnitFromMetric(metric);
  return {
    intent: "set_goal",
    userId,
    title: metric,
    count: typeof p.target === "number" ? p.target : undefined,
    unit,
    period,
    category: "goal",
    categoryId: cat.id,
    categoryName: cat.name,
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
