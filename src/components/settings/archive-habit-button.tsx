"use client";

import { useState, useTransition } from "react";
import { archiveHabit, updateHabit } from "@/actions/habits";
import { Button } from "@/components/ui/button";
import type { HabitSummary } from "@/lib/types";

interface ArchiveHabitButtonProps {
  habit: HabitSummary;
}

export function ArchiveHabitButton({ habit }: ArchiveHabitButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = habit.active
        ? await archiveHabit(habit.id)
        : await updateHabit(habit.id, { active: true });

      if (!result.success) {
        setError(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-rose-400">{error}</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={handleClick}
        className={
          habit.active
            ? "text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10"
            : "text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10"
        }
      >
        {isPending ? "..." : habit.active ? "Archive" : "Reactivate"}
      </Button>
    </div>
  );
}
