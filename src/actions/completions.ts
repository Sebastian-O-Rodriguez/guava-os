"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  habitAppliesToDate,
  habitShowsOnDate,
  normalizeDate,
  getWeekStart,
  getWeekEnd,
  isWeeklyTarget,
  isScheduled,
} from "@/lib/habits";
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
  WeeklyProgress,
  OverdueHabit,
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

  try {
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
      revalidatePath("/progress");
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
    revalidatePath("/progress");
    return { completed: true };
  } catch (err) {
    console.error("toggleCompletion error:", err);
    return { error: "Failed to toggle completion" };
  }
}

/**
 * All completions for a single calendar date (across every habit).
 * Used by the Today view.
 */
export async function getCompletionsForDate(date: Date) {
  try {
    const normalized = normalizeDate(date);

    return await prisma.completion.findMany({
      where: { date: normalized },
      select: { habitId: true },
    });
  } catch (err) {
    console.error("getCompletionsForDate error:", err);
    return [];
  }
}

/**
 * All completions within a calendar month.
 * Used by the Monthly Grid view.
 *
 * Returns a flat array — the caller can group by date or habitId as needed.
 */
export async function getCompletionsForMonth(year: number, month: number) {
  try {
    // month is 1-based (Jan = 1)
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1)); // first day of *next* month

    return await prisma.completion.findMany({
      where: {
        date: { gte: start, lt: end },
      },
      select: { habitId: true, date: true },
    });
  } catch (err) {
    console.error("getCompletionsForMonth error:", err);
    return [];
  }
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

  // Filter to habits that show on the Today page for this date.
  const applicableHabits = habits.filter((h) =>
    habitShowsOnDate(h.frequency, normalized),
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
 * Batch streak fetch for all active habits. Used by the Today page.
 * Returns a Map-like array of { habitId, currentStreak }.
 * Uses a single query for all completions instead of N+1.
 */
export async function getStreaksForActiveHabits(): Promise<
  Array<{ habitId: string; currentStreak: number }>
> {
  try {
    const userId = await getOrCreateUser();

    const habits = await prisma.habit.findMany({
      where: { userId, active: true },
      select: { id: true, frequency: true },
    });

    if (habits.length === 0) return [];

    const today = normalizeDate(new Date());
    const ONE_DAY = 86_400_000;
    // Look back 120 days max for streak calculation
    const lookback = new Date(today.getTime() - 120 * ONE_DAY);

    const completions = await prisma.completion.findMany({
      where: {
        habitId: { in: habits.map((h) => h.id) },
        date: { gte: lookback, lte: today },
      },
      select: { habitId: true, date: true },
    });

    // Group completions by habitId as date-string sets
    const completionsByHabit = new Map<string, Set<string>>();
    for (const c of completions) {
      const iso = normalizeDate(c.date).toISOString();
      if (!completionsByHabit.has(c.habitId)) {
        completionsByHabit.set(c.habitId, new Set());
      }
      completionsByHabit.get(c.habitId)!.add(iso);
    }

    return habits.map((habit) => {
      const dateSet = completionsByHabit.get(habit.id) ?? new Set();
      const frequency = habit.frequency ?? { type: "daily" };

      let currentStreak = 0;
      let cursor = today;

      // Walk back to the most recent applicable day
      let safety = 0;
      while (!habitAppliesToDate(frequency, cursor) && safety < 7) {
        cursor = new Date(cursor.getTime() - ONE_DAY);
        safety++;
      }

      // If today's applicable day isn't completed, try starting from yesterday
      if (!dateSet.has(cursor.toISOString())) {
        cursor = new Date(cursor.getTime() - ONE_DAY);
        safety = 0;
        while (!habitAppliesToDate(frequency, cursor) && safety < 7) {
          cursor = new Date(cursor.getTime() - ONE_DAY);
          safety++;
        }
      }

      // Count consecutive completed applicable days backwards
      while (cursor.getTime() >= lookback.getTime()) {
        if (!habitAppliesToDate(frequency, cursor)) {
          cursor = new Date(cursor.getTime() - ONE_DAY);
          continue;
        }
        if (!dateSet.has(cursor.toISOString())) break;
        currentStreak++;
        cursor = new Date(cursor.getTime() - ONE_DAY);
      }

      return { habitId: habit.id, currentStreak };
    });
  } catch (err) {
    console.error("getStreaksForActiveHabits error:", err);
    return [];
  }
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
 *   "completed" — habit was done on that day (on time)
 *   "late"      — habit was completed but after its scheduled date
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
        select: { habitId: true, date: true, createdAt: true },
      }),
    ]);

    // O(1) lookup: "habitId|YYYY-MM-DD" → completion date
    const completionMap = new Map<string, { date: Date; createdAt: Date }>();
    for (const c of completions) {
      const iso = normalizeDate(c.date).toISOString().slice(0, 10);
      completionMap.set(`${c.habitId}|${iso}`, {
        date: normalizeDate(c.date),
        createdAt: c.createdAt,
      });
    }

    const today = normalizeDate(new Date());
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const rows: MonthlyGridRow[] = habits.map((habit) => {
      const freq = habit.frequency as unknown as FrequencyConfig;
      const days: CellStatus[] = [];

      // For weekly target habits, count completions per week
      // For scheduled/daily, use day-level logic
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month - 1, day));

        // Future days are always "na"
        if (date.getTime() > today.getTime()) {
          days.push("na");
          continue;
        }

        if (isWeeklyTarget(freq)) {
          // Weekly habits: show completion on actual days they were done
          const iso = date.toISOString().slice(0, 10);
          const key = `${habit.id}|${iso}`;
          days.push(completionMap.has(key) ? "completed" : "na");
        } else {
          // Scheduled/daily: check if habit applies on this day
          if (!habitAppliesToDate(freq, date)) {
            // Check if there's a late completion recorded on this day
            const iso = date.toISOString().slice(0, 10);
            const key = `${habit.id}|${iso}`;
            if (completionMap.has(key)) {
              days.push("late");
            } else {
              days.push("na");
            }
            continue;
          }

          const iso = date.toISOString().slice(0, 10);
          const key = `${habit.id}|${iso}`;
          if (completionMap.has(key)) {
            // Check if it was completed late (createdAt date differs from scheduled date)
            const completion = completionMap.get(key)!;
            const createdDay = normalizeDate(completion.createdAt);
            if (createdDay.getTime() > completion.date.getTime()) {
              days.push("late");
            } else {
              days.push("completed");
            }
          } else {
            days.push("missed");
          }
        }
      }

      return {
        habitId: habit.id,
        habitName: habit.name,
        frequency: freq,
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

// ---------------------------------------------------------------------------
// Weekly Progress (for weekly-target habits)
// ---------------------------------------------------------------------------

/**
 * Get weekly progress for all active weekly-target habits.
 * Counts completions in the current Mon–Sun week.
 */
export async function getWeeklyProgress(): Promise<WeeklyProgress[]> {
  try {
    const userId = await getOrCreateUser();
    const today = normalizeDate(new Date());
    const weekStart = getWeekStart(today);
    const weekEnd = getWeekEnd(today);

    const habits = await prisma.habit.findMany({
      where: { userId, active: true },
    });

    const weeklyHabits = habits.filter((h) => isWeeklyTarget(h.frequency));
    if (weeklyHabits.length === 0) return [];

    const completions = await prisma.completion.findMany({
      where: {
        habitId: { in: weeklyHabits.map((h) => h.id) },
        date: { gte: weekStart, lte: weekEnd },
      },
      select: { habitId: true },
    });

    // Count completions per habit
    const countMap = new Map<string, number>();
    for (const c of completions) {
      countMap.set(c.habitId, (countMap.get(c.habitId) ?? 0) + 1);
    }

    return weeklyHabits.map((h) => {
      const freq = h.frequency as unknown as { type: "weekly"; timesPerWeek: number };
      return {
        habitId: h.id,
        completed: countMap.get(h.id) ?? 0,
        target: freq.timesPerWeek,
      };
    });
  } catch (err) {
    console.error("getWeeklyProgress error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Overdue Habits (for scheduled habits)
// ---------------------------------------------------------------------------

/**
 * Find scheduled habits that were missed earlier this week.
 * A habit is overdue if it was scheduled for a day before today (this week)
 * and has no completion for that day.
 */
export async function getOverdueHabits(): Promise<OverdueHabit[]> {
  try {
    const userId = await getOrCreateUser();
    const today = normalizeDate(new Date());
    const weekStart = getWeekStart(today);
    const ONE_DAY = 86_400_000;

    const habits = await prisma.habit.findMany({
      where: { userId, active: true },
    });

    const scheduledHabits = habits.filter((h) => isScheduled(h.frequency));
    if (scheduledHabits.length === 0) return [];

    // Get all completions this week for these habits
    const completions = await prisma.completion.findMany({
      where: {
        habitId: { in: scheduledHabits.map((h) => h.id) },
        date: { gte: weekStart, lt: today },
      },
      select: { habitId: true, date: true },
    });

    // Build set of "habitId|YYYY-MM-DD" for completed
    const completionSet = new Set<string>(
      completions.map((c) => {
        const iso = normalizeDate(c.date).toISOString().slice(0, 10);
        return `${c.habitId}|${iso}`;
      }),
    );

    const overdue: OverdueHabit[] = [];

    for (const habit of scheduledHabits) {
      // Walk each day from weekStart to yesterday
      let cursor = weekStart;
      while (cursor.getTime() < today.getTime()) {
        if (habitAppliesToDate(habit.frequency, cursor)) {
          const iso = cursor.toISOString().slice(0, 10);
          if (!completionSet.has(`${habit.id}|${iso}`)) {
            overdue.push({
              habitId: habit.id,
              habitName: habit.name,
              missedDate: cursor,
            });
          }
        }
        cursor = new Date(cursor.getTime() + ONE_DAY);
      }
    }

    return overdue;
  } catch (err) {
    console.error("getOverdueHabits error:", err);
    return [];
  }
}

/**
 * Complete an overdue habit. Records the completion on the original missed date
 * (so the grid shows it on the right day) but the createdAt timestamp will
 * reflect that it was done late.
 */
export async function completeOverdue(
  habitId: string,
  missedDate: Date,
): Promise<{ completed: boolean } | { error: string }> {
  if (!habitId || typeof habitId !== "string") {
    return { error: "Invalid habit id" };
  }

  try {
    const normalized = normalizeDate(missedDate);

    const existing = await prisma.completion.findUnique({
      where: {
        habitId_date: { habitId, date: normalized },
      },
    });

    if (existing) {
      return { completed: true }; // Already done
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
    revalidatePath("/progress");
    return { completed: true };
  } catch (err) {
    console.error("completeOverdue error:", err);
    return { error: "Failed to complete overdue habit" };
  }
}
