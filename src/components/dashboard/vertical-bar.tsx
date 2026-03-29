"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type VerticalBarProps = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  mode: "increment" | "toggle";
  onIncrement?: (amount: number) => void;
  onToggle?: () => void;
  completed?: boolean;
  icon?: React.ReactNode;
  /** When true, clicking immediately adds +1 (no input field). Used for gym items. */
  quickIncrement?: boolean;
};

export function VerticalBar({
  label,
  value,
  max,
  unit,
  mode,
  onIncrement,
  onToggle,
  completed,
  icon,
  quickIncrement = false,
}: VerticalBarProps) {
  const [optimisticValue, setOptimisticValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with server value
  useEffect(() => {
    setOptimisticValue(value);
  }, [value]);

  const pct = max > 0 ? (optimisticValue / max) * 100 : 0;
  const isOver = optimisticValue > max && max > 0;
  const isCompleted = mode === "toggle" ? (completed ?? optimisticValue >= max) : pct >= 95;

  // Fitness (quickIncrement) fill: widening bar + emerald→sky gradient when over
  // Nutrition (regular increment) fill: split emerald + orange gradient from top when over
  const fitnessFillClass = isOver
    ? "bg-gradient-to-t from-emerald-500 to-sky-400"
    : pct >= 95
      ? "bg-emerald-400"
      : "bg-emerald-500";

  const normalFillClass =
    pct >= 95 && !isOver ? "bg-emerald-400" : "bg-emerald-500";

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);
  const displayMax = Number.isInteger(max) ? String(max) : max.toFixed(1);

  function handleClick() {
    if (quickIncrement) {
      // Immediately add +1, no input field
      setOptimisticValue((prev) => prev + 1);
      onIncrement?.(1);
    } else if (mode === "toggle") {
      setOptimisticValue((prev) => (prev >= max ? 0 : max));
      onToggle?.();
    } else {
      setEditing(true);
      setInputVal("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const num = parseFloat(inputVal);
      if (!isNaN(num) && num > 0) {
        setOptimisticValue((prev) => prev + num);
        onIncrement?.(num);
      }
      setEditing(false);
      setInputVal("");
    } else if (e.key === "Escape") {
      setEditing(false);
      setInputVal("");
    }
  }

  function handleInputBlur() {
    setEditing(false);
    setInputVal("");
  }

  return (
    <div
      onClick={!editing ? handleClick : undefined}
      className={cn(
        "rounded-xl border p-3 flex flex-col items-center gap-2 cursor-pointer select-none",
        "transition-all duration-150",
        isCompleted
          ? "border-emerald-500/30 bg-zinc-900/60 shadow-[0_0_16px_rgba(52,211,153,0.15)]"
          : "border-zinc-800/50 bg-zinc-900/60",
        !editing && "hover:border-zinc-700 hover:bg-zinc-800/60",
      )}
    >
      {/* Icon (optional) */}
      {icon && !editing && (
        <div className={isCompleted ? "text-emerald-400" : "text-zinc-500"}>
          {icon}
        </div>
      )}

      {/* Label */}
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="any"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          onClick={(e) => e.stopPropagation()}
          placeholder="add"
          className="w-full text-center bg-transparent border-b border-zinc-600 text-sm text-foreground outline-none placeholder:text-zinc-600 tabular-nums py-0.5"
        />
      ) : (
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium leading-none">
          {label}
        </span>
      )}

      {/* Vertical bar track — widens when fitness bar goes over goal */}
      <div
        className={cn(
          "relative rounded-lg bg-zinc-800/80 transition-all duration-300",
          quickIncrement && isOver ? "w-12" : "w-8",
        )}
        style={{ height: "80px" }}
      >
        {isOver && !quickIncrement ? (
          <>
            {/* Emerald portion up to goal */}
            <div
              className="absolute bottom-0 left-0 w-full rounded-b-lg bg-emerald-500 transition-all duration-200"
              style={{ height: `${(max / optimisticValue) * 100}%` }}
            />
            {/* Orange excess portion above goal */}
            <div
              className="absolute top-0 left-0 w-full rounded-t-lg bg-gradient-to-t from-amber-500 to-orange-400 transition-all duration-200"
              style={{ height: `${((optimisticValue - max) / optimisticValue) * 100}%` }}
            />
          </>
        ) : (
          <div
            className={cn(
              "absolute bottom-0 left-0 w-full rounded-lg transition-all duration-200",
              quickIncrement ? fitnessFillClass : normalFillClass,
            )}
            style={{ height: `${Math.min(100, pct)}%` }}
          />
        )}
      </div>

      {/* Value */}
      <div className="flex flex-col items-center leading-none gap-0.5">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {displayValue}
          {unit ? (
            <span className="text-xs font-normal text-muted-foreground ml-0.5">
              {unit}
            </span>
          ) : null}
        </span>
        {max > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            /{displayMax}
          </span>
        )}
      </div>
    </div>
  );
}
