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
  /** When true, clicking adds the tapAmount (default +1). */
  quickIncrement?: boolean;
  /** Amount to add per tap in quickIncrement mode. Default: 1 */
  tapAmount?: number;
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
  tapAmount = 1,
}: VerticalBarProps) {
  const [optimisticValue, setOptimisticValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOptimisticValue(value);
  }, [value]);

  const pct = max > 0 ? (optimisticValue / max) * 100 : 0;
  const isOver = optimisticValue > max && max > 0;
  const overRatio = isOver ? optimisticValue / max : 1;
  const isCompleted = mode === "toggle" ? (completed ?? optimisticValue >= max) : pct >= 95;

  // Progressive bar width: base w-8 (32px), grows wider the more over goal
  // Each 100% over adds ~16px, capped at w-20 (80px)
  const barWidth = isOver
    ? Math.min(80, 32 + Math.floor((overRatio - 1) * 48))
    : 32;

  // Fill color: emerald → sky-blue gradient when over goal
  const fillClass = isOver
    ? "bg-gradient-to-t from-emerald-500 to-sky-400"
    : pct >= 95
      ? "bg-emerald-400"
      : "bg-emerald-500";

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);
  const displayMax = Number.isInteger(max) ? String(max) : max.toFixed(1);

  function handleClick() {
    if (quickIncrement) {
      setOptimisticValue((prev) => prev + tapAmount);
      onIncrement?.(tapAmount);
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
        "transition-all duration-200",
        isCompleted
          ? "border-emerald-500/30 bg-zinc-900/60 shadow-[0_0_16px_rgba(52,211,153,0.15)]"
          : "border-zinc-800/50 bg-zinc-900/60",
        !editing && "hover:border-zinc-700 hover:bg-zinc-800/60",
      )}
    >
      {icon && !editing && (
        <div className={cn("transition-colors duration-200", isCompleted ? "text-emerald-400" : "text-zinc-500")}>
          {icon}
        </div>
      )}

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

      {/* Vertical bar — progressively widens when over goal */}
      <div
        className="relative rounded-lg bg-zinc-800/80 transition-all duration-300"
        style={{ height: "80px", width: `${barWidth}px` }}
      >
        <div
          className={cn(
            "absolute bottom-0 left-0 w-full rounded-lg transition-all duration-200",
            fillClass,
          )}
          style={{ height: `${Math.min(100, pct)}%` }}
        />
      </div>

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
