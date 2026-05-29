import type { ScriptResult } from "../types";
import type { NormalizedInput } from "../../chat-normalizer";
import { supabaseAdmin, generateId } from "../helpers";

type GoalResult = {
  goalId: string;
  metric: string;
  target: number;
  period: string;
  isUpdate: boolean;
};

/**
 * Create or update a goal. If a goal with the same metric already exists
 * for the category, update it. Otherwise create a new one.
 */
export async function setGoal(
  input: NormalizedInput,
): Promise<ScriptResult<GoalResult>> {
  const categoryId = input.categoryId!;

  const metric = typeof input.params.metric === "string" ? input.params.metric : "sessions";
  const unit = typeof input.unit === "string" ? input.unit : "count";
  const target = typeof input.count === "number" ? Math.min(Math.max(input.count, 0), 100_000) : 1;
  const period = input.period ?? "daily";

  try {
    // Check for existing goal with same metric
    const { data: existing } = await supabaseAdmin
      .from("goals")
      .select("id")
      .eq("category_id", categoryId)
      .eq("metric", metric)
      .eq("active", true)
      .single();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("goals")
        .update({ target, unit, period })
        .eq("id", existing.id);
      if (error) throw error;

      return {
        success: true,
        mutation: "goal_updated",
        summary: `Updated ${metric} goal to ${target} (${period}).`,
        data: { goalId: existing.id, metric, target, period, isUpdate: true },
      };
    }

    const goalId = generateId();
    const { error } = await supabaseAdmin.from("goals").insert({
      id: goalId,
      user_id: input.userId,
      category_id: categoryId,
      metric,
      unit,
      target,
      period,
    });
    if (error) throw error;

    return {
      success: true,
      mutation: "goal_created",
      summary: `Created ${metric} goal: ${target} (${period}).`,
      data: { goalId, metric, target, period, isUpdate: false },
    };
  } catch (err) {
    console.error("[setGoal]", err);
    return { success: false, error: "Couldn't set goal — try again?" };
  }
}
