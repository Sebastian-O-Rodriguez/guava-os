"use client";

import { useRef, useState, useTransition } from "react";

type VerticalBarProps = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  mode: "increment" | "toggle";
  onIncrement?: (amount: number) => void;
  onToggle?: () => void;
  completed?: boolean;
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
}: VerticalBarProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const isFull = pct >= 100;
  const isCompleted = mode === "toggle" ? (completed ?? value >= max) : isFull;

  const displayValue = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const displayMax = Number.isInteger(max) ? String(max) : max.toFixed(1);

  function handleClick() {
    if (mode === "toggle") {
      if (onToggle) {
        startTransition(() => {
          onToggle();
        });
      }
    } else {
      setEditing(true);
      setInputVal("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const num = parseFloat(inputVal);
      if (!isNaN(num) && num > 0 && onIncrement) {
        startTransition(() => {
          onIncrement(num);
        });
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
          ? "border-emerald-500/30 bg-zinc-900/60 shadow-[0_0_12px_rgba(52,211,153,0.08)]"
          : "border-zinc-800/50 bg-zinc-900/60",
        !editing && "hover:border-zinc-700 hover:bg-zinc-800/60",
        isPending && "opacity-70",
      ].join(" ")}
    >
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
      <div className="relative w-3 rounded-full bg-zinc-800" style={{ height: "80px" }}>
        <div
          className={[
            "absolute bottom-0 left-0 w-full rounded-full transition-all duration-500",
            isCompleted
              ? "bg-emerald-400"
              : "bg-gradient-to-t from-emerald-700 to-emerald-500",
          ].join(" ")}
          style={{ height: `${pct}%` }}
        />
      </div>

      {/* Value */}
      <div className="flex flex-col items-center leading-none gap-0.5">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {displayValue}
          {unit ? <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span> : null}
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
