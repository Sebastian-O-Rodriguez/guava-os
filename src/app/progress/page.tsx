export const dynamic = "force-dynamic";

import { getOverallStreaks, getDashboardStats } from "@/actions/completions";
import type { MetricCardData } from "@/lib/types";
import { MetricCards } from "@/components/progress/metric-cards";
import { TrendChart } from "@/components/progress/trend-chart";
import { SparklineTable } from "@/components/progress/sparkline-table";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProgressPage() {
  const [streaksResult, statsResult] = await Promise.all([
    getOverallStreaks(),
    getDashboardStats(30),
  ]);

  const streaks = streaksResult.success
    ? streaksResult.data
    : { currentStreak: 0, longestStreak: 0, bestHabitName: null };

  const stats = statsResult.success
    ? statsResult.data
    : { weeklyRate: null, monthlyRate: null, trend: [], sparklines: [] };

  const metricCardData: MetricCardData = {
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    bestHabitName: streaks.bestHabitName,
    weeklyRate: stats.weeklyRate,
    monthlyRate: stats.monthlyRate,
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Progress
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Streaks, completion rates, and trends
          </p>
        </header>

        <section aria-label="Summary metrics">
          <MetricCards {...metricCardData} />
        </section>

        <section aria-label="30-day completion trend">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            30-Day Trend
          </h2>
          <TrendChart trend={stats.trend} />
        </section>

        <section aria-label="Per-habit activity">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Habits
          </h2>
          <SparklineTable sparklines={stats.sparklines} />
        </section>
      </div>
    </div>
  );
}
