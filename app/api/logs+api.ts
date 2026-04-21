import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase";
import { requireAuth } from "../../lib/auth-server";
import { generateId } from "../../lib/id";
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
// Helpers: ISO date string (YYYY-MM-DD) from a Date
// ---------------------------------------------------------------------------

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const userId = authResult;

    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    // Special aggregate endpoints
    if (type === "nutrition_summary") {
      return getNutritionSummary(url, userId);
    }
    if (type === "gym_summary") {
      return getGymSummary(url, userId);
    }
    if (type === "run_summary") {
      return getRunSummary(url, userId);
    }
    if (type === "progress") {
      return getCategoryProgressAll(url, userId);
    }

    // Standard log queries
    const categoryId = url.searchParams.get("categoryId");
    if (!categoryId) {
      return Response.json(
        { success: false, error: "Missing categoryId query param" },
        { status: 400 },
      );
    }

    const { data: category } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("user_id", userId)
      .single();

    if (!category) {
      return Response.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    const dateParam = url.searchParams.get("date");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    let logs: LogRecord[];

    if (dateParam) {
      const isoDate = toISODate(normalizeDate(new Date(dateParam)));
      const { data, error } = await supabaseAdmin
        .from("logs")
        .select("*")
        .eq("category_id", categoryId)
        .eq("date", isoDate)
        .order("created_at", { ascending: true });

      if (error) throw error;
      logs = (data ?? []) as unknown as LogRecord[];
    } else if (startDateParam && endDateParam) {
      const isoStart = toISODate(normalizeDate(new Date(startDateParam)));
      const isoEnd = toISODate(normalizeDate(new Date(endDateParam)));
      const { data, error } = await supabaseAdmin
        .from("logs")
        .select("*")
        .eq("category_id", categoryId)
        .gte("date", isoStart)
        .lte("date", isoEnd)
        .order("date", { ascending: true });

      if (error) throw error;
      logs = (data ?? []) as unknown as LogRecord[];
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
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const userId = authResult;

    const body = await request.json();

    // Batch nutrition logs path
    if (Array.isArray(body.entries)) {
      const parsed = CreateNutritionLogsSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: parsed.error.issues[0].message },
          { status: 400 },
        );
      }

      const { data: category } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("id", parsed.data.categoryId)
        .eq("user_id", userId)
        .single();

      if (!category) {
        return Response.json({ success: false, error: "Category not found" }, { status: 404 });
      }

      const isoDate = toISODate(normalizeDate(new Date(parsed.data.date)));
      const rows = parsed.data.entries.map((entry) => ({
        user_id: userId,
        category_id: parsed.data.categoryId,
        date: isoDate,
        data: entry,
      }));

      const { error } = await supabaseAdmin.from("logs").insert(rows);
      if (error) throw error;

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

    const { data: category } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("id", parsed.data.categoryId)
      .eq("user_id", userId)
      .single();

    if (!category) {
      return Response.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    const isoDate = toISODate(normalizeDate(new Date(parsed.data.date)));
    const { data: log, error } = await supabaseAdmin
      .from("logs")
      .insert({
        id: generateId(),
        user_id: userId,
        category_id: parsed.data.categoryId,
        date: isoDate,
        data: parsed.data.data,
      })
      .select()
      .single();

    if (error) throw error;

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

async function getNutritionSummary(url: URL, userId: string): Promise<Response> {
  try {
    const dateParam = url.searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();

    const { data: nutritionCategory } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "nutrition")
      .eq("active", true)
      .single();

    if (!nutritionCategory) {
      return Response.json({
        success: true,
        data: { calories: 0, protein: 0, fat: 0, carbs: 0 } satisfies NutritionDailySummary,
      });
    }

    const isoDate = toISODate(normalizeDate(date));
    const { data: logs, error } = await supabaseAdmin
      .from("logs")
      .select("data")
      .eq("category_id", nutritionCategory.id)
      .eq("date", isoDate);

    if (error) throw error;

    const totals = (logs ?? []).reduce<NutritionDailySummary>(
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

    return Response.json({ success: true, data: totals });
  } catch (err) {
    console.error("[getNutritionSummary]", err);
    return Response.json(
      { success: false, error: "Failed to compute nutrition summary" },
      { status: 500 },
    );
  }
}

async function getGymSummary(url: URL, userId: string): Promise<Response> {
  try {
    const dateParam = url.searchParams.get("date");
    const now = dateParam ? new Date(dateParam) : new Date();

    const { data: gymCategory } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "gym")
      .eq("active", true)
      .single();

    if (!gymCategory) {
      return Response.json({ success: true, data: [] as GymBodyPartCount[] });
    }

    const isoStart = toISODate(getWeekStart(now));
    const isoEnd = toISODate(getWeekEnd(now));

    const { data: logs, error } = await supabaseAdmin
      .from("logs")
      .select("data")
      .eq("category_id", gymCategory.id)
      .gte("date", isoStart)
      .lte("date", isoEnd);

    if (error) throw error;

    const counts = new Map<string, number>();
    for (const log of logs ?? []) {
      const entry = (log.data as unknown) as Partial<GymLogData>;
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

async function getRunSummary(url: URL, userId: string): Promise<Response> {
  try {
    const dateParam = url.searchParams.get("date");
    const now = dateParam ? new Date(dateParam) : new Date();

    const { data: runCategory } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "running")
      .eq("active", true)
      .single();

    if (!runCategory) {
      return Response.json({
        success: true,
        data: { totalMiles: 0, sessions: 0 } satisfies RunningSummary,
      });
    }

    const isoStart = toISODate(getWeekStart(now));
    const isoEnd = toISODate(getWeekEnd(now));

    const { data: logs, error } = await supabaseAdmin
      .from("logs")
      .select("data")
      .eq("category_id", runCategory.id)
      .gte("date", isoStart)
      .lte("date", isoEnd);

    if (error) throw error;

    const summary = (logs ?? []).reduce<RunningSummary>(
      (acc, log) => {
        const entry = (log.data as unknown) as Partial<RunLogData>;
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

async function getCategoryProgressAll(url: URL, userId: string): Promise<Response> {
  try {
    const dateParam = url.searchParams.get("date");
    const now = dateParam ? new Date(dateParam) : new Date();

    // Fetch all active categories
    const { data: categories, error: catError } = await supabaseAdmin
      .from("categories")
      .select("id, name, type")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (catError) throw catError;

    if (!categories || categories.length === 0) {
      return Response.json({ success: true, data: [] });
    }

    const categoryIds = categories.map((c: { id: string }) => c.id);

    // Fetch all active goals for these categories in one query
    const { data: allGoals, error: goalsError } = await supabaseAdmin
      .from("goals")
      .select("id, category_id, metric, target, period")
      .in("category_id", categoryIds)
      .eq("active", true);

    if (goalsError) throw goalsError;

    // Group goals by category
    const goalsByCategory = new Map<string, typeof allGoals>();
    for (const goal of allGoals ?? []) {
      const catId = (goal as { category_id: string }).category_id;
      if (!goalsByCategory.has(catId)) goalsByCategory.set(catId, []);
      goalsByCategory.get(catId)!.push(goal);
    }

    const results = await Promise.all(
      (categories as Array<{ id: string; name: string; type: string }>).map((cat) =>
        computeCategoryProgress(cat, goalsByCategory.get(cat.id) ?? [], now),
      ),
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

type GoalRow = {
  id: string;
  category_id: string;
  metric: string;
  target: number;
  period: string;
};

async function computeCategoryProgress(
  category: { id: string; name: string; type: string },
  goals: GoalRow[],
  now: Date,
): Promise<CategoryProgress> {
  if (goals.length === 0) {
    return {
      categoryId: category.id,
      categoryName: category.name,
      categoryType: category.type as CategoryProgress["categoryType"],
      goals: [],
    };
  }

  const dailyGoals = goals.filter((g) => g.period === "daily");
  const weeklyGoals = goals.filter((g) => g.period === "weekly");

  const todayLogs: Array<{ data: unknown }> =
    dailyGoals.length > 0
      ? await (async () => {
          const isoDate = toISODate(normalizeDate(now));
          const { data } = await supabaseAdmin
            .from("logs")
            .select("data")
            .eq("category_id", category.id)
            .eq("date", isoDate);
          return data ?? [];
        })()
      : [];

  const weekLogs: Array<{ data: unknown }> =
    weeklyGoals.length > 0
      ? await (async () => {
          const isoStart = toISODate(getWeekStart(now));
          const isoEnd = toISODate(getWeekEnd(now));
          const { data } = await supabaseAdmin
            .from("logs")
            .select("data")
            .eq("category_id", category.id)
            .gte("date", isoStart)
            .lte("date", isoEnd);
          return data ?? [];
        })()
      : [];

  const goalProgressList = goals.map((goal) => {
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
      // "sessions" without body part = count all gym sessions
      if (metric === "sessions") return logDataArray.length;
      const targetBodyPart = metric.replace("_sessions", "").replace(/s$/, "").replace("_", " ");
      return logDataArray.reduce<number>((sum, raw) => {
        const entry = raw as Partial<GymLogData>;
        if (!entry.bodyPart) return sum; // generic sessions don't count toward specific body-part goals
        const bp = entry.bodyPart.toLowerCase().replace(/s$/, "");
        return bp === targetBodyPart || bp.includes(targetBodyPart) || targetBodyPart.includes(bp)
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
