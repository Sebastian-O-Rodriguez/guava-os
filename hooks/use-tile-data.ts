/**
 * useTileData — fetches live goal progress and nutrition data for the home screen.
 *
 * Two API calls:
 * 1. GET /api/logs?type=progress → CategoryProgress[] (goals + actuals)
 * 2. GET /api/logs?type=nutrition_summary → NutritionDailySummary
 *
 * Returns data shaped for GoalTile and NestedDoughnut components.
 * Exposes refresh(scope?) for post-mutation re-fetching.
 *
 * === INVARIANTS (do not break) ===
 * 1. UI reflects DB truth only — no optimistic state.
 * 2. Only executed mutations trigger refresh (via onSuccess callback).
 * 3. Failed refresh never clears last known good state.
 * 4. Stale fetches never overwrite fresher data (requestId guard).
 * 5. Nutrition and goal refresh paths must stay separable (scope param).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, authFetch } from "../lib/api";
import { todayLocal } from "../lib/dates";
import type { CategoryProgress, NutritionDailySummary } from "../lib/types";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type RefreshScope = "nutrition" | "goals" | "all";

export type TileData = {
  key: string;       // goalId
  label: string;     // category name or metric display
  value: number;     // actual progress
  max: number;       // target
  unit?: string;     // display unit
  goalUnit: string;  // DB unit for structured log writes
  tapAmount?: number; // increment amount for tap
  categoryId: string;
};

export type DoughnutSegment = {
  label: string;
  value: number;
  max: number;
  unit: string;
};

export type FeedEntry = {
  id: string;
  categoryName: string;
  categoryType: string;
  label: string;
  detail: string;
  createdAt: string;
};

export type TileDataState = {
  dailyTiles: TileData[];
  weeklyTiles: TileData[];
  doughnutSegments: DoughnutSegment[];
  calorieTotal: number;
  calorieTarget: number;
  nutritionSummary: NutritionDailySummary;
  feedEntries: FeedEntry[];
  categories: Array<{ id: string; name: string; type: string }>;
  loading: boolean;
  error: string | null;
  refresh: (scope?: RefreshScope) => void;
};

// ---------------------------------------------------------------------------
// Metric display helpers
// ---------------------------------------------------------------------------

const METRIC_LABELS: Record<string, string> = {
  calories: "Cal",
  protein: "Protein",
  fat: "Fat",
  carbs: "Carbs",
  miles: "mi",
  sessions: "x",
};

function metricUnit(metric: string): string {
  return METRIC_LABELS[metric] ?? metric;
}

function tileLabel(categoryName: string, metric: string, categoryType: string): string {
  if (categoryType !== "nutrition") return categoryName;
  return metric.charAt(0).toUpperCase() + metric.slice(1);
}

function tapAmountForMetric(metric: string): number {
  if (metric === "calories") return 100;
  if (metric === "miles") return 0.5;
  if (metric.includes("sessions")) return 1;
  return 1;
}

// ---------------------------------------------------------------------------
// Data assembly (pure, no side effects)
// ---------------------------------------------------------------------------

function assembleTiles(categories: CategoryProgress[]) {
  const daily: TileData[] = [];
  const weekly: TileData[] = [];
  let calTarget = 0;

  for (const cat of categories) {
    if (cat.categoryType === "nutrition") {
      const calGoal = cat.goals.find((g) => g.metric === "calories");
      if (calGoal) calTarget = calGoal.target;
      continue;
    }

    for (const goal of cat.goals) {
      const tile: TileData = {
        key: goal.goalId,
        label: tileLabel(cat.categoryName, goal.metric, cat.categoryType),
        value: goal.actual,
        max: goal.target,
        unit: metricUnit(goal.metric),
        goalUnit: goal.unit ?? "count",
        tapAmount: tapAmountForMetric(goal.metric),
        categoryId: cat.categoryId,
      };

      if (goal.period === "daily") {
        daily.push(tile);
      } else {
        weekly.push(tile);
      }
    }
  }

  return { daily, weekly, calTarget };
}

function assembleSegments(
  categories: CategoryProgress[],
  nutrition: NutritionDailySummary,
): DoughnutSegment[] {
  const nutritionCat = categories.find((c) => c.categoryType === "nutrition");
  const segments: DoughnutSegment[] = [];

  if (nutritionCat) {
    for (const goal of nutritionCat.goals) {
      if (goal.metric === "calories") continue;
      segments.push({
        label: goal.metric.charAt(0).toUpperCase() + goal.metric.slice(1),
        value: goal.actual,
        max: goal.target,
        unit: "g",
      });
    }
  }

  // Fallback: always show macro segments (defaults if no goals)
  if (segments.length === 0) {
    segments.push(
      { label: "Protein", value: nutrition.protein, max: 180, unit: "g" },
      { label: "Fat", value: nutrition.fat, max: 80, unit: "g" },
      { label: "Carbs", value: nutrition.carbs, max: 300, unit: "g" },
    );
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTileData(): TileDataState {
  const [dailyTiles, setDailyTiles] = useState<TileData[]>([]);
  const [weeklyTiles, setWeeklyTiles] = useState<TileData[]>([]);
  const [doughnutSegments, setDoughnutSegments] = useState<DoughnutSegment[]>([]);
  const [calorieTotal, setCalorieTotal] = useState(0);
  const [calorieTarget, setCalorieTarget] = useState(0);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionDailySummary>({
    calories: 0, protein: 0, fat: 0, carbs: 0,
  });
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Race condition guard: incrementing counter, stale responses discarded
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async (_scope: RefreshScope = "all") => {
    const thisRequestId = ++requestIdRef.current;

    // Only show loading spinner on initial load, not refreshes
    const isInitial = dailyTiles.length === 0 && weeklyTiles.length === 0;
    if (isInitial) setLoading(true);

    // Clear error for this attempt but keep previous data visible
    setError(null);

    try {
      const today = todayLocal();

      // TODO: when scope !== "all", fetch only the needed endpoint.
      // For now, always fetch both (correct, slightly over-fetches).
      const [progressRes, nutritionRes, feedRes] = await Promise.all([
        authFetch(`${API_BASE}/api/logs?type=progress&date=${today}`),
        authFetch(`${API_BASE}/api/logs?type=nutrition_summary&date=${today}`),
        authFetch(`${API_BASE}/api/logs?type=today_feed&date=${today}`),
      ]);

      // Stale response guard
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

      if (!progressRes.ok || !nutritionRes.ok || !feedRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const progressData = await progressRes.json();
      const nutritionData = await nutritionRes.json();
      const feedData = await feedRes.json();

      // Stale response guard (after async JSON parse)
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

      const categories: CategoryProgress[] = progressData.data ?? [];
      const nutrition: NutritionDailySummary = nutritionData.data ?? {
        calories: 0, protein: 0, fat: 0, carbs: 0,
      };

      const { daily, weekly, calTarget } = assembleTiles(categories);
      const segments = assembleSegments(categories, nutrition);

      setDailyTiles(daily);
      setWeeklyTiles(weekly);
      setDoughnutSegments(segments);
      setCalorieTotal(nutrition.calories);
      setCalorieTarget(calTarget || 2500);
      setNutritionSummary(nutrition);
      setFeedEntries((feedData.data ?? []) as FeedEntry[]);
      setCategories(
        categories.map((c) => ({
          id: c.categoryId,
          name: c.categoryName,
          type: c.categoryType,
        })),
      );
      setError(null);
    } catch (err) {
      // Stale guard
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      console.error("[useTileData]", err);
      // Set error but do NOT clear previous good data
      setError("Couldn't load data");
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData("all");
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  const refresh = useCallback(
    (scope: RefreshScope = "all") => {
      fetchData(scope);
    },
    [fetchData],
  );

  return {
    dailyTiles,
    weeklyTiles,
    doughnutSegments,
    calorieTotal,
    calorieTarget,
    nutritionSummary,
    feedEntries,
    categories,
    loading,
    error,
    refresh,
  };
}
