import type { ScriptResult } from "../types";
import type { NormalizedInput } from "../../chat-normalizer";
import { insertLog, fetchLogs, fetchGoals, todayISO } from "../helpers";

type IncrementResult = {
  name: string;
  value: number;
  unit: string;
  todayTotal: number;
  target?: number;
};

/**
 * Increment numeric progress on a goal (e.g., "read for 20 minutes").
 */
export async function incrementGoal(
  input: NormalizedInput,
): Promise<ScriptResult<IncrementResult>> {
  const categoryId = input.categoryId!;
  const categoryName = input.categoryName;

  const value = input.count;
  const unit = input.unit ?? "";

  if (typeof value !== "number" || value <= 0) {
    return { success: false, error: "How much progress did you make?" };
  }

  const today = todayISO();

  try {
    await insertLog(input.userId, categoryId, today, { value, unit });
  } catch (err) {
    console.error("[incrementGoal]", err);
    return { success: false, error: "Couldn't log that — try again?" };
  }

  // Today's total
  const todayLogs = await fetchLogs(categoryId, today, today);
  const todayTotal = todayLogs.reduce((sum, log) => {
    const d = log.data as Record<string, unknown>;
    return sum + (typeof d.value === "number" ? d.value : 0);
  }, 0);

  // Goal target
  const goals = await fetchGoals(categoryId);
  const goal = goals[0]; // first active goal
  const goalText = goal ? ` ${todayTotal}/${goal.target} ${goal.metric} today.` : "";

  return {
    success: true,
    mutation: "goal_incremented",
    summary: `Logged ${value} ${unit} of ${categoryName ?? input.title}.${goalText}`,
    data: {
      name: categoryName ?? input.title ?? "",
      value,
      unit,
      todayTotal,
      target: goal?.target,
    },
  };
}
