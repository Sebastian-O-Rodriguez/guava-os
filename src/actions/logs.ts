"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { revalidatePath } from "next/cache";
import { normalizeDate, getWeekStart, getWeekEnd } from "@/lib/dates";
import type {
  ActionResult,
  LogData,
  NutritionLogData,
  GymLogData,
  RunLogData,
  NutritionDailySummary,
  GymBodyPartCount,
  RunningSummary,
  CategoryProgress,
  GoalPeriod,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const NutritionLogSchema = z.object({
  item: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carbs: z.number().nonnegative().optional(),
});

const GymLogSchema = z.object({
  bodyPart: z.string().min(1),
  notes: z.string().optional(),
});

const RunLogSchema = z.object({
  miles: z.number().positive(),
  duration: z.string().optional(),
  notes: z.string().optional(),
});

const CustomLogSchema = z.object({
  value: z.number(),
  notes: z.string().optional(),
});

const LogDataSchema = z.union([NutritionLogSchema, GymLogSchema, RunLogSchema, CustomLogSchema]);

const CreateLogSchema = z.object({
  categoryId: z.string().min(1),
  date: z.date(),
  data: LogDataSchema,
});

// ---------------------------------------------------------------------------
// Return shape for a log (plain object, no Prisma types to client)
// ---------------------------------------------------------------------------

type LogRecord = {
  id: string;
  categoryId: string;
  date: Date;
  data: LogData;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

export async function createLog(
  data: z.infer<typeof CreateLogSchema>,
): Promise<ActionResult<LogRecord>> {
  try {
    const parsed = CreateLogSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const userId = await getOrCreateUser();

    // Verify ownership
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId },
    });
    if (!category) {
      return { success: false, error: "Category not found" };
    }

    const log = await prisma.log.create({
      data: {
        categoryId: parsed.data.categoryId,
        date: normalizeDate(parsed.data.date),
        data: parsed.data.data as object,
      },
    });

    revalidatePath("/");
    revalidatePath("/progress");

    return { success: true, data: log as unknown as LogRecord };
  } catch (err) {
    console.error("[createLog]", err);
    return { success: false, error: "Failed to create log" };
  }
}

/**
 * Batch-create multiple nutrition entries for a single date.
 * Useful when logging a full meal or multiple food items at once.
 */
export async function createNutritionLogs(
  categoryId: string,
  date: Date,
  entries: NutritionLogData[],
): Promise<ActionResult<{ count: number }>> {
  try {
    if (entries.length === 0) {
      return { success: false, error: "No entries provided" };
    }

    const NutritionEntriesSchema = z.array(NutritionLogSchema).min(1);
    const parsed = NutritionEntriesSchema.safeParse(entries);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const userId = await getOrCreateUser();

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      return { success: false, error: "Category not found" };
    }

    const normalizedDate = normalizeDate(date);

    await prisma.log.createMany({
      data: parsed.data.map((entry) => ({
        categoryId,
        date: normalizedDate,
        data: entry as object,
      })),
    });

    revalidatePath("/");
    revalidatePath("/progress");

    return { success: true, data: { count: entries.length } };
  } catch (err) {
    console.error("[createNutritionLogs]", err);
    return { success: false, error: "Failed to create nutrition logs" };
  }
}

export async function getLogsForDate(
  categoryId: string,
  date: Date,
): Promise<ActionResult<LogRecord[]>> {
  try {
    const userId = await getOrCreateUser();

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      return { success: false, error: "Category not found" };
    }

    const normalized = normalizeDate(date);
    const logs = await prisma.log.findMany({
      where: { categoryId, date: normalized },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, data: logs as unknown as LogRecord[] };
  } catch (err) {
    console.error("[getLogsForDate]", err);
    return { success: false, error: "Failed to fetch logs" };
  }
}

