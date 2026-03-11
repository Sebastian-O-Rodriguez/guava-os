"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { habitAppliesToDate, normalizeDate } from "@/lib/habits";
import { getOrCreateUser } from "@/lib/user";
import type {
  ActionResult,
  FrequencyConfig,
  MonthlyGridData,
  MonthlyGridRow,
  CellStatus,
  OverallStreaks,
  DashboardStats,
  TrendPoint,
  HabitSparkline,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Toggle a completion for a habit on a given date.
 *
 * If a completion row exists it is deleted (un-completed).
 * If none exists one is created (completed).
 *
 * Returns `{ completed: boolean }` reflecting the new state.
 */
export async function toggleCompletion(
  habitId: string,
  date: Date,
): Promise<{ completed: boolean } | { error: string }> {
  if (!habitId || typeof habitId !== "string") {
    return { error: "Invalid habit id" };
  }

  const normalized = normalizeDate(date);

  const existing = await prisma.completion.findUnique({
    where: {
      habitId_date: { habitId, date: normalized },
    },
  });

  if (existing) {
    await prisma.completion.delete({ where: { id: existing.id } });
    revalidatePath("/");
    revalidatePath("/monthly");
    return { completed: false };
  }

  await prisma.completion.create({
    data: {
      habitId,
      date: normalized,
      completed: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/monthly");
  return { completed: true };
}

/**
 * All completions for a single calendar date (across every habit).
 * Used by the Today view.
 */
export async function getCompletionsForDate(date: Date) {
  const normalized = normalizeDate(date);

  return prisma.completion.findMany({
    where: { date: normalized },
    include: { habit: true },
  });
}

/**
 * All completions within a calendar month.
 * Used by the Monthly Grid view.
 *
 * Returns a flat array — the caller can group by date or habitId as needed.
 */
export async function getCompletionsForMonth(year: number, month: number) {
  // month is 1-based (Jan = 1)
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // first day of *next* month

  return prisma.completion.findMany({
    where: {
      date: { gte: start, lt: end },
    },
    include: { habit: true },
  });
}

/**
 * Daily progress stats for a single date.
 *
 * `total`     — active habits whose frequency matches the given date.
 * `completed` — number of those habits that have a completion row.
 */
export async function getDailyProgress(
  date: Date,
): Promise<{ completed: number; total: number }> {
  const userId = await getOrCreateUser();
  const normalized = normalizeDate(date);

  // Fetch all active habits for the user.
  const habits = await prisma.habit.findMany({
    where: { userId, active: true },
  });

  // Filter to habits that apply on this day-of-week.
  const applicableHabits = habits.filter((h) =>
    habitAppliesToDate(h.frequency, normalized),
  );

  if (applicableHabits.length === 0) {
    return { completed: 0, total: 0 };
  }

  const applicableIds = applicableHabits.map((h) => h.id);

  // Count completions among applicable habits only.
  const completedCount = await prisma.completion.count({
    where: {
      habitId: { in: applicableIds },
      date: normalized,
    },
  });

  return { completed: completedCount, total: applicableHabits.length };
}

/**
 * Streak stats for a single habit.
 *
 * currentStreak  — consecutive days completed ending today (or yesterday if
 *                  today is not yet completed).
 * longestStreak  — the longest consecutive run found in the completion history.
 */
export async function getStreaks(
  habitId: string,
): Promise<{ currentStreak: number; longestStreak: number }> {
  // Pull every completion for this habit, oldest first.
  const completions = await prisma.completion.findMany({
    where: { habitId },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  if (completions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Build a Set of date strings for O(1) lookups.
  const dateSet = new Set<string>(
    completions.map((c) => normalizeDate(c.date).toISOString()),
  );

  // Also load the habit's frequency so we only count applicable days.
  const habit = await prisma.habit.findUnique({
    where: { id: habitId },
    select: { frequency: true },
  });

  const frequency = habit?.frequency ?? { type: "daily" };

  const today = normalizeDate(new Date());
  const ONE_DAY = 86_400_000;

  // --- Current streak ---
  // Start from today or yesterday (whichever has a completion) and walk back.
  let currentStreak = 0;
  let cursor = today;

  // Oldest completion date used as lower bound for all safety checks.
  const oldestDate = normalizeDate(completions[0].date);
  const safetyFloor = oldestDate.getTime() - ONE_DAY * 7;

  // If today is not applicable, step back to the last applicable day.
  // Safety: cap at 7 days back to prevent infinite loop on malformed frequency.
  let safetyCount = 0;
  while (!habitAppliesToDate(frequency, cursor) && safetyCount < 7) {
    cursor = new Date(cursor.getTime() - ONE_DAY);
    safetyCount++;
  }

  // Allow starting from yesterday if today isn't completed yet.
  if (!dateSet.has(cursor.toISOString())) {
    cursor = new Date(cursor.getTime() - ONE_DAY);
    // Skip non-applicable days again.
    safetyCount = 0;
    while (!habitAppliesToDate(frequency, cursor) && safetyCount < 7) {
      cursor = new Date(cursor.getTime() - ONE_DAY);
      safetyCount++;
    }
  }

  // Walk backwards counting consecutive applicable completed days.
  while (dateSet.has(cursor.toISOString())) {
    currentStreak++;
    // Step to the previous applicable day.
    cursor = new Date(cursor.getTime() - ONE_DAY);
    safetyCount = 0;
    while (!habitAppliesToDate(frequency, cursor) && safetyCount < 7) {
      cursor = new Date(cursor.getTime() - ONE_DAY);
      safetyCount++;
      // Safety: don't loop past the earliest possible date.
      if (cursor.getTime() < safetyFloor) {
        break;
      }
    }
  }

  // --- Longest streak ---
  // Walk all completion dates (sorted ascending) and track streaks.
  let longestStreak = 0;
  let runLength = 0;
  let prevDate: Date | null = null;

  for (const c of completions) {
    const d = normalizeDate(c.date);

    if (prevDate === null) {
      runLength = 1;
    } else {
      // Count applicable days between prevDate and d (exclusive of both endpoints).
      let expected = new Date(prevDate.getTime() + ONE_DAY);
      let gap = false;

      while (expected.getTime() < d.getTime()) {
        if (habitAppliesToDate(frequency, expected)) {
          // There is an applicable day between prevDate and d that was missed.
          gap = true;
          break;
        }
        expected = new Date(expected.getTime() + ONE_DAY);
      }

      if (gap) {
        runLength = 1;
      } else {
        runLength++;
      }
    }

    if (runLength > longestStreak) {
      longestStreak = runLength;
    }

    prevDate = d;
  }

  return { currentStreak, longestStreak };
}

// ---------------------------------------------------------------------------
// Monthly Grid
// ---------------------------------------------------------------------------

/**
 * Full monthly grid data for the given year/month (1-based month).
 *
 * Each row represents one active habit. Each day cell is one of:
 *   "completed" — habit was done on that day
 *   "missed"    — habit was applicable but not done
 *   "na"        — future day, or frequency doesn't apply on that weekday
 */
export async function getMonthlyGridData(
  year: number,
  month: number,
): Promise<ActionResult<MonthlyGridData>> {
  try {
    const userId = await getOrCreateUser();

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1)); // first day of next month

    const [habits, completions] = await Promise.all([
      prisma.habit.findMany({
        where: { userId, active: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.completion.findMany({
        where: { date: { gte: start, lt: end } },
        select: { habitId: true, date: true },
      }),
    ]);

    // O(1) lookup set keyed as "habitId|YYYY-MM-DD"
    const completionSet = new Set<string>(
      completions.map((c) => {
        const iso = normalizeDate(c.date).toISOString().slice(0, 10);
        return `${c.habitId}|${iso}`;
      }),
    );

    const today = normalizeDate(new Date());
    // days in the month: new Date(UTC(year, month, 0)) is last day of the month
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const rows: MonthlyGridRow[] = habits.map((habit) => {
      const days: CellStatus[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month - 1, day));

        // Future days are always "na"
        if (date.getTime() > today.getTime()) {
          days.push("na");
          continue;
        }

        // Days the habit doesn't apply on are "na"
        if (!habitAppliesToDate(habit.frequency, date)) {
          days.push("na");
          continue;
        }

        const iso = date.toISOString().slice(0, 10);
        days.push(completionSet.has(`${habit.id}|${iso}`) ? "completed" : "missed");
      }

      return {
        habitId: habit.id,
        habitName: habit.name,
        frequency: habit.frequency as unknown as FrequencyConfig,
        days,
      };
    });

    return {
      success: true,
      data: { year, month, daysInMonth, rows },
    };
  } catch (err) {
    console.error("getMonthlyGridData error:", err);
    return { success: false, error: "Failed to load monthly grid data" };
  }
}

// ---------------------------------------------------------------------------
// Overall Streaks
// ---------------------------------------------------------------------------

/**
 * Aggregated streak stats across all active habits.
 *
 * currentStreak  — max currentStreak among all habits
 * longestStreak  — max longestStreak among all habits
 * bestHabitName  — name of the habit with the highest current streak (null if none)
 */
export async function getOverallStreaks(): Promise<ActionResult<OverallStreaks>> {
  try {
    const userId = await getOrCreateUser();

    const habits = await prisma.habit.findMany({
      where: { userId, active: true },
      select: { id: true, name: true },
    });

    if (habits.length === 0) {
      return {
        success: true,
        data: { currentStreak: 0, longestStreak: 0, bestHabitName: null },
      };
    }

    const streakResults = await Promise.all(
      habits.map(async (habit) => {
        const streaks = await getStreaks(habit.id);
        return { name: habit.name, ...streaks };
      }),
    );

    let currentStreak = 0;
    let longestStreak = 0;
    let bestHabitName: string | null = null;

    for (const result of streakResults) {
      if (result.currentStreak > currentStreak) {
        currentStreak = result.currentStreak;
        bestHabitName = result.name;
      }
      if (result.longestStreak > longestStreak) {
        longestStreak = result.longestStreak;
      }
    }

    return {
      success: true,
      data: { currentStreak, longestStreak, bestHabitName },
    };
  } catch (err) {
    console.error("getOverallStreaks error:", err);
    return { success: false, error: "Failed to load overall streaks" };
  }
}

// ---------------------------------------------------------------------------
// Dashboard Stats
// ---------------------------------------------------------------------------

/**
 * Aggregated completion stats for the progress dashboard.
 *
 * Uses a SINGLE Prisma findMany for all completions in the window, then
 * computes everything in-process:
 *   - trend:        TrendPoint per day (rate, completed, total)
 *   - weeklyRate:   completion % for last 7 days
 *   - monthlyRate:  completion % for the full window
 *   - sparklines:   per-habit daily points + currentStreak
 *
 * @param days Number of calendar days to look back (default 30). Today is included.
 */
export async function getDashboardStats(
  days = 30,
): Promise<ActionResult<DashboardStats>> {
  try {
    const userId = await getOrCreateUser();
    const today = normalizeDate(new Date());
    const ONE_DAY = 86_400_000;

    // Build the date window: [windowStart … today], inclusive.
    const windowStart = new Date(today.getTime() - (days - 1) * ONE_DAY);

    const [habits, completions] = await Promise.all([
      prisma.habit.findMany({
        where: { userId, active: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.completion.findMany({
        where: {
          date: { gte: windowStart, lte: today },
          habit: { userId, active: true },
        },
        select: { habitId: true, date: true },
      }),
    ]);

    // O(1) lookup set keyed as "habitId|YYYY-MM-DD"
    const completionSet = new Set<string>(
      completions.map((c) => {
        const iso = normalizeDate(c.date).toISOString().slice(0, 10);
        return `${c.habitId}|${iso}`;
      }),
    );

    // Build the ordered list of dates in the window (ascending).
    const dateWindow: Date[] = [];
    for (let i = 0; i < days; i++) {
      dateWindow.push(new Date(windowStart.getTime() + i * ONE_DAY));
    }

    // --- Trend points ---
    const trend: TrendPoint[] = dateWindow.map((date) => {
      const iso = date.toISOString().slice(0, 10);
      let applicable = 0;
      let completed = 0;

      for (const habit of habits) {
        if (habitAppliesToDate(habit.frequency, date)) {
          applicable++;
          if (completionSet.has(`${habit.id}|${iso}`)) {
            completed++;
          }
        }
      }

      return {
        date: iso,
        rate: applicable > 0 ? Math.round((completed / applicable) * 100) / 100 : null,
        completed,
        total: applicable,
      };
    });

    // --- weeklyRate: last 7 days ---
    const last7 = trend.slice(-7);
    const weeklyApplicable = last7.reduce((sum, p) => sum + p.total, 0);
    const weeklyCompleted = last7.reduce((sum, p) => sum + p.completed, 0);
    const weeklyRate =
      weeklyApplicable > 0
        ? Math.round((weeklyCompleted / weeklyApplicable) * 100) / 100
        : null;

    // --- monthlyRate: full window ---
    const windowApplicable = trend.reduce((sum, p) => sum + p.total, 0);
    const windowCompleted = trend.reduce((sum, p) => sum + p.completed, 0);
    const monthlyRate =
      windowApplicable > 0
        ? Math.round((windowCompleted / windowApplicable) * 100) / 100
        : null;

    // --- Sparklines: per-habit points + currentStreak computed inline ---
    const sparklines: HabitSparkline[] = habits.map((habit) => {
      const points = dateWindow.map((date) => {
        const iso = date.toISOString().slice(0, 10);
        const applicable = habitAppliesToDate(habit.frequency, date);
        const completed = applicable && completionSet.has(`${habit.id}|${iso}`);
        return { date: iso, completed, applicable };
      });

      // Current streak: walk backwards from today through the window.
      let currentStreak = 0;
      let cursor = today;

      // Walk back to the most recent applicable day.
      let safety = 0;
      while (
        cursor.getTime() >= windowStart.getTime() &&
        !habitAppliesToDate(habit.frequency, cursor) &&
        safety < 7
      ) {
        cursor = new Date(cursor.getTime() - ONE_DAY);
        safety++;
      }

      // If today's applicable day isn't completed, try starting from yesterday.
      const cursorIso = cursor.toISOString().slice(0, 10);
      if (!completionSet.has(`${habit.id}|${cursorIso}`)) {
        cursor = new Date(cursor.getTime() - ONE_DAY);
        safety = 0;
        while (
          cursor.getTime() >= windowStart.getTime() &&
          !habitAppliesToDate(habit.frequency, cursor) &&
          safety < 7
        ) {
          cursor = new Date(cursor.getTime() - ONE_DAY);
          safety++;
        }
      }

      // Count consecutive completed applicable days backwards.
      while (cursor.getTime() >= windowStart.getTime()) {
        if (!habitAppliesToDate(habit.frequency, cursor)) {
          cursor = new Date(cursor.getTime() - ONE_DAY);
          continue;
        }
        const iso = cursor.toISOString().slice(0, 10);
        if (!completionSet.has(`${habit.id}|${iso}`)) break;
        currentStreak++;
        cursor = new Date(cursor.getTime() - ONE_DAY);
      }

      return {
        habitId: habit.id,
        name: habit.name,
        currentStreak,
        points,
      };
    });

    return {
      success: true,
      data: { weeklyRate, monthlyRate, trend, sparklines },
    };
  } catch (err) {
    console.error("getDashboardStats error:", err);
    return { success: false, error: "Failed to load dashboard stats" };
  }
}
