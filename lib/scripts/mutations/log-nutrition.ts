import type { ScriptResult } from "../types";
import type { EstimatedNutritionEntry } from "../../chat-scenarios";
import type { NutritionLogData } from "../../types";
import { supabaseAdmin, insertLog, fetchLogs, todayISO } from "../helpers";
import type { NormalizedInput } from "../../chat-normalizer";

type NutritionResult = {
  itemsLogged: number;
  totals: { calories: number; protein: number; fat: number; carbs: number };
};

/**
 * Log nutrition entries to DB. Expects estimated entries (post-estimator).
 * Marks source as "confirmed" since user approved the proposal.
 */
export async function logNutrition(
  input: NormalizedInput,
  estimates: EstimatedNutritionEntry[],
): Promise<ScriptResult<NutritionResult>> {
  const categoryId = input.categoryId!;

  const known = estimates.filter((e) => !e.unknown);
  if (known.length === 0) {
    return { success: false, error: "No recognized food items to log." };
  }

  const today = todayISO();

  try {
    for (const entry of known) {
      await insertLog(input.userId, categoryId, today, {
        item: entry.item,
        calories: entry.calories,
        protein: entry.protein,
        fat: entry.fat,
        carbs: entry.carbs,
        source: "confirmed",
      });
    }
  } catch (err) {
    console.error("[logNutrition]", err);
    return { success: false, error: "Couldn't log nutrition — try again?" };
  }

  // Fetch updated daily totals
  const logs = await fetchLogs(categoryId, today, today);
  const totals = logs.reduce(
    (acc, log) => {
      const d = log.data as Partial<NutritionLogData>;
      return {
        calories: acc.calories + (d.calories ?? 0),
        protein: acc.protein + (d.protein ?? 0),
        fat: acc.fat + (d.fat ?? 0),
        carbs: acc.carbs + (d.carbs ?? 0),
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );

  const n = known.length;
  return {
    success: true,
    mutation: "nutrition_logged",
    summary: `Logged ${n} item${n === 1 ? "" : "s"}. Today: ${totals.calories} cal, ${totals.protein}g protein, ${totals.fat}g fat.`,
    data: { itemsLogged: n, totals },
  };
}
