"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { CheckIcon, FlameIcon, MoonIcon } from "lucide-react";
import { toggleCompletion } from "@/actions/completions";
import { cn } from "@/lib/utils";

type Habit = {
  id: string;
  name: string;
};

type Completion = {
  habitId: string;
};

type StreakInfo = {
  habitId: string;
  currentStreak: number;
};

type Props = {
  habits: Habit[];
  completions: Completion[];
  streaks: StreakInfo[];
  /** Total applicable habits today (used for rest-day detection) */
  applicableCount: number;
};

type OptimisticState = Set<string>;

const STREAK_MILESTONES = [100, 60, 30, 14, 7];

function getStreakTier(streak: number): "gold" | "fire" | "warm" | null {
  if (streak >= 30) return "gold";
  if (streak >= 7) return "fire";
  if (streak >= 3) return "warm";
  return null;
}

function isMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}

export function HabitList({ habits, completions, streaks, applicableCount }: Props) {
  const initialCompleted = new Set(completions.map((c) => c.habitId));

  const [optimisticCompleted, setOptimisticCompleted] =
    useOptimistic<OptimisticState>(initialCompleted);

  const [, startTransition] = useTransition();

  const streakMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of streaks) m.set(s.habitId, s.currentStreak);
    return m;
  }, [streaks]);

  // Sort: incomplete first, then completed — preserve creation order within groups
  const sortedHabits = useMemo(() => {
    return [...habits].sort((a, b) => {
      const aDone = optimisticCompleted.has(a.id) ? 1 : 0;
      const bDone = optimisticCompleted.has(b.id) ? 1 : 0;
      return aDone - bDone;
    });
  }, [habits, optimisticCompleted]);

  function handleToggle(habitId: string) {
    startTransition(async () => {
      setOptimisticCompleted((prev) => {
        const next = new Set(prev);
        if (next.has(habitId)) {
          next.delete(habitId);
        } else {
          next.add(habitId);
        }
        return next;
      });
      await toggleCompletion(habitId, new Date());
    });
  }

  // No habits created at all
  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-zinc-700">
          <CheckIcon className="size-6 text-zinc-400" />
        </div>
        <p className="text-base font-medium text-foreground">No habits yet</p>
        <p className="text-sm text-muted-foreground">
          Add your first habit to start tracking your routine.
        </p>
      </div>
    );
  }

  // Habits exist but none are scheduled today (rest day)
  if (applicableCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-zinc-700">
          <MoonIcon className="size-6 text-indigo-400" />
        </div>
        <p className="text-base font-medium text-foreground">Rest day</p>
        <p className="text-sm text-muted-foreground">
          No habits scheduled for today. Recharge and come back strong.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {sortedHabits.map((habit) => {
        const completed = optimisticCompleted.has(habit.id);
        const streak = streakMap.get(habit.id) ?? 0;
        const tier = getStreakTier(streak);
        const milestone = isMilestone(streak);

        return (
          <li
            key={habit.id}
            className="transition-all duration-300 ease-in-out"
          >
            <button
              type="button"
              onClick={() => handleToggle(habit.id)}
              className={cn(
                "group flex w-full items-center gap-4 px-1 py-4 text-left transition-colors",
                "hover:bg-muted/40 active:bg-muted/60 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              {/* Custom toggle circle */}
              <span
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
                  completed
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-border bg-transparent group-hover:border-muted-foreground",
                )}
              >
                <CheckIcon
                  className={cn(
                    "size-3.5 transition-all duration-200",
                    completed ? "opacity-100 scale-100" : "opacity-0 scale-50",
                  )}
                />
              </span>

              {/* Habit name */}
              <span
                className={cn(
                  "flex-1 text-base font-medium leading-snug transition-colors duration-200",
                  completed
                    ? "text-muted-foreground line-through decoration-muted-foreground/50"
                    : "text-foreground",
                )}
              >
                {habit.name}
              </span>

              {/* Streak badge */}
              {streak >= 2 && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums transition-all duration-200",
                    tier === "gold" &&
                      "bg-amber-500/15 text-amber-400",
                    tier === "fire" &&
                      "bg-orange-500/15 text-orange-400",
                    tier === "warm" &&
                      "bg-zinc-700/60 text-zinc-400",
                    !tier && "bg-zinc-700/60 text-zinc-400",
                    milestone && "animate-pulse",
                  )}
                >
                  <FlameIcon
                    className={cn(
                      "size-3",
                      tier === "gold" && "text-amber-400",
                      tier === "fire" && "text-orange-400",
                    )}
                  />
                  {streak}
                </span>
              )}

              {/* Completed badge */}
              {completed && (
                <span className="text-xs font-semibold text-emerald-400">
                  Done
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
