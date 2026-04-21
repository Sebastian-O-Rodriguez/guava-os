import type { ScriptResult } from "../types";
import type { NormalizedInput } from "../../chat-normalizer";
import type { NutritionLogData, GymLogData, RunLogData } from "../../types";
import {
  supabaseAdmin,
  fetchLogs,
  todayISO,
  weekStartISO,
  weekEndISO,
} from "../helpers";
import { normalizeDate, getWeekStart, getWeekEnd } from "../../dates";

type ProgressLine = {
  category: string;
  metric: string;
  actual: number;
  target: number;
  period: string;
  percent: number;
};

type ProgressResult = { lines: ProgressLine[]; timeframe: string };

/**
 * Query progress across all categories. Read-only — no mutations.
 */
export async function queryProgress(
  input: NormalizedInput,
): Promise<ScriptResult<ProgressResult>> {
  const timeframe = (input.params.timeframe as string) ?? "today";
  const filterCategory = input.params.category as string | undefined;
  const userId = input.userId;

  const { data: categories } = await supabaseAdmin
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (!categories || categories.length === 0) {
    return {
      success: true,
      summary: "No categories set up yet. Add a category and goals to start tracking.",
      data: { lines: [], timeframe },
    };
  }

  const catList = categories as Array<{ id: string; name: string; type: string }>;
  const filtered = filterCategory
    ? catList.filter((c) => c.name.toLowerCase().includes(filterCategory.toLowerCase()))
    : catList;

  if (filtered.length === 0) {
    return {
      success: true,
      summary: `No category matching "${filterCategory}".`,
      data: { lines: [], timeframe },
    };
  }

  // Batch fetch all goals for filtered categories
  const catIds = filtered.map((c) => c.id);
  const { data: allGoals } = await supabaseAdmin
    .from("goals")
    .select("id, category_id, metric, target, period")
    .in("category_id", catIds)
    .eq("active", true);

  const goalsByCat = new Map<
    string,
    Array<{ id: string; category_id: string; metric: string; target: number; period: string }>
  >();
  for (const goal of allGoals ?? []) {
    const g = goal as { id: string; category_id: string; metric: string; target: number; period: string };
    if (!goalsByCat.has(g.category_id)) goalsByCat.set(g.category_id, []);
    goalsByCat.get(g.category_id)!.push(g);
  }

  const lines: ProgressLine[] = [];
  const textLines: string[] = [];

  for (const cat of filtered) {
    const catGoals = goalsByCat.get(cat.id) ?? [];
    if (catGoals.length === 0) {
      textLines.push(`${cat.name}: no goals set`);
      continue;
    }

    const dailyGoals = catGoals.filter((g) => g.period === "daily");
    const weeklyGoals = catGoals.filter((g) => g.period === "weekly");

    const today = todayISO();
    const todayLogs = dailyGoals.length > 0
      ? await fetchLogs(cat.id, today, today)
      : [];
    const weekLogs = weeklyGoals.length > 0
      ? await fetchLogs(cat.id, weekStartISO(), weekEndISO())
      : [];

    for (const goal of catGoals) {
      const logs = goal.period === "daily" ? todayLogs : weekLogs;
      const actual = computeActual(goal.metric, cat.type, logs.map((l) => l.data));
      const pct = goal.target > 0 ? Math.round((actual / goal.target) * 100) : 0;

      lines.push({
        category: cat.name,
        metric: goal.metric,
        actual,
        target: goal.target,
        period: goal.period,
        percent: pct,
      });

      textLines.push(`${cat.name} — ${goal.metric}: ${actual}/${goal.target} (${pct}%, ${goal.period})`);
    }
  }

  return {
    success: true,
    summary: textLines.join("\n"),
    data: { lines, timeframe },
  };
}

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

function computeActual(metric: string, categoryType: string, logData: unknown[]): number {
  switch (categoryType) {
    case "nutrition":
      return logData.reduce<number>((sum, raw) => {
        const d = raw as Record<string, unknown>;
        const v = d[metric];
        return sum + (typeof v === "number" ? v : 0);
      }, 0);

    case "gym":
      if (metric === "sessions") return logData.length;
      if (metric.endsWith("_sessions")) {
        const targetPart = metric.replace("_sessions", "").replace(/s$/, "").replace("_", " ");
        return logData.reduce<number>((sum, raw) => {
          const d = raw as Partial<GymLogData>;
          if (!d.bodyPart) return sum; // generic sessions don't count toward specific body-part goals
          const bp = d.bodyPart.toLowerCase().replace(/s$/, "");
          return bp === targetPart || bp.includes(targetPart) || targetPart.includes(bp)
            ? sum + 1
            : sum;
        }, 0);
      }
      return logData.length;

    case "running":
      if (metric === "sessions") return logData.length;
      return logData.reduce<number>((sum, raw) => {
        const d = raw as Record<string, unknown>;
        const v = d[metric];
        return sum + (typeof v === "number" ? v : 0);
      }, 0);

    case "custom":
      return logData.reduce<number>((sum, raw) => {
        const d = raw as Record<string, unknown>;
        const v = d["value"];
        return sum + (typeof v === "number" ? v : 0);
      }, 0);

    default:
      return 0;
  }
}
