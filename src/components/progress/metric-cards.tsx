"use client";

import { cn } from "@/lib/utils";
import type { MetricCardData } from "@/lib/types";

function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

function MetricCard({ label, value, sub, accent = false }: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border bg-card px-5 py-4",
        "transition-colors hover:bg-card/80",
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-4xl font-bold tabular-nums leading-none tracking-tight",
          accent ? "text-emerald-400" : "text-foreground",
        )}
      >
        {value}
      </span>
      {sub && (
        <span className="mt-0.5 truncate text-xs text-muted-foreground">
          {sub}
        </span>
      )}
    </div>
  );
}

export function MetricCards({
  currentStreak,
  longestStreak,
  bestHabitName,
  weeklyRate,
  monthlyRate,
}: MetricCardData) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label="Current Streak"
        value={currentStreak === 0 ? "0" : `${currentStreak}`}
        sub={currentStreak === 1 ? "day" : "days"}
        accent={currentStreak > 0}
      />
      <MetricCard
        label="Longest Streak"
        value={longestStreak === 0 ? "0" : `${longestStreak}`}
        sub={longestStreak === 1 ? "day" : "days"}
      />
      <MetricCard
        label="This Week"
        value={formatRate(weeklyRate)}
        sub={weeklyRate === null ? "no data" : "completion rate"}
        accent={weeklyRate !== null && weeklyRate >= 0.8}
      />
      <MetricCard
        label="This Month"
        value={formatRate(monthlyRate)}
        sub={
          bestHabitName
            ? `Best: ${bestHabitName}`
            : monthlyRate === null
              ? "no data"
              : "completion rate"
        }
        accent={monthlyRate !== null && monthlyRate >= 0.8}
      />
    </div>
  );
}
