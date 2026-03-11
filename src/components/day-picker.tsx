"use client";

import { cn } from "@/lib/utils";
import type { FrequencyConfig } from "@/lib/types";

const ALL_DAYS = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
] as const;

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const ALL_DAY_KEYS = ALL_DAYS.map((d) => d.key);

type Mode = "daily" | "scheduled" | "weekly";

interface DayPickerProps {
  value: FrequencyConfig;
  onChange: (freq: FrequencyConfig) => void;
}

function getMode(freq: FrequencyConfig): Mode {
  return freq.type === "weekly" ? "weekly" : freq.type === "scheduled" ? "scheduled" : "daily";
}

function freqToDays(freq: FrequencyConfig): string[] {
  switch (freq.type) {
    case "daily":
      return [...ALL_DAY_KEYS];
    case "scheduled":
      return [...freq.days];
    case "weekly":
      return [];
  }
}

function getTimesPerWeek(freq: FrequencyConfig): number {
  return freq.type === "weekly" ? freq.timesPerWeek : 3;
}

export function DayPicker({ value, onChange }: DayPickerProps) {
  const mode = getMode(value);
  const selectedDays = freqToDays(value);
  const timesPerWeek = getTimesPerWeek(value);

  function handleMode(m: Mode) {
    if (m === "daily") onChange({ type: "daily" });
    else if (m === "scheduled") {
      // Default to weekdays when switching to scheduled
      const days = selectedDays.length > 0 ? selectedDays : [...WEEKDAYS];
      onChange({ type: "scheduled", days });
    } else if (m === "weekly") {
      onChange({ type: "weekly", timesPerWeek });
    }
  }

  function toggleDay(day: string) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    if (next.length === 0) return;
    onChange({ type: "scheduled", days: next });
  }

  function setTimesPerWeek(n: number) {
    const clamped = Math.max(1, Math.min(7, n));
    onChange({ type: "weekly", timesPerWeek: clamped });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mode selector */}
      <div className="flex gap-2">
        {(
          [
            { key: "daily", label: "Every day" },
            { key: "scheduled", label: "Specific days" },
            { key: "weekly", label: "Weekly target" },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => handleMode(m.key)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              mode === m.key
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-transparent text-muted-foreground hover:border-zinc-600 hover:text-zinc-100",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Day toggles — shown for daily and scheduled */}
      {mode === "scheduled" && (
        <div className="flex gap-1.5">
          {ALL_DAYS.map((day) => {
            const active = selectedDays.includes(day.key);
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => toggleDay(day.key)}
                aria-pressed={active}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-150",
                  active
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Times per week — shown for weekly mode */}
      {mode === "weekly" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTimesPerWeek(timesPerWeek - 1)}
            disabled={timesPerWeek <= 1}
            className="flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            -
          </button>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {timesPerWeek}
            </span>
            <span className="text-sm text-muted-foreground">
              {timesPerWeek === 1 ? "time" : "times"} per week
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTimesPerWeek(timesPerWeek + 1)}
            disabled={timesPerWeek >= 7}
            className="flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
