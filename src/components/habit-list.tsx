"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import {
  CheckIcon,
  FlameIcon,
  MoonIcon,
  AlertCircleIcon,
  CalendarDaysIcon,
  TargetIcon,
} from "lucide-react";
import { toggleCompletion, completeOverdue } from "@/actions/completions";
import { cn } from "@/lib/utils";
import type { WeeklyProgress, OverdueHabit } from "@/lib/types";

type Habit = {
  id: string;
  name: string;
  frequency: { type: string };
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
  applicableCount: number;
  weeklyProgress: WeeklyProgress[];
  overdueHabits: OverdueHabit[];
};

type OptimisticState = Set<string>;

function getStreakTier(streak: number): "gold" | "fire" | "warm" | null {
  if (streak >= 30) return "gold";
  if (streak >= 7) return "fire";
  if (streak >= 3) return "warm";
  return null;
}

const STREAK_MILESTONES = [100, 60, 30, 14, 7];
function isMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}

export function HabitList({
  habits,
  completions,
  streaks,
  applicableCount,
  weeklyProgress,
  overdueHabits,
}: Props) {
  const initialCompleted = new Set(completions.map((c) => c.habitId));

  const [optimisticCompleted, setOptimisticCompleted] =
    useOptimistic<OptimisticState>(initialCompleted);

  // Track overdue items completed optimistically
  const [optimisticOverdueDone, setOptimisticOverdueDone] =
    useOptimistic<Set<string>>(new Set());

  const [, startTransition] = useTransition();

  const streakMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of streaks) m.set(s.habitId, s.currentStreak);
    return m;
  }, [streaks]);

  const weeklyMap = useMemo(() => {
    const m = new Map<string, WeeklyProgress>();
    for (const w of weeklyProgress) m.set(w.habitId, w);
    return m;
  }, [weeklyProgress]);

  // Sort: incomplete first, then completed
  const sortedHabits = useMemo(() => {
    return [...habits].sort((a, b) => {
      const aDone = optimisticCompleted.has(a.id) ? 1 : 0;
      const bDone = optimisticCompleted.has(b.id) ? 1 : 0;
      return aDone - bDone;
    });
  }, [habits, optimisticCompleted]);

  // Filter overdue to only show not-yet-completed ones
  const activeOverdue = useMemo(() => {
    return overdueHabits.filter((o) => {
      const key = `${o.habitId}|${o.missedDate.toISOString()}`;
      return !optimisticOverdueDone.has(key);
    });
  }, [overdueHabits, optimisticOverdueDone]);

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

  function handleCompleteOverdue(habitId: string, missedDate: Date) {
    const key = `${habitId}|${missedDate.toISOString()}`;
    startTransition(async () => {
      setOptimisticOverdueDone((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      await completeOverdue(habitId, missedDate);
    });
  }

  // No habits created at all
  if (habits.length === 0 && overdueHabits.length === 0) {
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

  // Habits exist but none are scheduled today and no overdue
  if (applicableCount === 0 && activeOverdue.length === 0) {
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
    <div className="flex flex-col">
      {/* Overdue section */}
      {activeOverdue.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-2 px-1 pt-2 pb-1">
            <AlertCircleIcon className="size-3.5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              Overdue
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {activeOverdue.map((item) => {
              const dayLabel = item.missedDate.toLocaleDateString("en-US", {
                weekday: "short",
                timeZone: "UTC",
              });
              return (
                <li key={`${item.habitId}-${item.missedDate.toISOString()}`}>
                  <button
                    type="button"
                    onClick={() =>
                      handleCompleteOverdue(item.habitId, item.missedDate)
                    }
                    className={cn(
                      "group flex w-full items-center gap-4 px-1 py-3 text-left transition-colors",
                      "hover:bg-amber-500/5 active:bg-amber-500/10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    )}
                  >
                    <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-amber-500/50 bg-transparent group-hover:border-amber-400 transition-all duration-200">
                      <CheckIcon className="size-3.5 opacity-0 scale-50 transition-all duration-200 group-hover:opacity-30 group-hover:scale-75 text-amber-400" />
                    </span>
                    <span className="flex-1 text-base font-medium leading-snug text-foreground">
                      {item.habitName}
                    </span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                      {dayLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Today's habits */}
      {sortedHabits.length > 0 && (
        <>
          {activeOverdue.length > 0 && (
            <div className="flex items-center gap-2 px-1 pt-2 pb-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Today
              </span>
            </div>
          )}
          <ul className="flex flex-col divide-y divide-border">
            {sortedHabits.map((habit, i) => {
              const completed = optimisticCompleted.has(habit.id);
              const streak = streakMap.get(habit.id) ?? 0;
              const tier = getStreakTier(streak);
              const milestone = isMilestone(streak);
              const weekly = weeklyMap.get(habit.id);

              return (
                <li
                  key={habit.id}
                  className="animate-slide-up [animation-fill-mode:forwards] opacity-0 transition-all duration-300 ease-in-out"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(habit.id)}
                    className={cn(
                      "group flex w-full items-center gap-4 px-1 py-4 text-left transition-colors",
                      "hover:bg-muted/40 active:bg-muted/60 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    )}
                  >
                    {/* Toggle circle */}
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
                          completed
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-50",
                        )}
                      />
                    </span>

                    {/* Name + weekly progress */}
                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-base font-medium leading-snug transition-colors duration-200 truncate",
                          completed
                            ? "text-muted-foreground line-through decoration-muted-foreground/50"
                            : "text-foreground",
                        )}
                      >
                        {habit.frequency.type === "scheduled" && (
                          <CalendarDaysIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {habit.frequency.type === "weekly" && (
                          <TargetIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {habit.name}
                      </span>

                      {/* Weekly progress bar */}
                      {weekly && (
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 max-w-[160px] rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                weekly.completed >= weekly.target
                                  ? "bg-emerald-500"
                                  : "bg-emerald-500/60",
                              )}
                              style={{
                                width: `${Math.min(100, (weekly.completed / weekly.target) * 100)}%`,
                              }}
                            />
                          </div>
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              weekly.completed >= weekly.target
                                ? "text-emerald-400 font-semibold"
                                : "text-muted-foreground",
                            )}
                          >
                            {weekly.completed}/{weekly.target}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Streak badge */}
                    {streak >= 2 && (
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums transition-all duration-200",
                          tier === "gold" && "bg-amber-500/15 text-amber-400",
                          tier === "fire" && "bg-orange-500/15 text-orange-400",
                          tier === "warm" && "bg-zinc-700/60 text-zinc-400",
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

                    {/* Weekly target met badge */}
                    {weekly && weekly.completed >= weekly.target && (
                      <span className="text-xs font-semibold text-emerald-400">
                        Target met
                      </span>
                    )}

                    {/* Completed badge (non-weekly) */}
                    {completed && !weekly && (
                      <span className="text-xs font-semibold text-emerald-400">
                        Done
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
