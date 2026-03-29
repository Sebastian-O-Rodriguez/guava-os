"use client";

import type { CategoryProgress } from "@/lib/types";
import { VerticalBar } from "./vertical-bar";

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
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(category.goals.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {category.goals.map((goal) => (
            <VerticalBar
              key={goal.goalId}
              label={goal.metric}
              value={goal.actual}
              max={goal.target}
              unit={goal.period === "daily" ? "/day" : "/wk"}
              mode="increment"
            />
          ))}
        </div>
      )}
    </div>
  );
}