export async function getLogsForDateRange(
  categoryId: string,
  startDate: Date,
  endDate: Date,
): Promise<ActionResult<LogRecord[]>> {
  try {
    const userId = await getOrCreateUser();

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      return { success: false, error: "Category not found" };
    }

    const logs = await prisma.log.findMany({
      where: {
        categoryId,
        date: {
          gte: normalizeDate(startDate),
          lte: normalizeDate(endDate),
        },
      },
      orderBy: { date: "asc" },
    });

    return { success: true, data: logs as unknown as LogRecord[] };
  } catch (err) {
    console.error("[getLogsForDateRange]", err);
    return { success: false, error: "Failed to fetch logs" };
  }
}

/**
 * Sum nutrition macros across all log entries for a given date.
 * Finds the user's nutrition category and aggregates all entries on that date.
 */
export async function getDailyNutritionSummary(
  date: Date,
): Promise<ActionResult<NutritionDailySummary>> {
  try {
    const userId = await getOrCreateUser();

    const nutritionCategory = await prisma.category.findFirst({
      where: { userId, type: "nutrition", active: true },
    });

    if (!nutritionCategory) {
      return {
        success: true,
        data: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      };
    }

    const logs = await prisma.log.findMany({
      where: {
        categoryId: nutritionCategory.id,
        date: normalizeDate(date),
      },
    });

    const totals = logs.reduce<NutritionDailySummary>(
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

    return { success: true, data: totals };
  } catch (err) {
    console.error("[getDailyNutritionSummary]", err);
    return { success: false, error: "Failed to compute nutrition summary" };
  }
}

/**
 * Count gym sessions grouped by body part for the week containing `date` (Mon–Sun).
 */
export async function getWeeklyGymSummary(date?: Date): Promise<ActionResult<GymBodyPartCount[]>> {
  try {
    const userId = await getOrCreateUser();
    const now = date ?? new Date();

    const gymCategory = await prisma.category.findFirst({
      where: { userId, type: "gym", active: true },
    });

    if (!gymCategory) {
      return { success: true, data: [] };
    }

    const logs = await prisma.log.findMany({
      where: {
        categoryId: gymCategory.id,
        date: {
          gte: getWeekStart(now),
          lte: getWeekEnd(now),
        },
      },
    });

    // Count sessions by body part in application code
    const counts = new Map<string, number>();
    for (const log of logs) {
      const entry = log.data as Partial<GymLogData>;
      const bp = entry.bodyPart ?? "unknown";
      counts.set(bp, (counts.get(bp) ?? 0) + 1);
    }

    const result: GymBodyPartCount[] = Array.from(counts.entries()).map(([bodyPart, count]) => ({
      bodyPart,
      count,
    }));

    return { success: true, data: result };
  } catch (err) {
    console.error("[getWeeklyGymSummary]", err);
    return { success: false, error: "Failed to compute gym summary" };
  }
}

/**
 * Sum miles and count running sessions for the week containing `date` (Mon–Sun).
 */
export async function getWeeklyRunningSummary(date?: Date): Promise<ActionResult<RunningSummary>> {
  try {
    const userId = await getOrCreateUser();
    const now = date ?? new Date();

    const runCategory = await prisma.category.findFirst({
      where: { userId, type: "running", active: true },
    });

    if (!runCategory) {
      return { success: true, data: { totalMiles: 0, sessions: 0 } };
    }

    const logs = await prisma.log.findMany({
      where: {
        categoryId: runCategory.id,
        date: {
          gte: getWeekStart(now),
          lte: getWeekEnd(now),
        },
      },
    });

    const summary = logs.reduce<RunningSummary>(
      (acc, log) => {
        const entry = log.data as Partial<RunLogData>;
        return {
          totalMiles: acc.totalMiles + (entry.miles ?? 0),
          sessions: acc.sessions + 1,
        };
      },
      { totalMiles: 0, sessions: 0 },
    );

    return { success: true, data: summary };
  } catch (err) {
    console.error("[getWeeklyRunningSummary]", err);
    return { success: false, error: "Failed to compute running summary" };
  }
}

/**
 * Compare a category's logs against its goals for the current period.
 * Returns goal-by-goal progress (actual vs target).
 */
export async function getCategoryProgress(
  categoryId: string,
): Promise<ActionResult<CategoryProgress>> {
  try {
    const userId = await getOrCreateUser();

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
      include: { goals: { where: { active: true } } },
    });

    if (!category) {
      return { success: false, error: "Category not found" };
    }

    const now = new Date();
    const progress = await computeCategoryProgress(category, now);

    return { success: true, data: progress };
  } catch (err) {
    console.error("[getCategoryProgress]", err);
    return { success: false, error: "Failed to compute category progress" };
  }
}

