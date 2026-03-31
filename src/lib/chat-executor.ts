import {
  createNutritionLogs,
  createLog,
  getDailyNutritionSummary,
  getWeeklyGymSummary,
  getWeeklyRunningSummary,
  getAllCategoryProgress,
} from "@/actions/logs";
import { upsertGoal } from "@/actions/goals";
import { createCategory, getCategories } from "@/actions/categories";
import {
  logNutritionParamsSchema,
  logGymParamsSchema,
  logRunParamsSchema,
  setGoalParamsSchema,
  addCategoryParamsSchema,
  queryProgressParamsSchema,
} from "@/lib/chat-scenarios";
import { normalizeDate } from "@/lib/dates";
import type { CategoryType } from "@/lib/types";

export type ExecutorResult = { message: string; data?: unknown };

/**
 * Deterministic executor: maps a classified scenario + raw params to server
 * action calls and returns a template response. No LLM is involved here.
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

  // Find or create the nutrition category
  const categoryId = await findOrCreateCategoryId("nutrition", "Nutrition");
  if (!categoryId) {
    return { message: "Failed to find or create your Nutrition category." };
  }

  const today = normalizeDate(new Date());
  const result = await createNutritionLogs(categoryId, today, parsed.data.entries);

  if (!result.success) {
    return { message: `Failed to log nutrition: ${result.error}` };
  }

  // Fetch updated daily totals for the response template
  const summaryResult = await getDailyNutritionSummary(today);
  if (!summaryResult.success) {
    return {
      message: `Logged ${parsed.data.entries.length} item(s). Could not fetch daily totals.`,
      data: result.data,
    };
  }

  const { calories, protein, fat, carbs } = summaryResult.data;
  const n = parsed.data.entries.length;
  return {
    message: `Logged ${n} item${n === 1 ? "" : "s"}. Today's totals: ${calories} cal, ${protein}g protein, ${fat}g fat${carbs ? `, ${carbs}g carbs` : ""}.`,
    data: summaryResult.data,
  };
}

async function handleLogGym(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = logGymParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      message: `Could not log gym session — ${parsed.error.issues[0].message}`,
    };
  }

  const categoryId = await findOrCreateCategoryId("gym", "Gym");
  if (!categoryId) {
    return { message: "Failed to find or create your Gym category." };
  }

  const normalizedBodyPart = parsed.data.bodyPart.toLowerCase();
  const today = normalizeDate(new Date());

  const result = await createLog({
    categoryId,
    date: today,
    data: {
      bodyPart: normalizedBodyPart,
      notes: parsed.data.notes,
    },
  });

  if (!result.success) {
    return { message: `Failed to log gym session: ${result.error}` };
  }

  // Fetch weekly summary for the response template
  const summaryResult = await getWeeklyGymSummary();
  const summaryText =
    summaryResult.success && summaryResult.data.length > 0
      ? summaryResult.data.map((b) => `${b.bodyPart} ×${b.count}`).join(", ")
      : "no sessions yet this week";

  return {
    message: `Logged ${normalizedBodyPart} session. This week: ${summaryText}.`,
    data: result.data,
  };
}

async function handleLogRun(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = logRunParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      message: `Could not log run — ${parsed.error.issues[0].message}`,
    };
  }

  const categoryId = await findOrCreateCategoryId("running", "Running");
  if (!categoryId) {
    return { message: "Failed to find or create your Running category." };
  }

  const safeMiles = Math.min(Math.max(parsed.data.miles, 0), 1_000);
  const today = normalizeDate(new Date());
  const result = await createLog({
    categoryId,
    date: today,
    data: {
      miles: safeMiles,
      duration: parsed.data.duration,
      notes: parsed.data.notes,
    },
  });

  if (!result.success) {
    return { message: `Failed to log run: ${result.error}` };
  }

  // Fetch weekly running summary
  const summaryResult = await getWeeklyRunningSummary();
  if (!summaryResult.success) {
    return {
      message: `Logged ${safeMiles} mi run.`,
      data: result.data,
    };
  }

  const { totalMiles } = summaryResult.data;
  // Try to find any weekly miles goal to display progress toward
  const progressResult = await getAllCategoryProgress();
  let goalMilesText = "";
  if (progressResult.success) {
    for (const cat of progressResult.data) {
      if (cat.categoryType === "running") {
        const milesGoal = cat.goals.find((g) => g.metric === "miles");
        if (milesGoal) {
          goalMilesText = `/${milesGoal.target}`;
        }
      }
    }
  }

  return {
    message: `Logged ${safeMiles} mi run. This week: ${totalMiles}${goalMilesText} mi.`,
    data: result.data,
  };
}

async function handleSetGoal(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = setGoalParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      message: `Could not set goal — ${parsed.error.issues[0].message}`,
    };
  }

  // Resolve category by name or type
  const categoryId = await resolveCategoryId(parsed.data.categoryName);
  if (!categoryId) {
    return {
      message: `Could not find a category named "${parsed.data.categoryName}". Try creating it first.`,
    };
  }

  const safeTarget = Math.min(Math.max(parsed.data.target, 0), 100_000);

  const result = await upsertGoal({
    categoryId,
    metric: parsed.data.metric,
    target: safeTarget,
    period: parsed.data.period,
  });

  if (!result.success) {
    return { message: `Failed to set goal: ${result.error}` };
  }

  return {
    message: `Set ${parsed.data.metric} goal to ${safeTarget} (${parsed.data.period}).`,
    data: result.data,
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

  const result = await createCategory({
    name: safeName,
    type: parsed.data.type ?? "custom",
  });

  if (!result.success) {
    return { message: `Failed to create category: ${result.error}` };
  }

  return {
    message: `Created '${safeName}' category.`,
    data: result.data,
  };
}

async function handleQueryProgress(raw: Record<string, unknown>): Promise<ExecutorResult> {
  const parsed = queryProgressParamsSchema.safeParse(raw);
  // params are all optional so this should always succeed, but be safe
  const timeframe = parsed.success ? (parsed.data.timeframe ?? "week") : "week";
  const filterCategory = parsed.success ? parsed.data.category : undefined;

  const result = await getAllCategoryProgress();
  if (!result.success) {
    return { message: "Could not fetch progress data at this time." };
  }

  if (result.data.length === 0) {
    return {
      message:
        "No categories set up yet. Add a category and some goals to start tracking progress.",
    };
  }

  // Filter by category name if provided
  const categories = filterCategory
    ? result.data.filter((c) => c.categoryName.toLowerCase().includes(filterCategory.toLowerCase()))
    : result.data;

  if (categories.length === 0) {
    return {
      message: `No category found matching "${filterCategory}".`,
    };
  }

  // Build a text summary of goal progress
  const lines: string[] = [`Progress summary (${timeframe}):`];
  for (const cat of categories) {
    if (cat.goals.length === 0) {
      lines.push(`  ${cat.categoryName}: no goals set`);
      continue;
    }
    for (const goal of cat.goals) {
      const pct = Math.round(goal.percentComplete);
      lines.push(
        `  ${cat.categoryName} — ${goal.metric}: ${goal.actual}/${goal.target} (${pct}%, ${goal.period})`,
      );
    }
  }

  return {
    message: lines.join("\n"),
    data: categories,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Look up a category by type. If none exists, auto-create one with the given
 * display name. Returns the category ID or null on failure.
 */
async function findOrCreateCategoryId(
  type: CategoryType,
  displayName: string,
): Promise<string | null> {
  const existing = await getCategories();
  if (!existing.success) return null;

  const found = existing.data.find((c) => c.type === type);
  if (found) return found.id;

  // Auto-create
  const created = await createCategory({ name: displayName, type });
  if (!created.success) return null;
  return created.data.id;
}

/**
 * Resolve a category by fuzzy name or type match. Returns the category ID or
 * null if nothing matches.
 */
async function resolveCategoryId(nameOrType: string): Promise<string | null> {
  const existing = await getCategories();
  if (!existing.success) return null;

  const lower = nameOrType.toLowerCase();

  // Exact type match first
  const byType = existing.data.find((c) => c.type === lower);
  if (byType) return byType.id;

  // Fuzzy name match
  const byName = existing.data.find((c) => c.name.toLowerCase().includes(lower));
  return byName?.id ?? null;
}
