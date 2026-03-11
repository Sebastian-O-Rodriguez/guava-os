"use client";

import { cn } from "@/lib/utils";
import type { HabitSparkline } from "@/lib/types";

interface SparklineTableProps {
  sparklines: HabitSparkline[];
}

interface DotProps {
  completed: boolean;
  applicable: boolean;
}

function Dot({ completed, applicable }: DotProps) {
  if (!applicable) {
    return (
      <span
        className="block size-3 shrink-0 rounded-sm"
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn(
        "block size-3 shrink-0 rounded-sm transition-colors",
        completed ? "bg-emerald-500" : "bg-zinc-700",
      )}
      aria-hidden="true"
    />
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) {
    return (
      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        streak >= 7
          ? "bg-emerald-500/20 text-emerald-400"
          : streak >= 3
            ? "bg-emerald-900/40 text-emerald-500"
            : "bg-zinc-800 text-zinc-400",
      )}
    >
      {streak}d
    </span>
  );
}

export function SparklineTable({ sparklines }: SparklineTableProps) {
  if (sparklines.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
        <p className="text-sm text-muted-foreground">No habits to display</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="divide-y divide-border">
        {sparklines.map((habit) => (
          <div
            key={habit.habitId}
            className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-800/60 transition-colors duration-150"
          >
            {/* Habit name */}
            <span
              className="w-32 shrink-0 truncate text-sm font-medium text-foreground lg:w-44"
              title={habit.name}
            >
              {habit.name}
            </span>

            {/* Streak badge */}
            <div className="w-10 shrink-0 text-right">
              <StreakBadge streak={habit.currentStreak} />
            </div>

            {/* Sparkline dots */}
            <div className="flex flex-1 items-center gap-0.5 overflow-hidden">
              {habit.points.map((point) => (
                <Dot
                  key={point.date}
                  completed={point.completed}
                  applicable={point.applicable}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 border-t border-border px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="block size-3 rounded-sm bg-emerald-500" />
          Done
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="block size-3 rounded-sm bg-zinc-700" />
          Missed
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="block size-3 rounded-sm border border-border opacity-40" />
          N/A
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Streak badge = current streak
        </span>
      </div>
    </div>
  );
}
