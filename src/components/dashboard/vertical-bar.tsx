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
  const overRatio = isOver ? optimisticValue / max : 1;
  const isCompleted = mode === "toggle" ? (completed ?? optimisticValue >= max) : pct >= 95;

  // Bar expansion: grows in ALL directions as you go over goal
  // At 1x goal: w-8 (32px), h-80px
  // At 2x goal: fills entire card width and height
  // Smooth continuous scaling between
  const expansionFactor = isOver ? Math.min(overRatio, 3) : 1;
  // Width: 32px → 100% of card (use percentage for width when expanding)
  const widthPct = isOver
    ? Math.min(100, 30 + (expansionFactor - 1) * 35)
    : 30; // ~30% of card when normal
  // Height: 80px base, grows up to 120px
  const barHeight = isOver
    ? Math.min(140, 80 + (expansionFactor - 1) * 30)
    : 80;

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

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (optimisticValue <= 0) return;
    const newVal = Math.max(0, optimisticValue - tapAmount);
    setOptimisticValue(newVal);
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
        "rounded-xl border p-1.5 flex flex-col items-center justify-center gap-1 cursor-pointer select-none overflow-hidden",
        "transition-all duration-300",
        isCompleted
          ? "border-emerald-500/30 bg-zinc-900/60 shadow-[0_0_20px_rgba(52,211,153,0.2)]"
          : "border-zinc-800/50 bg-zinc-900/60",
        !editing && "hover:border-zinc-700 hover:bg-zinc-800/60",
      )}
    >
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
          className="w-full text-center bg-transparent border-b border-zinc-600 text-xs text-foreground outline-none placeholder:text-zinc-600 tabular-nums py-0.5"
        />
      ) : (
        <span className={cn(
          "uppercase tracking-wider font-medium leading-none transition-all duration-300",
          isOver ? "text-[8px] text-zinc-700" : "text-[10px] text-zinc-600",
        )}>
          {label}
        </span>
      )}

      {/* Bar — EXPANDS to fill the card when over goal */}
      <div
        className="relative rounded-lg bg-zinc-800/80 transition-all duration-300 ease-out flex items-center justify-center"
        style={{
          height: `${barHeight}px`,
          width: `${widthPct}%`,
        }}
      >
        <div
          className={cn(
            "absolute bottom-0 left-0 w-full rounded-lg transition-all duration-300 ease-out",
            fillClass,
          )}
          style={{ height: `${Math.min(100, pct)}%` }}
        />
        {icon && !editing && (
          <div className={cn(
            "relative z-10 transition-all duration-300",
            isOver ? "text-emerald-950 scale-125" : "text-emerald-950",
          )}>
            {icon}
          </div>
        )}
      </div>

      <div className={cn(
        "flex flex-col items-center leading-none gap-0 transition-all duration-300",
        isOver ? "opacity-60" : "opacity-100",
      )}>
        <span className="text-[10px] font-medium tabular-nums text-zinc-500">
          {displayValue}
          {unit ? (
            <span className="text-[9px] font-normal text-zinc-600 ml-0.5">
              {unit}
            </span>
          ) : null}
        </span>
        {max > 0 && (
          <span className="text-[9px] text-zinc-600 tabular-nums">
            /{displayMax}
          </span>
        )}
      </div>
    </div>
  );
}
