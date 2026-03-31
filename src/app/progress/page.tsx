export const dynamic = "force-dynamic";

import {
  getAllCategoryProgress,
  getWeeklyGymSummary,
  getWeeklyRunningSummary,
} from "@/actions/logs";
import type { CategoryProgress } from "@/lib/types";
import { AppNav } from "@/components/app-nav";

function pctColor(pct: number): string {
  if (pct >= 100) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  return "text-muted-foreground";
}

function ProgressRow({
  cat,
  goal,
}: {
  cat: CategoryProgress;
  goal: CategoryProgress["goals"][number];
}) {
  const pct = Math.round(goal.percentComplete);
  const displayActual = Number.isInteger(goal.actual) ? goal.actual : goal.actual.toFixed(1);
  const displayTarget = Number.isInteger(goal.target) ? goal.target : goal.target.toFixed(1);

  return (
    <tr className="border-b border-zinc-800/60 last:border-0">
      <td className="py-3 pr-4 text-sm text-muted-foreground">{cat.categoryName}</td>
      <td className="py-3 pr-4 text-sm text-foreground capitalize">
        {goal.metric.replace(/_/g, " ")}
      </td>
      <td className="py-3 pr-4 text-xs text-muted-foreground capitalize">{goal.period}</td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 rounded-full bg-zinc-800 shrink-0">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span className={`text-sm font-medium tabular-nums ${pctColor(pct)}`}>
            {displayActual}/{displayTarget}
          </span>
        </div>
      </td>
    </tr>
  );
}

export default async function ProgressPage() {
  const [progressResult, gymResult, runResult] = await Promise.all([
    getAllCategoryProgress(),
    getWeeklyGymSummary(),
    getWeeklyRunningSummary(),
  ]);

  const allProgress = progressResult.success ? progressResult.data : [];
  const gymSummary = gymResult.success ? gymResult.data : [];
  const runningSummary = runResult.success ? runResult.data : { totalMiles: 0, sessions: 0 };

  const gymProgress = allProgress.find((p) => p.categoryType === "gym");
  const runProgress = allProgress.find((p) => p.categoryType === "running");

  const gymGoalsMet = gymProgress?.goals.filter((g) => g.percentComplete >= 100).length ?? 0;
  const gymGoalsTotal = gymProgress?.goals.length ?? 0;

  const runMilesGoal = runProgress?.goals.find((g) => g.metric === "miles");

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      <AppNav />
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Goal completion across all categories
          </p>
        </header>

        {(gymGoalsTotal > 0 || runningSummary.sessions > 0) && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Weekly Overview
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {gymGoalsTotal > 0 && (
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Gym
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {gymGoalsMet}
                    <span className="text-base font-normal text-muted-foreground">
                      /{gymGoalsTotal}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">goals met</p>
                </div>
              )}

              {gymSummary.length > 0 && (
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Body Parts
                  </p>
                  <p className="text-2xl font-bold text-foreground">{gymSummary.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">trained this week</p>
                </div>
              )}

              {(runningSummary.sessions > 0 || runMilesGoal) && (
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Running
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {runningSummary.totalMiles.toFixed(1)}
                    {runMilesGoal && (
                      <span className="text-base font-normal text-muted-foreground">
                        /{runMilesGoal.target} mi
                      </span>
                    )}
                    {!runMilesGoal && (
                      <span className="text-base font-normal text-muted-foreground"> mi</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {runningSummary.sessions} session{runningSummary.sessions !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            All Goals
          </h2>

          {allProgress.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No goals configured yet.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Category
                    </th>
                    <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Metric
                    </th>
                    <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Period
                    </th>
                    <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  {allProgress.flatMap((cat) =>
                    cat.goals.length === 0
                      ? []
                      : cat.goals.map((goal) => (
                          <ProgressRow key={goal.goalId} cat={cat} goal={goal} />
                        )),
                  )}
                  {allProgress.every((c) => c.goals.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        No goals configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
