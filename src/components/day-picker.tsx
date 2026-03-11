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

type Preset = "daily" | "weekdays" | "custom";

interface DayPickerProps {
  value: FrequencyConfig;
  onChange: (freq: FrequencyConfig) => void;
}

function getPreset(days: string[]): Preset {
  if (days.length === 7) return "daily";
  if (
    days.length === 5 &&
    WEEKDAYS.every((d) => days.includes(d))
  )
    return "weekdays";
  return "custom";
}

function freqToDays(freq: FrequencyConfig): string[] {
  switch (freq.type) {
    case "daily":
      return [...ALL_DAY_KEYS];
    case "weekdays":
      return [...WEEKDAYS];
    case "custom":
      return [...freq.days];
  }
}

function daysToFreq(days: string[]): FrequencyConfig {
  const preset = getPreset(days);
  if (preset === "daily") return { type: "daily" };
  if (preset === "weekdays") return { type: "weekdays" };
  return { type: "custom", days };
}

export function DayPicker({ value, onChange }: DayPickerProps) {
  const selectedDays = freqToDays(value);
  const preset = getPreset(selectedDays);

  function handlePreset(p: Preset) {
    if (p === "daily") onChange({ type: "daily" });
    else if (p === "weekdays") onChange({ type: "weekdays" });
    // "custom" just keeps current selection
  }

  function toggleDay(day: string) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    // Don't allow empty selection
    if (next.length === 0) return;
    onChange(daysToFreq(next));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Presets */}
      <div className="flex gap-2">
        {(
          [
            { key: "daily", label: "Every day" },
            { key: "weekdays", label: "Weekdays" },
          ] as const
        ).map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => handlePreset(p.key)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              preset === p.key
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-transparent text-muted-foreground hover:border-zinc-600 hover:text-zinc-100",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Day toggles */}
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
    </div>
  );
}
