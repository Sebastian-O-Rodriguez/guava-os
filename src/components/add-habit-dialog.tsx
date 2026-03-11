"use client";

import { useRef, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { createHabit } from "@/actions/habits";
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
import { DayPicker } from "@/components/day-picker";
import type { FrequencyConfig } from "@/lib/types";

const DEFAULT_FREQ: FrequencyConfig = { type: "daily" };

export function AddHabitDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<FrequencyConfig>(DEFAULT_FREQ);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setName("");
    setFrequency(DEFAULT_FREQ);
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

    startTransition(async () => {
      const result = await createHabit({ name: trimmed, frequency });
      if (result.success) {
        reset();
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
          <Button size="sm" className="gap-1.5">
            <PlusIcon />
            Add habit
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New habit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              ref={inputRef}
              id="habit-name"
              placeholder="e.g. Morning run"
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
            <Label>Schedule</Label>
            <DayPicker value={frequency} onChange={setFrequency} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
