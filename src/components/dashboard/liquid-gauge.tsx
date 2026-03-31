"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const LiquidFillGauge = dynamic(() => import("react-liquid-gauge"), {
  ssr: false,
  loading: () => <div className="rounded-full bg-zinc-800/80" style={{ width: 80, height: 80 }} />,
});

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

  // Clean up timer on unmount
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

  const pct = max > 0 ? (optimisticValue / max) * 100 : 0;
  const isOver = optimisticValue > max && max > 0;

  // Fill color shifts: emerald → amber when over
  const fillColor = isOver
    ? "rgb(56,189,248)" // sky-400
    : pct >= 90
      ? "rgb(52,211,153)" // emerald-400
      : "rgb(16,185,129)"; // emerald-500

  const ringColor = isOver
    ? "rgb(30,58,82)" // dark blue tint
    : "rgb(39,39,42)"; // zinc-800

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

  return (
    <div className="group flex flex-col items-center gap-1 select-none">
      {errorFlash && (
        <span className="sr-only" aria-live="assertive" aria-atomic="true">
          Failed to save {label}
        </span>
      )}
      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
        {label}
      </span>

      {/* Gauge — tap/click to increment */}
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
          "relative rounded-full transition-all duration-150",
          errorFlash && "ring-2 ring-red-500/80 ring-offset-2 ring-offset-zinc-900",
          readOnly
            ? "cursor-default opacity-75"
            : "cursor-pointer hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
        )}
      >
        <LiquidFillGauge
          width={size}
          height={size}
          value={Math.min(100, pct)}
          percent=""
          textSize={0.6}
          textRenderer={() => (
            <tspan>
              <tspan
                style={{
                  fontSize: size * 0.18,
                  fontWeight: 700,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                }}
              >
                {displayValue}
              </tspan>
              {unit && (
                <tspan
                  style={{
                    fontSize: size * 0.1,
                    fontWeight: 400,
                    fill: "rgb(161,161,170)",
                  }}
                >
                  {` ${unit}`}
                </tspan>
              )}
            </tspan>
          )}
          riseAnimation
          riseAnimationTime={800}
          riseAnimationEasing="cubicInOut"
          waveAnimation
          waveFrequency={2}
          waveAmplitude={1}
          waveAnimationTime={3000}
          innerRadius={0.92}
          outerRadius={1}
          margin={0.02}
          circleStyle={{ fill: ringColor }}
          waveStyle={{ fill: fillColor }}
          textStyle={{ fill: "rgb(161,161,170)" }}
          waveTextStyle={{ fill: "rgb(255,255,255)" }}
        />

        {/* Icon overlay — decorative, centered */}
        {icon && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15"
            aria-hidden="true"
          >
            <div className="text-zinc-100 mt-[-8px]">{icon}</div>
          </div>
        )}
      </div>

      {/*
        Decrement button.
        Pointer devices: hidden until the card is hovered.
        Touch/coarse-pointer devices: always visible.
        Hidden entirely when decrement is unavailable.
      */}
      {onDecrement != null && (
        <button
          onClick={handleDecrement}
          aria-label={`Decrease ${label}`}
          disabled={!canDecrement}
          className={cn(
            "h-5 w-8 rounded flex items-center justify-center",
            "border border-zinc-800 bg-transparent",
            "text-xs font-semibold leading-none text-zinc-400",
            "transition-all duration-150",
            // Pointer devices: fade in on hover
            "opacity-0 group-hover:opacity-100",
            // Touch devices: always visible
            "[@media(pointer:coarse)]:opacity-100",
            canDecrement
              ? "cursor-pointer hover:text-zinc-300 hover:border-zinc-600"
              : "pointer-events-none opacity-0 group-hover:opacity-0 [@media(pointer:coarse)]:opacity-0",
          )}
        >
          −
        </button>
      )}
    </div>
  );
}
