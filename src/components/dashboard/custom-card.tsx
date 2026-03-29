"use client";

import type { CategoryProgress } from "@/lib/types";
import { LiquidGauge } from "./liquid-gauge";

type CustomCardProps = {
  category: CategoryProgress;
};

export function CustomCard({ category }: CustomCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-foreground">{category.categoryName}</h2>

      {category.goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No goals set.</p>
      ) : (
        <div className="flex justify-around items-end">
          {category.goals.map((goal) => (
            <LiquidGauge
              key={goal.goalId}
              label={goal.metric}
              value={goal.actual}
              max={goal.target}
              unit={goal.period === "daily" ? "/day" : "/wk"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
