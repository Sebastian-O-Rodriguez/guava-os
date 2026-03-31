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
import { prisma } from "./db";
import { getOrCreateUser } from "./user";

export type ExecutorResult = { message: string; data?: unknown };

/**
 * Deterministic executor: maps a classified scenario + raw params to Prisma
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
  const nutritionCat = await prisma.category.findFirst({
    where: { userId, type: "nutrition", active: true },
  });
  if (!nutritionCat) {
    return { message: "Failed to find or create your Nutrition category." };
  }

  const today = normalizeDate(new Date());

  try {
    await prisma.log.createMany({
      data: parsed.data.entries.map((entry) => ({
        categoryId: nutritionCat.id,
        date: today,
        data: entry as object,
      })),
    });
  } catch (err) {
    console.error("[handleLogNutrition]", err);
    return { message: "Failed to log nutrition entries." };
  }

  // Fetch updated daily totals for the response template
  const logs = await prisma.log.findMany({
    where: { categoryId: nutritionCat.id, date: today },
  });

  const totals = logs.reduce(
    (acc, log) => {
      const entry = log.data as Partial<NutritionLogData>;
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
  const gymCat = await prisma.category.findFirst({
    where: { userId, type: "gym", active: true },
  });
  if (!gymCat) {
    return { message: "Failed to find or create your Gym category." };
  }

  const normalizedBodyPart = parsed.data.bodyPart.toLowerCase();
  const today = normalizeDate(new Date());

  try {
    await prisma.log.create({
      data: {
        categoryId: gymCat.id,
        date: today,
        data: { bodyPart: normalizedBodyPart, notes: parsed.data.notes } as object,
      },
    });
  } catch (err) {
    console.error("[handleLogGym]", err);
    return { message: "Failed to log gym session." };
  }

  // Fetch weekly summary
  const weekLogs = await prisma.log.findMany({
    where: {
      categoryId: gymCat.id,
      date: { gte: getWeekStart(new Date()), lte: getWeekEnd(new Date()) },
    },
  });

  const counts = new Map<string, number>();
  for (const log of weekLogs) {
    const entry = log.data as Partial<GymLogData>;
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
  const runCat = await prisma.category.findFirst({
    where: { userId, type: "running", active: true },
  });
  if (!runCat) {
    return { message: "Failed to find or create your Running category." };
  }

  const safeMiles = Math.min(Math.max(parsed.data.miles, 0), 1_000);
  const today = normalizeDate(new Date());

  try {
    await prisma.log.create({
      data: {
        categoryId: runCat.id,
        date: today,
        data: { miles: safeMiles, duration: parsed.data.duration, notes: parsed.data.notes } as object,
      },
    });
  } catch (err) {
    console.error("[handleLogRun]", err);
    return { message: "Failed to log run." };
  }

  // Fetch weekly running summary
  const weekLogs = await prisma.log.findMany({
    where: {
      categoryId: runCat.id,
      date: { gte: getWeekStart(new Date()), lte: getWeekEnd(new Date()) },
    },
  });

  const totalMiles = weekLogs.reduce((sum, log) => {
    const entry = log.data as Partial<RunLogData>;
    return sum + (entry.miles ?? 0);
  }, 0);

  // Try to find weekly miles goal
  const milesGoal = await prisma.goal.findFirst({
    where: { categoryId: runCat.id, metric: "miles", active: true },
  });

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
  const categories = await prisma.category.findMany({ where: { userId, active: true } });
  const lower = parsed.data.categoryName.toLowerCase();
  const category =
    categories.find((c) => c.type === lower) ??
    categories.find((c) => c.name.toLowerCase().includes(lower));

  if (!category) {
    return {
      message: `Could not find a category named "${parsed.data.categoryName}". Try creating it first.`,
    };
  }

  const safeTarget = Math.min(Math.max(parsed.data.target, 0), 100_000);

  const existing = await prisma.goal.findFirst({
    where: { categoryId: category.id, metric: parsed.data.metric, active: true },
  });

  let goal;
  if (existing) {
    goal = await prisma.goal.update({
      where: { id: existing.id },
      data: { target: safeTarget, period: parsed.data.period },
    });
  } else {
    goal = await prisma.goal.create({
      data: {
        categoryId: category.id,
        metric: parsed.data.metric,
        target: safeTarget,
        period: parsed.data.period,
      },
    });
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
    const category = await prisma.category.create({
      data: {
        userId,
        name: safeName,
        type: parsed.data.type ?? "custom",
      },
    });

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

  const categories = await prisma.category.findMany({
    where: { userId, active: true },
    include: { goals: { where: { active: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (categories.length === 0) {
    return {
      message:
        "No categories set up yet. Add a category and some goals to start tracking progress.",
    };
  }

  const filtered = filterCategory
    ? categories.filter((c) => c.name.toLowerCase().includes(filterCategory.toLowerCase()))
    : categories;

  if (filtered.length === 0) {
    return { message: `No category found matching "${filterCategory}".` };
  }

  // For each category compute progress inline
  const lines: string[] = [`Progress summary (${timeframe}):`];

  for (const cat of filtered) {
    if (cat.goals.length === 0) {
      lines.push(`  ${cat.name}: no goals set`);
      continue;
    }

    const dailyGoals = cat.goals.filter((g) => g.period === "daily");
    const weeklyGoals = cat.goals.filter((g) => g.period === "weekly");

    const todayLogs =
      dailyGoals.length > 0
        ? await prisma.log.findMany({
            where: { categoryId: cat.id, date: normalizeDate(now) },
          })
        : [];

    const weekLogs =
      weeklyGoals.length > 0
        ? await prisma.log.findMany({
            where: {
              categoryId: cat.id,
              date: { gte: getWeekStart(now), lte: getWeekEnd(now) },
            },
          })
        : [];

    for (const goal of cat.goals) {
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
