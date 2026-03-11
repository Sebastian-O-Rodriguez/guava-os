"use client";

interface ProgressRingProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  /** Optional daily score to display in celebration state */
  score?: number | null;
}

export function ProgressRing({
  completed,
  total,
  size = 140,
  strokeWidth = 9,
  score,
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
            Rest day
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
    : "oklch(0.765 0.177 163.22)";

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
      {/* Glow effect when complete */}
      {isComplete && (
        <div className="absolute inset-0 rounded-full animate-pulse shadow-glow-emerald" />
      )}

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
            ...(isComplete
              ? {
                  filter: "drop-shadow(0 0 6px oklch(0.696 0.17 162.48 / 0.5))",
                }
              : {}),
          }}
        />
      </svg>

      {/* Center label */}
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        {isComplete && score != null ? (
          <>
            <span
              className="font-bold leading-none tabular-nums"
              style={{
                fontSize: size * 0.2,
                color: "oklch(0.696 0.17 162.48)",
                transition: "color 0.4s ease",
              }}
            >
              +{score}
            </span>
            <span
              className="text-xs font-bold mt-0.5 leading-none uppercase tracking-wider"
              style={{ color: "oklch(0.696 0.17 162.48 / 0.7)" }}
            >
              xp
            </span>
          </>
        ) : (
          <>
            <span
              className="font-bold leading-none tabular-nums"
              style={{
                fontSize: size * 0.18,
                color: isComplete
                  ? "oklch(0.696 0.17 162.48)"
                  : "var(--foreground)",
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
          </>
        )}
      </div>
    </div>
  );
}
