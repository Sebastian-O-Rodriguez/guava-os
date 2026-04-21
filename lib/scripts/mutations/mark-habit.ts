import type { ScriptResult } from "../types";
import type { NormalizedInput } from "../../chat-normalizer";
import { insertLog, todayISO, supabaseAdmin } from "../helpers";

type HabitResult = { name: string; streak: number };

/**
 * Mark a habit as complete for today. Returns streak count.
 */
export async function markHabit(
  input: NormalizedInput,
): Promise<ScriptResult<HabitResult>> {
  const categoryId = input.categoryId;
  const categoryName = input.categoryName;

  if (!categoryId) {
    return {
      success: false,
      error: `No "${input.title}" goal found. Want to create one?`,
    };
  }

  const today = todayISO();

  try {
    await insertLog(input.userId, categoryId, today, { value: 1 });
  } catch (err) {
    console.error("[markHabit]", err);
    return { success: false, error: "Couldn't mark that habit — try again?" };
  }

  // Calculate streak
  const streak = await calculateStreak(categoryId, today);
  const streakText = streak > 1 ? ` ${streak}-day streak.` : "";

  return {
    success: true,
    mutation: "habit_marked",
    summary: `${categoryName ?? input.title} done.${streakText}`,
    data: { name: categoryName ?? input.title ?? "", streak },
  };
}

/**
 * Count consecutive days with logs ending at `endDate`.
 */
async function calculateStreak(categoryId: string, endDate: string): Promise<number> {
  const { data: recentLogs } = await supabaseAdmin
    .from("logs")
    .select("date")
    .eq("category_id", categoryId)
    .order("date", { ascending: false })
    .limit(30);

  if (!recentLogs || recentLogs.length === 0) return 0;

  // Deduplicate dates
  const dates = [...new Set(recentLogs.map((l) => l.date as string))].sort().reverse();

  let streak = 0;
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(endDate + "T00:00:00Z");
    expected.setUTCDate(expected.getUTCDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (dates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
