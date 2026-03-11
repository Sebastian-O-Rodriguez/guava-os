"use client";

import { useOptimistic, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toggleCompletion } from "@/actions/completions";
import { cn } from "@/lib/utils";

type Habit = {
  id: string;
  name: string;
};

type Completion = {
  habitId: string;
};

type Props = {
  habits: Habit[];
  completions: Completion[];
};

type OptimisticState = Set<string>;

export function HabitList({ habits, completions }: Props) {
  const initialCompleted = new Set(completions.map((c) => c.habitId));

  const [optimisticCompleted, setOptimisticCompleted] =
    useOptimistic<OptimisticState>(initialCompleted);

  const [, startTransition] = useTransition();

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

  return (
    <ul className="flex flex-col divide-y divide-border">
      {habits.map((habit) => {
        const completed = optimisticCompleted.has(habit.id);
        return (
          <li key={habit.id}>
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
