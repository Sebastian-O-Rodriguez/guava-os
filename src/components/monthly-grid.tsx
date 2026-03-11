"use client";

import { useOptimistic, useTransition } from "react";
import { toggleCompletion } from "@/actions/completions";
import { cn } from "@/lib/utils";
import type { MonthlyGridProps, CellStatus } from "@/lib/types";

// Derive the UTC day-of-month from a todayISO string so we can highlight
// the current column without any timezone drift.
function todayDayFromISO(todayISO: string, year: number, month: number): number | null {
  // todayISO is produced by normalizeDate (midnight UTC).
  const d = new Date(todayISO);
  if (d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month) {
    return d.getUTCDate();
  }
  return null;
}

// Build an ISO date string (YYYY-MM-DD at midnight UTC) for a given cell.
function cellDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// A key used to track optimistic state: "habitId::YYYY-MM-DD"
function cellKey(habitId: string, year: number, month: number, day: number): string {
  const d = cellDate(year, month, day);
  return `${habitId}::${d.toISOString().slice(0, 10)}`;
}

// ---- Visual helpers -------------------------------------------------------

const STATUS_CLASSES: Record<CellStatus, string> = {
  completed:
    "bg-emerald-500 border-emerald-500 hover:bg-emerald-400 hover:border-emerald-400",
  missed:
    "bg-zinc-700 border-zinc-600 hover:bg-rose-900/60 hover:border-rose-700/70",
  na: "bg-transparent border-transparent cursor-default",
};

const INTERACTIVE_STATUSES = new Set<CellStatus>(["completed", "missed"]);

// ---- Component ------------------------------------------------------------

export function MonthlyGrid({ data, todayISO }: MonthlyGridProps) {
  const { year, month, daysInMonth, rows } = data;

  // todayDay is 1-based, or null when viewing a different month.
  const todayDay = todayDayFromISO(todayISO, year, month);

  // Today as a UTC Date for future-cell detection.
  const todayUTC = new Date(todayISO);

  // Optimistic state: a Set of keys whose status has been flipped locally.
  // When a key is in this set, its displayed status is toggled vs. server data.
  const [flipped, setFlipped] = useOptimistic<Set<string>>(new Set());

  const [, startTransition] = useTransition();

  function handleCellClick(
    habitId: string,
    day: number,
    serverStatus: CellStatus,
  ) {
    if (!INTERACTIVE_STATUSES.has(serverStatus)) return;

    const key = cellKey(habitId, year, month, day);

    startTransition(async () => {
      setFlipped((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });

      await toggleCompletion(habitId, cellDate(year, month, day));
    });
  }

  // Resolve a cell's displayed status, accounting for optimistic flips.
  function resolvedStatus(
    habitId: string,
    day: number,
    serverStatus: CellStatus,
  ): CellStatus {
    if (!INTERACTIVE_STATUSES.has(serverStatus)) return serverStatus;
    const key = cellKey(habitId, year, month, day);
    if (!flipped.has(key)) return serverStatus;
    return serverStatus === "completed" ? "missed" : "completed";
  }

  // Day column indices (1 to daysInMonth).
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Month label for the header (e.g. "March 2026")
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-card py-16 text-center">
        <p className="text-base font-medium text-foreground">No active habits</p>
        <p className="text-sm text-muted-foreground">
          Add habits on the Today page to see your monthly grid.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-card overflow-hidden">
      {/* Scrollable grid wrapper — first column is sticky */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${200 + daysInMonth * 36}px` }}>
          <thead>
            <tr className="border-b border-border">
              {/* Sticky habit-name header cell */}
              <th
                className={cn(
                  "sticky left-0 z-10 bg-card px-4 py-3 text-left",
                  "w-48 min-w-[11rem] text-xs font-semibold uppercase tracking-widest text-muted-foreground",
                )}
              >
                {monthLabel}
              </th>

              {/* Day number headers */}
              {days.map((day) => {
                const isToday = day === todayDay;
                // Is this day in the future relative to today?
                const dayUTC = cellDate(year, month, day);
                const isFuture = dayUTC > todayUTC;

                return (
                  <th
                    key={day}
                    className={cn(
                      "w-8 min-w-[2rem] px-0 py-3 text-center",
                      "text-xs font-medium",
                      isToday
                        ? "text-emerald-400 font-bold"
                        : isFuture
                          ? "text-muted-foreground/40"
                          : "text-muted-foreground",
                    )}
                  >
                    {day}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={row.habitId}
                className={cn(
                  "group transition-colors",
                  rowIdx !== rows.length - 1 && "border-b border-border",
                  "hover:bg-muted/20",
                )}
              >
                {/* Sticky habit name */}
                <td
                  className={cn(
                    "sticky left-0 z-10 bg-card px-4 py-2 transition-colors",
                    "group-hover:bg-muted/20",
                  )}
                >
                  <span
                    className="block max-w-[10rem] truncate text-sm font-medium text-foreground"
                    title={row.habitName}
                  >
                    {row.habitName}
                  </span>
                </td>

                {/* Day cells */}
                {days.map((day) => {
                  const serverStatus = row.days[day - 1];
                  const status = resolvedStatus(row.habitId, day, serverStatus);
                  const interactive = INTERACTIVE_STATUSES.has(serverStatus);

                  // Future days that are "na" because they haven't happened yet
                  // get a slightly different treatment than frequency-mismatch "na".
                  const dayUTC = cellDate(year, month, day);
                  const isFutureDay = dayUTC > todayUTC;
                  const isTodayCol = day === todayDay;

                  return (
                    <td
                      key={day}
                      className={cn(
                        "px-1 py-2 text-center",
                        isTodayCol && "bg-emerald-950/20",
                      )}
                    >
                      <button
                        type="button"
                        disabled={!interactive}
                        onClick={() =>
                          handleCellClick(row.habitId, day, serverStatus)
                        }
                        aria-label={
                          interactive
                            ? `${status === "completed" ? "Unmark" : "Mark"} ${row.habitName} on day ${day}`
                            : undefined
                        }
                        className={cn(
                          // Base cell shape
                          "mx-auto flex size-7 items-center justify-center rounded-md border transition-all duration-150",
                          // Status-specific colors
                          STATUS_CLASSES[status],
                          // Interactive hover scale
                          interactive &&
                            "cursor-pointer hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                          // NA future vs. NA frequency-mismatch
                          status === "na" && isFutureDay && "opacity-20",
                          status === "na" && !isFutureDay && "opacity-0",
                        )}
                      >
                        {status === "completed" && (
                          <svg
                            className="size-3.5 text-white"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="1.5,6 4.5,9 10.5,3" />
                          </svg>
                        )}
                        {status === "missed" && (
                          <span className="block size-1.5 rounded-full bg-zinc-400" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 border-t border-border px-4 py-3">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex size-4 items-center justify-center rounded bg-emerald-500">
            <svg
              className="size-2.5 text-white"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1.5,6 4.5,9 10.5,3" />
            </svg>
          </span>
          Completed
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex size-4 items-center justify-center rounded bg-zinc-700">
            <span className="block size-1.5 rounded-full bg-zinc-400" />
          </span>
          Missed
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-4 rounded border border-border opacity-30" />
          Not applicable
        </span>
      </div>
    </div>
  );
}
