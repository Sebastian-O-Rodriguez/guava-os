"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { deleteHabit } from "@/actions/habits";
import { Button } from "@/components/ui/button";
import type { HabitSummary } from "@/lib/types";

interface DeleteHabitButtonProps {
  habit: HabitSummary;
}

export function DeleteHabitButton({ habit }: DeleteHabitButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deleteHabit(habit.id);
      if (!result.success) {
        setError(result.error ?? "Something went wrong");
        setConfirming(false);
      }
    });
  }

  function handleCancel() {
    setConfirming(false);
    setError(null);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        {error && <span className="text-xs text-rose-400">{error}</span>}
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={handleCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={handleClick}
          className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
        >
          {isPending ? "..." : "Confirm"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
    >
      <Trash2Icon className="size-3.5" />
    </Button>
  );
}
