import {
  logNutritionParamsSchema,
  logGymParamsSchema,
  logRunParamsSchema,
  setGoalParamsSchema,
  addCategoryParamsSchema,
  queryProgressParamsSchema,
} from "./chat-scenarios";
import { normalizeDate, getWeekStart, getWeekEnd } from "./dates";
import type { CategoryType, NutritionLogData, GymLogData, RunLogData } from "./types";
import { supabaseAdmin } from "./supabase";
import { getOrCreateUser } from "./user-sb";
import { generateId } from "./id";

export type ExecutorResult = { message: string; data?: unknown };

// ---------------------------------------------------------------------------
// Helper: ISO date string (YYYY-MM-DD) from a Date
// ---------------------------------------------------------------------------

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Deterministic executor: maps a classified scenario + raw params to Supabase
 * calls and returns a template response. No LLM is involved here.
 */
export async function executeScenario(
  scenario: string,
  params: Record<string, unknown>,
): Promise<ExecutorResult> {
  switch (scenario) {
    case "log_nutrition":
      return handleLogNutrition(params);

    case "log_gym":
      return handleLogGym(params);

    case "log_run":
      return handleLogRun(params);

    case "set_goal":
      return handleSetGoal(params);

    case "add_category":
      return handleAddCategory(params);

    case "query_progress":
      return handleQueryProgress(params);

    case "unknown":
    default:
      return {
        message:
          "I can help you log food, gym sessions, runs, set goals, or check progress. What would you like to do?",
      };
  }
}

// ---------------------------------------------------------------------------
// Scenario handlers
// ---------------------------------------------------------------------------

async function handleLogNutrition(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = logNutritionParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      message: `Could not log nutrition — ${parsed.error.issues[0].message}`,
    };
  }

  const userId = await getOrCreateUser();

  const { data: nutritionCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "nutrition")
    .eq("active", true)
    .single();

  if (!nutritionCat) {
    return { message: "Failed to find or create your Nutrition category." };
  }

  const today = toISODate(normalizeDate(new Date()));

  try {
    const rows = parsed.data.entries.map((entry) => ({
      id: generateId(),
      category_id: nutritionCat.id,
      date: today,
      data: entry,
    }));
    const { error } = await supabaseAdmin.from("logs").insert(rows);
    if (error) throw error;
  } catch (err) {
    console.error("[handleLogNutrition]", err);
    return { message: "Failed to log nutrition entries." };
  }

  // Fetch updated daily totals for the response template
  const { data: logs } = await supabaseAdmin
    .from("logs")
    .select("data")
    .eq("category_id", nutritionCat.id)
    .eq("date", today);

  const totals = (logs ?? []).reduce(
    (acc, log) => {
      const entry = (log.data as unknown) as Partial<NutritionLogData>;
      return {
        calories: acc.calories + (entry.calories ?? 0),
        protein: acc.protein + (entry.protein ?? 0),
        fat: acc.fat + (entry.fat ?? 0),
        carbs: acc.carbs + (entry.carbs ?? 0),
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );

  const n = parsed.data.entries.length;
  return {
    message: `Logged ${n} item${n === 1 ? "" : "s"}. Today's totals: ${totals.calories} cal, ${totals.protein}g protein, ${totals.fat}g fat${totals.carbs ? `, ${totals.carbs}g carbs` : ""}.`,
    data: totals,
  };
}

async function handleLogGym(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = logGymParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      message: `Could not log gym session — ${parsed.error.issues[0].message}`,
    };
  }

  const userId = await getOrCreateUser();

  const { data: gymCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "gym")
    .eq("active", true)
    .single();

  if (!gymCat) {
    return { message: "Failed to find or create your Gym category." };
  }

  const normalizedBodyPart = parsed.data.bodyPart.toLowerCase();
  const today = toISODate(normalizeDate(new Date()));

  try {
    const { error } = await supabaseAdmin.from("logs").insert({
      id: generateId(),
      category_id: gymCat.id,
      date: today,
      data: { bodyPart: normalizedBodyPart, notes: parsed.data.notes },
    });
    if (error) throw error;
  } catch (err) {
    console.error("[handleLogGym]", err);
    return { message: "Failed to log gym session." };
  }

  // Fetch weekly summary
  const now = new Date();
  const { data: weekLogs } = await supabaseAdmin
    .from("logs")
    .select("data")
    .eq("category_id", gymCat.id)
    .gte("date", toISODate(getWeekStart(now)))
    .lte("date", toISODate(getWeekEnd(now)));

  const counts = new Map<string, number>();
  for (const log of weekLogs ?? []) {
    const entry = (log.data as unknown) as Partial<GymLogData>;
    const bp = entry.bodyPart ?? "unknown";
    counts.set(bp, (counts.get(bp) ?? 0) + 1);
  }

  const summaryText =
    counts.size > 0
      ? Array.from(counts.entries())
          .map(([bp, c]) => `${bp} x${c}`)
          .join(", ")
      : "no sessions yet this week";

  return {
    message: `Logged ${normalizedBodyPart} session. This week: ${summaryText}.`,
  };
}

