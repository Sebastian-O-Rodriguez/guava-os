"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const LiquidFillGauge = dynamic(() => import("react-liquid-gauge"), {
  ssr: false,
  loading: () => <div className="rounded-full bg-zinc-800/80" style={{ width: 90, height: 90 }} />,
});

type LiquidGaugeProps = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  size?: number;
  onIncrement?: (amount: number) => void;
  onDecrement?: (amount: number) => void;
  tapAmount?: number;
  icon?: React.ReactNode;
};

export function LiquidGauge({
  label,
  value,
  max,
  unit,
  size = 90,
  onIncrement,
  onDecrement,
  tapAmount = 1,
  icon,
}: LiquidGaugeProps) {
  const [optimisticValue, setOptimisticValue] = useState(value);

  useEffect(() => {
    setOptimisticValue(value);
  }, [value]);

  const pct = max > 0 ? (optimisticValue / max) * 100 : 0;
  const isOver = optimisticValue > max && max > 0;

  // Fill color shifts: emerald → amber when over
  const fillColor = isOver
    ? "rgb(56,189,248)"   // sky-400
    : pct >= 90
      ? "rgb(52,211,153)" // emerald-400
      : "rgb(16,185,129)"; // emerald-500

  const ringColor = isOver
    ? "rgb(30,58,82)"     // dark blue tint
    : "rgb(39,39,42)";    // zinc-800

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);

  function handleClick() {
    setOptimisticValue((prev) => prev + tapAmount);
    onIncrement?.(tapAmount);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (optimisticValue <= 0) return;
    setOptimisticValue((prev) => Math.max(0, prev - tapAmount));
    onDecrement?.(tapAmount);
  }

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "flex flex-col items-center gap-1.5 cursor-pointer select-none",
        "transition-all duration-200",
        "hover:scale-105 active:scale-95",
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
        {label}
      </span>

      <div className="relative">
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

        {/* Icon overlay — subtle, centered */}
        {icon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
            <div className="text-zinc-100 mt-[-8px]">{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}
