"use client";

import { useEffect, useRef, useState } from "react";

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
  const isCompleted = mode === "toggle" ? (completed ?? optimisticValue >= max) : pct >= 95;

  // Color based on progress
  const fillColor =
    pct > 105
      ? "bg-amber-500"
      : pct >= 95
        ? "bg-emerald-400"
        : "bg-emerald-500";

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);
  const displayMax = Number.isInteger(max) ? String(max) : max.toFixed(1);

  function handleClick() {
    if (mode === "toggle") {
      // Optimistic: immediately flip
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
        // Optimistic: immediately add
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
      className={[
        "rounded-xl border p-3 flex flex-col items-center gap-2 cursor-pointer select-none",
        "transition-all duration-150",
        isCompleted
          ? "border-emerald-500/30 bg-zinc-900/60 shadow-[0_0_16px_rgba(52,211,153,0.15)]"
          : "border-zinc-800/50 bg-zinc-900/60",
        !editing && "hover:border-zinc-700 hover:bg-zinc-800/60",
      ].join(" ")}
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

      {/* Vertical bar track */}
      <div
        className="relative w-8 rounded-lg bg-zinc-800/80"
        style={{ height: "80px" }}
      >
        <div
          className={[
            "absolute bottom-0 left-0 w-full rounded-lg transition-all duration-200",
            fillColor,
          ].join(" ")}
          style={{ height: `${Math.min(100, pct)}%` }}
        />
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