async function handleLogRun(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = logRunParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      message: `Could not log run — ${parsed.error.issues[0].message}`,
    };
  }

  const userId = await getOrCreateUser();

  const { data: runCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "running")
    .eq("active", true)
    .single();

  if (!runCat) {
    return { message: "Failed to find or create your Running category." };
  }

  const safeMiles = Math.min(Math.max(parsed.data.miles, 0), 1_000);
  const today = toISODate(normalizeDate(new Date()));

  try {
    const { error } = await supabaseAdmin.from("logs").insert({
      id: generateId(),
      category_id: runCat.id,
      date: today,
      data: { miles: safeMiles, duration: parsed.data.duration, notes: parsed.data.notes },
    });
    if (error) throw error;
  } catch (err) {
    console.error("[handleLogRun]", err);
    return { message: "Failed to log run." };
  }

  // Fetch weekly running summary
  const now = new Date();
  const { data: weekLogs } = await supabaseAdmin
    .from("logs")
    .select("data")
    .eq("category_id", runCat.id)
    .gte("date", toISODate(getWeekStart(now)))
    .lte("date", toISODate(getWeekEnd(now)));

  const totalMiles = (weekLogs ?? []).reduce((sum, log) => {
    const entry = (log.data as unknown) as Partial<RunLogData>;
    return sum + (entry.miles ?? 0);
  }, 0);

  // Try to find weekly miles goal
  const { data: milesGoal } = await supabaseAdmin
    .from("goals")
    .select("target")
    .eq("category_id", runCat.id)
    .eq("metric", "miles")
    .eq("active", true)
    .single();

  const goalText = milesGoal ? `/${milesGoal.target}` : "";

  return {
    message: `Logged ${safeMiles} mi run. This week: ${totalMiles}${goalText} mi.`,
  };
}

async function handleSetGoal(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = setGoalParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      message: `Could not set goal — ${parsed.error.issues[0].message}`,
    };
  }

  const userId = await getOrCreateUser();

  // Resolve category by name or type
  const { data: categories } = await supabaseAdmin
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId)
    .eq("active", true);

  const lower = parsed.data.categoryName.toLowerCase();
  const catList = (categories ?? []) as Array<{ id: string; name: string; type: string }>;
  const category =
    catList.find((c) => c.type === lower) ??
    catList.find((c) => c.name.toLowerCase().includes(lower));

  if (!category) {
    return {
      message: `Could not find a category named "${parsed.data.categoryName}". Try creating it first.`,
    };
  }

  const safeTarget = Math.min(Math.max(parsed.data.target, 0), 100_000);

  const { data: existing } = await supabaseAdmin
    .from("goals")
    .select("id")
    .eq("category_id", category.id)
    .eq("metric", parsed.data.metric)
    .eq("active", true)
    .single();

  let goal;
  if (existing) {
    const { data: updated, error } = await supabaseAdmin
      .from("goals")
      .update({ target: safeTarget, period: parsed.data.period })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    goal = updated;
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("goals")
      .insert({
        id: generateId(),
        category_id: category.id,
        metric: parsed.data.metric,
        target: safeTarget,
        period: parsed.data.period,
      })
      .select()
      .single();
    if (error) throw error;
    goal = created;
  }

  return {
    message: `Set ${parsed.data.metric} goal to ${safeTarget} (${parsed.data.period}).`,
    data: goal,
  };
}

async function handleAddCategory(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = addCategoryParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      message: `Could not add category — ${parsed.error.issues[0].message}`,
    };
  }

  const safeName = parsed.data.name.slice(0, 50);
  const userId = await getOrCreateUser();

  try {
    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .insert({
        id: generateId(),
        user_id: userId,
        name: safeName,
        type: parsed.data.type ?? "custom",
      })
      .select()
      .single();

    if (error) throw error;

    return {
      message: `Created '${safeName}' category.`,
      data: category,
    };
  } catch (err) {
    console.error("[handleAddCategory]", err);
    return { message: "Failed to create category." };
  }
}