/**
 * Dashboard-ready: all active categories with their goal progress.
 */
export async function getAllCategoryProgress(
  date?: Date,
): Promise<ActionResult<CategoryProgress[]>> {
  try {
    const userId = await getOrCreateUser();

    const categories = await prisma.category.findMany({
      where: { userId, active: true },
      include: { goals: { where: { active: true } } },
      orderBy: { createdAt: "asc" },
    });

    const now = date ?? new Date();
    const results = await Promise.all(categories.map((cat) => computeCategoryProgress(cat, now)));

    return { success: true, data: results };
  } catch (err) {
    console.error("[getAllCategoryProgress]", err);
    return { success: false, error: "Failed to compute category progress" };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type CategoryWithGoals = {
  id: string;
  name: string;
  type: string;
  goals: Array<{
    id: string;
    metric: string;
    target: number;
    period: string;
  }>;
};

async function computeCategoryProgress(
  category: CategoryWithGoals,
  now: Date,
): Promise<CategoryProgress> {
  if (category.goals.length === 0) {
    return {
      categoryId: category.id,
      categoryName: category.name,
      categoryType: category.type as CategoryProgress["categoryType"],
      goals: [],
    };
  }

  // Separate goals by period to batch-fetch logs efficiently
  const dailyGoals = category.goals.filter((g) => g.period === "daily");
  const weeklyGoals = category.goals.filter((g) => g.period === "weekly");

  // Fetch logs for daily period (today only)
  const todayLogs =
    dailyGoals.length > 0
      ? await prisma.log.findMany({
          where: {
            categoryId: category.id,
            date: normalizeDate(now),
          },
        })
      : [];

  // Fetch logs for weekly period (Mon–Sun)
  const weekLogs =
    weeklyGoals.length > 0
      ? await prisma.log.findMany({
          where: {
            categoryId: category.id,
            date: {
              gte: getWeekStart(now),
              lte: getWeekEnd(now),
            },
          },
        })
      : [];

  const goalProgressList = category.goals.map((goal) => {
    const logs = goal.period === "daily" ? todayLogs : weekLogs;
    const actual = computeActualForMetric(
      goal.metric,
      category.type,
      logs.map((l) => l.data),
    );
    const percentComplete = goal.target > 0 ? Math.min(100, (actual / goal.target) * 100) : 0;

    return {
      goalId: goal.id,
      metric: goal.metric,
      target: goal.target,
      period: goal.period as GoalPeriod,
      actual,
      percentComplete,
    };
  });

  return {
    categoryId: category.id,
    categoryName: category.name,
    categoryType: category.type as CategoryProgress["categoryType"],
    goals: goalProgressList,
  };
}

/**
 * Given a metric name, category type, and an array of log data payloads,
 * compute the numeric total for that metric across the logs.
 */
function computeActualForMetric(
  metric: string,
  categoryType: string,
  logDataArray: unknown[],
): number {
  switch (categoryType) {
    case "nutrition": {
      // Nutrition metrics are summed directly from payload fields
      return logDataArray.reduce<number>((sum, raw) => {
        const entry = raw as Partial<NutritionLogData>;
        const value = (entry as Record<string, unknown>)[metric];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);
    }

    case "gym": {
      // Gym metrics are session counts per body part, e.g. "leg_sessions"
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
      // Running metrics: "miles" sums up, session counts are "sessions"
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
      // Custom metric: always sum the `value` field
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
