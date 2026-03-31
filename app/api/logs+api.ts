import { z } from "zod";
import { prisma } from "../../lib/db";
import { getOrCreateUser } from "../../lib/user";
import { normalizeDate, getWeekStart, getWeekEnd } from "../../lib/dates";
import type {
  LogData,
  NutritionLogData,
  GymLogData,
  RunLogData,
  NutritionDailySummary,
  GymBodyPartCount,
  RunningSummary,
  CategoryProgress,
  GoalPeriod,
} from "../../lib/types";

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
  date: z.string(), // ISO date string from request body
  data: LogDataSchema,
});

const CreateNutritionLogsSchema = z.object({
  categoryId: z.string().min(1),
  date: z.string(),
  entries: z.array(NutritionLogSchema).min(1),
});

// ---------------------------------------------------------------------------
// Return shape for a log
// ---------------------------------------------------------------------------

type LogRecord = {
  id: string;
  categoryId: string;
  date: Date;
  data: LogData;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// GET /api/logs — query logs with filters
//   ?categoryId=<id>&date=<YYYY-MM-DD>        → logs for category on date
//   ?categoryId=<id>&startDate=<>&endDate=<>  → logs for date range
//   ?type=nutrition_summary&date=<>           → daily nutrition totals
//   ?type=gym_summary                         → weekly gym body-part counts
//   ?type=run_summary                         → weekly running totals
//   ?type=progress                            → all category progress
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    // Special aggregate endpoints
    if (type === "nutrition_summary") {
      return getNutritionSummary(url);
    }
    if (type === "gym_summary") {
      return getGymSummary(url);
    }
    if (type === "run_summary") {
      return getRunSummary(url);
    }
    if (type === "progress") {
      return getCategoryProgressAll(url);
    }

    // Standard log queries
    const categoryId = url.searchParams.get("categoryId");
    if (!categoryId) {
      return Response.json(
        { success: false, error: "Missing categoryId query param" },
        { status: 400 },
      );
    }

    const userId = await getOrCreateUser();
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      return Response.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    const dateParam = url.searchParams.get("date");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    let logs: LogRecord[];

    if (dateParam) {
      const normalized = normalizeDate(new Date(dateParam));
      logs = (await prisma.log.findMany({
        where: { categoryId, date: normalized },
        orderBy: { createdAt: "asc" },
      })) as unknown as LogRecord[];
    } else if (startDateParam && endDateParam) {
      logs = (await prisma.log.findMany({
        where: {
          categoryId,
          date: {
            gte: normalizeDate(new Date(startDateParam)),
            lte: normalizeDate(new Date(endDateParam)),
          },
        },
        orderBy: { date: "asc" },
      })) as unknown as LogRecord[];
    } else {
      return Response.json(
        { success: false, error: "Provide date or startDate+endDate params" },
        { status: 400 },
      );
    }

    return Response.json({ success: true, data: logs });
  } catch (err) {
    console.error("[GET /api/logs]", err);
    return Response.json({ success: false, error: "Failed to fetch logs" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/logs — create log entries
//   body: CreateLogSchema → single log
//   body: CreateNutritionLogsSchema (with entries[]) → batch nutrition logs
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const userId = await getOrCreateUser();

    // Batch nutrition logs path
    if (Array.isArray(body.entries)) {
      const parsed = CreateNutritionLogsSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: parsed.error.issues[0].message },
          { status: 400 },
        );
      }

      const category = await prisma.category.findFirst({
        where: { id: parsed.data.categoryId, userId },
      });
      if (!category) {
        return Response.json({ success: false, error: "Category not found" }, { status: 404 });
      }

      const normalizedDate = normalizeDate(new Date(parsed.data.date));
      await prisma.log.createMany({
        data: parsed.data.entries.map((entry) => ({
          categoryId: parsed.data.categoryId,
          date: normalizedDate,
          data: entry as object,
        })),
      });

      return Response.json(
        { success: true, data: { count: parsed.data.entries.length } },
        { status: 201 },
      );
    }

    // Single log path
    const parsed = CreateLogSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId },
    });
    if (!category) {
      return Response.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    const log = await prisma.log.create({
      data: {
        categoryId: parsed.data.categoryId,
        date: normalizeDate(new Date(parsed.data.date)),
        data: parsed.data.data as object,
      },
    });

    return Response.json(
      { success: true, data: log as unknown as LogRecord },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/logs]", err);
    return Response.json({ success: false, error: "Failed to create log" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Aggregate helpers (called from GET based on ?type=)
// ---------------------------------------------------------------------------

async function getNutritionSummary(url: URL): Promise<Response> {
  try {
    const userId = await getOrCreateUser();
    const dateParam = url.searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();

    const nutritionCategory = await prisma.category.findFirst({
      where: { userId, type: "nutrition", active: true },
    });

    if (!nutritionCategory) {
      return Response.json({
        success: true,
        data: { calories: 0, protein: 0, fat: 0, carbs: 0 } satisfies NutritionDailySummary,
      });
    }

    const logs = await prisma.log.findMany({
      where: { categoryId: nutritionCategory.id, date: normalizeDate(date) },
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

    return Response.json({ success: true, data: totals });
  } catch (err) {
    console.error("[getNutritionSummary]", err);
    return Response.json(
      { success: false, error: "Failed to compute nutrition summary" },
      { status: 500 },
    );
  }
}

async function getGymSummary(url: URL): Promise<Response> {
  try {
    const userId = await getOrCreateUser();
    const dateParam = url.searchParams.get("date");
    const now = dateParam ? new Date(dateParam) : new Date();

    const gymCategory = await prisma.category.findFirst({
      where: { userId, type: "gym", active: true },
    });

    if (!gymCategory) {
      return Response.json({ success: true, data: [] as GymBodyPartCount[] });
    }

    const logs = await prisma.log.findMany({
      where: {
        categoryId: gymCategory.id,
        date: { gte: getWeekStart(now), lte: getWeekEnd(now) },
      },
    });

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

    return Response.json({ success: true, data: result });
  } catch (err) {
    console.error("[getGymSummary]", err);
    return Response.json(
      { success: false, error: "Failed to compute gym summary" },
      { status: 500 },
    );
  }
}

async function getRunSummary(url: URL): Promise<Response> {
  try {
    const userId = await getOrCreateUser();
    const dateParam = url.searchParams.get("date");
    const now = dateParam ? new Date(dateParam) : new Date();

    const runCategory = await prisma.category.findFirst({
      where: { userId, type: "running", active: true },
    });

    if (!runCategory) {
      return Response.json({
        success: true,
        data: { totalMiles: 0, sessions: 0 } satisfies RunningSummary,
      });
    }

    const logs = await prisma.log.findMany({
      where: {
        categoryId: runCategory.id,
        date: { gte: getWeekStart(now), lte: getWeekEnd(now) },
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

    return Response.json({ success: true, data: summary });
  } catch (err) {
    console.error("[getRunSummary]", err);
    return Response.json(
      { success: false, error: "Failed to compute running summary" },
      { status: 500 },
    );
  }
}

async function getCategoryProgressAll(url: URL): Promise<Response> {
  try {
    const userId = await getOrCreateUser();
    const dateParam = url.searchParams.get("date");
    const now = dateParam ? new Date(dateParam) : new Date();

    const categories = await prisma.category.findMany({
      where: { userId, active: true },
      include: { goals: { where: { active: true } } },
      orderBy: { createdAt: "asc" },
    });

    const results = await Promise.all(
      categories.map((cat) => computeCategoryProgress(cat, now)),
    );

    return Response.json({ success: true, data: results });
  } catch (err) {
    console.error("[getCategoryProgressAll]", err);
    return Response.json(
      { success: false, error: "Failed to compute category progress" },
      { status: 500 },
    );
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

  const dailyGoals = category.goals.filter((g) => g.period === "daily");
  const weeklyGoals = category.goals.filter((g) => g.period === "weekly");

  const todayLogs =
    dailyGoals.length > 0
      ? await prisma.log.findMany({
          where: { categoryId: category.id, date: normalizeDate(now) },
        })
      : [];

  const weekLogs =
    weeklyGoals.length > 0
      ? await prisma.log.findMany({
          where: {
            categoryId: category.id,
            date: { gte: getWeekStart(now), lte: getWeekEnd(now) },
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
