"use client";

import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import type { GymBodyPartCount, GoalProgress } from "@/lib/types";

type GymCardProps = {
  gymSummary: GymBodyPartCount[];
  goals: GoalProgress[];
};

export function GymCard({ gymSummary, goals }: GymCardProps) {
  const summaryMap = new Map(gymSummary.map((g) => [g.bodyPart.toLowerCase(), g.count]));

  const rows: { label: string; done: number; target: number }[] =
    goals.length > 0
      ? goals.map((goal) => {
          const bodyPart = goal.metric.replace("_sessions", "").replace(/_/g, " ");
          const normalizedKey = bodyPart.toLowerCase();
          const done = summaryMap.get(normalizedKey) ?? goal.actual;
          return { label: bodyPart, done, target: goal.target };
        })
      : gymSummary.map((g) => ({ label: g.bodyPart, done: g.count, target: 1 }));

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">💪</span>
          <h2 className="font-semibold text-foreground">Gym</h2>
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          This Week
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gym sessions logged this week.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const done = row.done >= row.target;
            return (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle2Icon className="size-4 text-emerald-400 shrink-0" />
                  ) : (
                    <CircleIcon className="size-4 text-zinc-600 shrink-0" />
                  )}
                  <span
                    className={`text-sm capitalize ${done ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {row.label}
                  </span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {row.done}/{row.target}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
