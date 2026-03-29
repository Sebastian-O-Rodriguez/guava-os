"use client";

import type { CategoryProgress } from "@/lib/types";
import { ProgressBar } from "./progress-bar";

type CustomCardProps = {
  category: CategoryProgress;
};

export function CustomCard({ category }: CustomCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">{category.categoryName}</h2>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Custom
        </span>
      </div>

      {category.goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No goals set.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {category.goals.map((goal) => (
            <ProgressBar
              key={goal.goalId}
              value={goal.actual}
              max={goal.target}
              label={goal.metric}
              unit={goal.period === "daily" ? "/ day" : "/ week"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
