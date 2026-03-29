"use client";

import type { NutritionDailySummary, GoalProgress, NutritionLogData } from "@/lib/types";
import { ProgressBar } from "./progress-bar";

type NutritionCardProps = {
  summary: NutritionDailySummary;
  goals: GoalProgress[];
  logItems: NutritionLogData[];
};

function getGoalTarget(goals: GoalProgress[], metric: string): number {
  return goals.find((g) => g.metric === metric)?.target ?? 0;
}

export function NutritionCard({ summary, goals, logItems }: NutritionCardProps) {
  const calTarget = getGoalTarget(goals, "calories");
  const proteinTarget = getGoalTarget(goals, "protein");
  const fatTarget = getGoalTarget(goals, "fat");

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥗</span>
          <h2 className="font-semibold text-foreground">Nutrition</h2>
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Daily
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {calTarget > 0 && (
          <ProgressBar
            value={summary.calories}
            max={calTarget}
            label="Calories"
            unit="kcal"
          />
        )}
        {proteinTarget > 0 && (
          <ProgressBar
            value={summary.protein}
            max={proteinTarget}
            label="Protein"
            unit="g"
            color="blue"
          />
        )}
        {fatTarget > 0 && (
          <ProgressBar
            value={summary.fat}
            max={fatTarget}
            label="Fat"
            unit="g"
            color="amber"
          />
        )}
        {calTarget === 0 && proteinTarget === 0 && fatTarget === 0 && (
          <p className="text-sm text-muted-foreground">No nutrition goals set.</p>
        )}
      </div>

      {logItems.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-zinc-800/60 pt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Today&apos;s log
          </p>
          <ul className="flex flex-col gap-1">
            {logItems.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.item}</span>
                <span className="text-muted-foreground tabular-nums">{item.calories} kcal</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
