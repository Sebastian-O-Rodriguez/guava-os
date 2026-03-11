"use client";

import { useTransition } from "react";
import { archiveHabit, updateHabit } from "@/actions/habits";
import { Button } from "@/components/ui/button";
import type { HabitSummary } from "@/lib/types";

interface ArchiveHabitButtonProps {
  habit: HabitSummary;
}

export function ArchiveHabitButton({ habit }: ArchiveHabitButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      if (habit.active) {
        await archiveHabit(habit.id);
      } else {
        await updateHabit(habit.id, { active: true });
      }
    });
  }

  if (habit.active) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={handleClick}
        className="text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10"
      >
        {isPending ? "..." : "Archive"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={handleClick}
      className="text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10"
    >
      {isPending ? "..." : "Reactivate"}
    </Button>
  );
}
