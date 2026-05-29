import type { ScriptResult } from "../types";
import type { NormalizedInput } from "../../chat-normalizer";
import type { RunLogData } from "../../types";
import { logActivityAndCountWeek } from "./log-activity";
import { fetchLogs, fetchGoals, weekStartISO, weekEndISO } from "../helpers";

type RunResult = { miles: number; weekTotal: number; weekGoal?: number };

/**
 * Log a run with miles + optional duration.
 */
export async function logRun(
  input: NormalizedInput,
): Promise<ScriptResult<RunResult>> {
  const categoryId = input.categoryId!;

  const miles = typeof input.params.miles === "number"
    ? Math.min(Math.max(input.params.miles, 0), 1000)
    : 0;
  const duration = typeof input.params.duration === "string" ? input.params.duration : undefined;
  const notes = typeof input.params.notes === "string" ? input.params.notes : undefined;

  if (miles <= 0) {
    return { success: false, error: "How far did you run?" };
  }

  try {
    await logActivityAndCountWeek(input.userId, categoryId, { miles, duration, notes });

    // Weekly miles total
    const weekLogs = await fetchLogs(categoryId, weekStartISO(), weekEndISO());
    const weekTotal = weekLogs.reduce((sum, log) => {
      const d = log.data as Partial<RunLogData>;
      return sum + (d.miles ?? 0);
    }, 0);

    // Miles goal
    const goals = await fetchGoals(categoryId);
    const milesGoal = goals.find((g) => g.metric === "miles");
    const goalText = milesGoal ? `/${milesGoal.target}` : "";

    return {
      success: true,
      mutation: "run_logged",
      summary: `Logged ${miles} mi. This week: ${weekTotal}${goalText} mi.`,
      data: { miles, weekTotal, weekGoal: milesGoal?.target },
    };
  } catch (err) {
    console.error("[logRun]", err);
    return { success: false, error: "Couldn't log run — try again?" };
  }
}
