"use client";

type ProgressBarProps = {
  value: number;
  max: number;
  label: string;
  unit?: string;
  color?: string;
};

export function ProgressBar({ value, max, label, unit, color = "emerald" }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const displayValue = Number.isInteger(value) ? value : value.toFixed(1);
  const displayMax = Number.isInteger(max) ? max : max.toFixed(1);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {displayValue}/{displayMax}{unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            color === "emerald"
              ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
              : color === "blue"
              ? "bg-gradient-to-r from-blue-600 to-blue-400"
              : color === "amber"
              ? "bg-gradient-to-r from-amber-600 to-amber-400"
              : "bg-gradient-to-r from-emerald-600 to-emerald-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
