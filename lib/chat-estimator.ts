import { openrouter, CHAT_MODEL } from "./openrouter";
import { estimatedNutritionEntrySchema, type EstimatedNutritionEntry } from "./chat-scenarios";
import { ESTIMATOR_PROMPT } from "./chat-prompt";
import { z } from "zod";

const estimatorResponseSchema = z.array(estimatedNutritionEntrySchema);

/**
 * Estimate nutrition macros for a list of food items.
 * This is a SEPARATE step from classification — the classifier only extracts
 * item names, and this estimator provides the macro estimates.
 *
 * All returned values are tagged as estimated (source: "estimated").
 * Unknown foods get { unknown: true } with zeroed macros.
 */
export async function estimateNutrition(
  items: string[],
): Promise<EstimatedNutritionEntry[]> {
  if (items.length === 0) return [];

  try {
    const response = await openrouter().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: ESTIMATOR_PROMPT },
        { role: "user", content: JSON.stringify(items) },
      ],
      max_tokens: 512,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content ?? "";

    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[estimateNutrition] JSON parse failed:", cleaned);
      return items.map((item) => ({
        item,
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        unknown: true,
      }));
    }

    const result = estimatorResponseSchema.safeParse(parsed);
    if (!result.success) {
      console.error("[estimateNutrition] Schema validation failed:", result.error.issues);
      return items.map((item) => ({
        item,
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        unknown: true,
      }));
    }

    return result.data;
  } catch (err) {
    console.error("[estimateNutrition] LLM call failed:", err);
    return items.map((item) => ({
      item,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      unknown: true,
    }));
  }
}

/**
 * Format estimated nutrition entries into a human-readable proposal string.
 * Uses ~ prefix to indicate estimates. Asks for confirmation.
 */
export function formatNutritionProposal(entries: EstimatedNutritionEntry[]): string {
  const unknowns = entries.filter((e) => e.unknown);
  const known = entries.filter((e) => !e.unknown);

  const lines: string[] = [];

  for (const entry of known) {
    lines.push(
      `${entry.item} — ~${entry.calories} cal, ~${entry.protein}g protein, ~${entry.fat}g fat, ~${entry.carbs}g carbs`,
    );
  }

  if (unknowns.length > 0) {
    const unknownNames = unknowns.map((e) => e.item).join(", ");
    lines.push(
      `I'm not sure about ${unknownNames} — can you give me the rough macros?`,
    );
  }

  if (known.length > 0) {
    const totalCal = known.reduce((s, e) => s + e.calories, 0);
    lines.push(`Total: ~${totalCal} cal (estimated). Want me to log that?`);
  }

  return lines.join("\n");
}
