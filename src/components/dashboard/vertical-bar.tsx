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
  onDecrement?: (amount: number) => void;
  onToggle?: () => void;
  completed?: boolean;
  icon?: React.ReactNode;
  quickIncrement?: boolean;
  tapAmount?: number;
};

export function VerticalBar({
  label,
  value,
  max,
  unit,
  mode,
  onIncrement,
  onDecrement,
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
  const overPct = isOver ? ((optimisticValue - max) / max) * 100 : 0;
  const isCompleted = mode === "toggle" ? (completed ?? optimisticValue >= max) : pct >= 95;

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);

  // Radial blue glow: proportional to % over goal
  // 10% over = small glow, 100% over = massive aura
  const blueSpread = isOver ? Math.min(40, overPct * 0.4) : 0;
  const blueOpacity = isOver ? Math.min(0.5, overPct * 0.005) : 0;

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

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (optimisticValue <= 0) return;
    setOptimisticValue((prev) => Math.max(0, prev - tapAmount));
    onDecrement?.(tapAmount);
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
      onContextMenu={quickIncrement ? handleContextMenu : undefined}
      className={cn(
        "relative rounded-xl border p-1.5 flex flex-col items-center justify-center cursor-pointer select-none overflow-visible",
        "transition-all duration-300",
        isCompleted
          ? "border-emerald-500/30 bg-zinc-900/60"
          : "border-zinc-800/50 bg-zinc-900/60",
        !editing && "hover:border-zinc-700 hover:bg-zinc-800/60",
      )}
      style={{ minHeight: "120px" }}
    >
      {/* Radial blue overflow glow — expands outside the bar proportional to % over */}
      {isOver && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-500"
          style={{
            background: `radial-gradient(ellipse at center, rgba(56,189,248,${blueOpacity}) 0%, rgba(56,189,248,${blueOpacity * 0.5}) 40%, transparent 70%)`,
            transform: `scale(${1 + blueSpread / 50})`,
          }}
        />
      )}

      {/* Label at top */}
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
          className="w-full text-center bg-transparent border-b border-zinc-600 text-xs text-foreground outline-none placeholder:text-zinc-600 tabular-nums py-0.5 relative z-20"
        />
      ) : (
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium leading-none mb-1 relative z-10">
          {label}
        </span>
      )}

      {/* Bar with value and icon inside */}
      <div
        className="relative w-10 rounded-lg bg-zinc-800/80 transition-all duration-300 flex items-center justify-center"
        style={{ height: "80px" }}
      >
        {/* Green fill */}
        <div
          className={cn(
            "absolute bottom-0 left-0 w-full rounded-lg transition-all duration-300",
            isOver ? "bg-emerald-500" : pct >= 95 ? "bg-emerald-400" : "bg-emerald-500",
          )}
          style={{ height: `${Math.min(100, pct)}%` }}
        />

        {/* Icon — large, subtle, background decoration */}
        {icon && !editing && (
          <div className={cn(
            "absolute z-10 opacity-25 transition-all duration-300",
            isCompleted ? "text-zinc-100" : "text-zinc-500",
          )} style={{ top: "8px" }}>
            {icon}
          </div>
        )}

        {/* Value — centered in the bar, the hero number */}
        {!editing && (
          <div className="relative z-10 flex flex-col items-center">
            <span className={cn(
              "font-bold tabular-nums transition-all duration-300",
              isOver ? "text-white text-sm" : isCompleted ? "text-white text-xs" : "text-zinc-300 text-xs",
            )}>
              {displayValue}
            </span>
            {unit && (
              <span className="text-[8px] text-zinc-400 font-medium">{unit}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