async function handleQueryProgress(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = queryProgressParamsSchema.safeParse(raw);
  const timeframe = parsed.success ? (parsed.data.timeframe ?? "week") : "week";
  const filterCategory = parsed.success ? parsed.data.category : undefined;

  const userId = await getOrCreateUser();
  const now = new Date();

  const { data: categories } = await supabaseAdmin
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (!categories || categories.length === 0) {
    return {
      message:
        "No categories set up yet. Add a category and some goals to start tracking progress.",
    };
  }

  const catList = categories as Array<{ id: string; name: string; type: string }>;

  const filtered = filterCategory
    ? catList.filter((c) => c.name.toLowerCase().includes(filterCategory.toLowerCase()))
    : catList;

  if (filtered.length === 0) {
    return { message: `No category found matching "${filterCategory}".` };
  }

  // Fetch goals for all filtered categories in one query
  const catIds = filtered.map((c) => c.id);
  const { data: allGoals } = await supabaseAdmin
    .from("goals")
    .select("id, category_id, metric, target, period")
    .in("category_id", catIds)
    .eq("active", true);

  const goalsByCat = new Map<string, Array<{ id: string; category_id: string; metric: string; target: number; period: string }>>();
  for (const goal of allGoals ?? []) {
    const g = goal as { id: string; category_id: string; metric: string; target: number; period: string };
    if (!goalsByCat.has(g.category_id)) goalsByCat.set(g.category_id, []);
    goalsByCat.get(g.category_id)!.push(g);
  }

  // For each category compute progress inline
  const lines: string[] = [`Progress summary (${timeframe}):`];

  for (const cat of filtered) {
    const catGoals = goalsByCat.get(cat.id) ?? [];

    if (catGoals.length === 0) {
      lines.push(`  ${cat.name}: no goals set`);
      continue;
    }

    const dailyGoals = catGoals.filter((g) => g.period === "daily");
    const weeklyGoals = catGoals.filter((g) => g.period === "weekly");

    const todayLogs: Array<{ data: unknown }> =
      dailyGoals.length > 0
        ? await (async () => {
            const { data } = await supabaseAdmin
              .from("logs")
              .select("data")
              .eq("category_id", cat.id)
              .eq("date", toISODate(normalizeDate(now)));
            return data ?? [];
          })()
        : [];

    const weekLogs: Array<{ data: unknown }> =
      weeklyGoals.length > 0
        ? await (async () => {
            const { data } = await supabaseAdmin
              .from("logs")
              .select("data")
              .eq("category_id", cat.id)
              .gte("date", toISODate(getWeekStart(now)))
              .lte("date", toISODate(getWeekEnd(now)));
            return data ?? [];
          })()
        : [];

    for (const goal of catGoals) {
      const logs = goal.period === "daily" ? todayLogs : weekLogs;
      const actual = computeActualForMetric(
        goal.metric,
        cat.type,
        logs.map((l) => l.data),
      );
      const pct = goal.target > 0 ? Math.round((actual / goal.target) * 100) : 0;
      lines.push(
        `  ${cat.name} — ${goal.metric}: ${actual}/${goal.target} (${pct}%, ${goal.period})`,
      );
    }
  }

  return { message: lines.join("\n"), data: filtered };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeActualForMetric(
  metric: string,
  categoryType: string,
  logDataArray: unknown[],
): number {
  switch (categoryType) {
    case "nutrition": {
      return logDataArray.reduce<number>((sum, raw) => {
        const entry = raw as Partial<NutritionLogData>;
        const value = (entry as Record<string, unknown>)[metric];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);
    }

    case "gym": {
      const targetBodyPart = metric.replace("_sessions", "").replace("_", " ");
      return logDataArray.reduce<number>((sum, raw) => {
        const entry = raw as Partial<GymLogData>;
        if (!entry.bodyPart) return sum;
        const normalizedBodyPart = entry.bodyPart.toLowerCase().replace(/\s+/g, "_");
        const normalizedMetric = metric.replace("_sessions", "");
        return normalizedBodyPart === normalizedMetric ||
          entry.bodyPart.toLowerCase() === targetBodyPart
          ? sum + 1
          : sum;
      }, 0);
    }

    case "running": {
      if (metric === "sessions") {
        return logDataArray.length;
      }
      return logDataArray.reduce<number>((sum, raw) => {
        const entry = raw as Partial<RunLogData>;
        const value = (entry as Record<string, unknown>)[metric];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);
    }

    case "custom": {
      return logDataArray.reduce<number>((sum, raw) => {
        const entry = raw as Record<string, unknown>;
        const v = entry["value"];
        return sum + (typeof v === "number" ? v : 0);
      }, 0);
    }

    default:
      return 0;
  }
}

// Re-export CategoryType so callers don't need a separate import
export type { CategoryType };
