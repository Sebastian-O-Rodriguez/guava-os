"use client";

interface ProgressRingProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({
  completed,
  total,
  size = 140,
  strokeWidth = 9,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div
        className="relative flex flex-col items-center justify-center"
        style={{ width: size, height: size }}
        role="progressbar"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={0}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
        <div
          className="absolute flex flex-col items-center justify-center"
          style={{ width: size, height: size }}
        >
          <span className="text-sm font-medium text-muted-foreground leading-none">
            No habits
          </span>
          <span className="text-xs text-muted-foreground mt-1 opacity-60">
            today
          </span>
        </div>
      </div>
    );
  }

  const clampedCompleted = Math.min(completed, total);
  const percentage = clampedCompleted / total;
  const isComplete = clampedCompleted >= total;

  const offset = circumference - percentage * circumference;

  const progressColor = isComplete
    ? "oklch(0.696 0.17 162.48)"
    : "var(--chart-1)";

  const center = size / 2;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clampedCompleted}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${clampedCompleted} of ${total} habits completed`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        {/* Background track ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            transition: "stroke-dashoffset 0.5s ease, stroke 0.4s ease",
          }}
        />
      </svg>

      {/* Center label */}
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <span
          className="font-bold leading-none tabular-nums"
          style={{
            fontSize: size * 0.18,
            color: isComplete ? "oklch(0.696 0.17 162.48)" : "var(--foreground)",
            transition: "color 0.4s ease",
          }}
        >
          {clampedCompleted}/{total}
        </span>
        <span
          className="text-xs font-medium mt-1 leading-none"
          style={{ color: "var(--muted-foreground)" }}
        >
          completed
        </span>
      </div>
    </div>
  );
}

export default ProgressRing;
