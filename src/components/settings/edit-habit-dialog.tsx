"use client";

import { useRef, useState, useTransition } from "react";
import { updateHabit } from "@/actions/habits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FrequencyConfig, HabitSummary } from "@/lib/types";

type SimpleFrequencyType = "daily" | "weekdays";

const FREQUENCY_OPTIONS: { value: SimpleFrequencyType; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays only" },
];

function toSimpleFrequency(freq: FrequencyConfig): SimpleFrequencyType {
  return freq.type === "weekdays" ? "weekdays" : "daily";
}

interface EditHabitDialogProps {
  habit: HabitSummary;
}

export function EditHabitDialog({ habit }: EditHabitDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(habit.name);
  const [frequencyType, setFrequencyType] = useState<SimpleFrequencyType>(
    toSimpleFrequency(habit.frequency),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setName(habit.name);
    setFrequencyType(toSimpleFrequency(habit.frequency));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Habit name is required.");
      inputRef.current?.focus();
      return;
    }

    const frequency: FrequencyConfig =
      frequencyType === "weekdays" ? { type: "weekdays" } : { type: "daily" };

    startTransition(async () => {
      const result = await updateHabit(habit.id, { name: trimmed, frequency });
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit habit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-habit-name">Name</Label>
            <Input
              ref={inputRef}
              id="edit-habit-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              autoComplete="off"
            />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Frequency */}
          <div className="flex flex-col gap-1.5">
            <Label>Frequency</Label>
            <div className="flex gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequencyType(opt.value)}
                  className={
                    frequencyType === opt.value
                      ? "flex-1 rounded-lg border border-emerald-500 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 transition-colors duration-150"
                      : "flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:border-zinc-600 hover:text-zinc-100"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
