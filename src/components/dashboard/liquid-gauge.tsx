"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type GaugeActionCallbacks = {
  rollback: () => void;
};

type LiquidGaugeProps = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  size?: number;
  onIncrement?: (amount: number, cbs: GaugeActionCallbacks) => void;
  onDecrement?: (amount: number, cbs: GaugeActionCallbacks) => void;
  tapAmount?: number;
  icon?: React.ReactNode;
  readOnly?: boolean;
};

export function LiquidGauge({
  label,
  value,
  max,
  unit,
  size = 80,
  onIncrement,
  onDecrement,
  tapAmount = 1,
  icon,
  readOnly = false,
}: LiquidGaugeProps) {
  const [optimisticValue, setOptimisticValue] = useState(value);
  const [errorFlash, setErrorFlash] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOptimisticValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  function triggerErrorFlash(snapshot: number) {
    setOptimisticValue(snapshot);
    setErrorFlash(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorFlash(false), 1200);
  }

  const pct = max > 0 ? Math.min((optimisticValue / max) * 100, 150) : 0;
  const fillPct = Math.min(pct, 100);
  const isOver = optimisticValue > max && max > 0;

  const fillColor = isOver
    ? "rgb(56,189,248)" // sky-400
    : pct >= 90
      ? "rgb(52,211,153)" // emerald-400
      : "rgb(16,185,129)"; // emerald-500

  const glowColor = isOver ? "rgba(56,189,248,0.3)" : "transparent";

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);

  function handleClick() {
    if (readOnly) return;
    const snapshot = optimisticValue;
    setOptimisticValue((prev) => prev + tapAmount);
    onIncrement?.(tapAmount, { rollback: () => triggerErrorFlash(snapshot) });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  function handleDecrement(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (readOnly || optimisticValue <= 0) return;
    const snapshot = optimisticValue;
    setOptimisticValue((prev) => Math.max(0, prev - tapAmount));
    onDecrement?.(tapAmount, { rollback: () => triggerErrorFlash(snapshot) });
  }

  const canDecrement = !readOnly && onDecrement != null && optimisticValue > 0;
  const jarWidth = size;
  const jarHeight = Math.round(size * 1.4);

  return (
    <div className="group flex flex-col items-center gap-1.5 select-none">
      {errorFlash && (
        <span className="sr-only" aria-live="assertive" aria-atomic="true">
          Failed to save {label}
        </span>
      )}

      {/* Label */}
      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
        {label}
      </span>

      {/* Jar gauge */}
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        aria-label={
          readOnly
            ? undefined
            : `${label}: ${displayValue}${unit ? ` ${unit}` : ""}. Click to add ${tapAmount}${unit ? ` ${unit}` : ""}.`
        }
        className={cn(
          "relative overflow-hidden transition-all duration-200",
          errorFlash && "ring-2 ring-red-500/80 ring-offset-2 ring-offset-transparent",
          readOnly
            ? "cursor-default opacity-60"
            : "cursor-pointer hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        )}
        style={{
          width: jarWidth,
          height: jarHeight,
          borderRadius: "12px 12px 16px 16px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: isOver ? `0 0 20px ${glowColor}, inset 0 0 15px ${glowColor}` : "none",
        }}
      >
        {/* Fill level */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${fillPct}%`,
            background: `linear-gradient(to top, ${fillColor}, ${fillColor}dd)`,
            borderRadius: "0 0 15px 15px",
            transition: "height 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Wave effect at the top of the fill */}
          <div
            style={{
              position: "absolute",
              top: -4,
              left: -10,
              right: -10,
              height: 10,
              background: `radial-gradient(ellipse at 50% 100%, ${fillColor}88 0%, transparent 70%)`,
              filter: "blur(3px)",
            }}
          />
        </div>

        {/* Icon overlay */}
        {icon && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10"
            aria-hidden="true"
            style={{ top: -8 }}
          >
            <div className="text-white">{icon}</div>
          </div>
        )}

        {/* Value + unit */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="font-bold text-white drop-shadow-sm"
            style={{ fontSize: size * 0.2 }}
          >
            {displayValue}
          </span>
          {unit && (
            <span
              className="text-zinc-400 font-normal"
              style={{ fontSize: size * 0.11, marginTop: -1 }}
            >
              {unit}
            </span>
          )}
        </div>

        {/* Jar lid / cap */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "15%",
            right: "15%",
            height: 5,
            background: "rgba(255,255,255,0.15)",
            borderRadius: "4px 4px 0 0",
          }}
        />
      </div>

      {/* Decrement button */}
      {onDecrement != null && (
        <button
          onClick={handleDecrement}
          aria-label={`Decrease ${label}`}
          disabled={!canDecrement}
          className={cn(
            "h-5 w-8 rounded flex items-center justify-center",
            "border border-white/10 bg-white/5",
            "text-xs font-semibold leading-none text-zinc-400",
            "transition-all duration-150",
            "opacity-0 group-hover:opacity-100",
            "[@media(pointer:coarse)]:opacity-100",
            canDecrement
              ? "cursor-pointer hover:text-zinc-200 hover:border-white/20 hover:bg-white/10"
              : "pointer-events-none opacity-0 group-hover:opacity-0 [@media(pointer:coarse)]:opacity-0",
          )}
        >
          −
        </button>
      )}
    </div>
  );
}
