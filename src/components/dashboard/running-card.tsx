"use client";

import type { RunningSummary, GoalProgress } from "@/lib/types";
import { ProgressBar } from "./progress-bar";

type RunningCardProps = {
  runningSummary: RunningSummary;
  goals: GoalProgress[];
};

export function RunningCard({ runningSummary, goals }: RunningCardProps) {
  const milesGoal = goals.find((g) => g.metric === "miles");
  const sessionsGoal = goals.find((g) => g.metric === "sessions");

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏃</span>
          <h2 className="font-semibold text-foreground">Running</h2>
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          This Week
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {milesGoal ? (
          <ProgressBar
            value={runningSummary.totalMiles}
            max={milesGoal.target}
            label="Miles"
            unit="mi"
          />
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Miles</span>
            <span className="font-medium tabular-nums text-foreground">
              {runningSummary.totalMiles.toFixed(1)} mi
            </span>
          </div>
        )}

        {sessionsGoal ? (
          <ProgressBar
            value={runningSummary.sessions}
            max={sessionsGoal.target}
            label="Sessions"
            color="blue"
          />
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sessions</span>
            <span className="font-medium tabular-nums text-foreground">
              {runningSummary.sessions}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
