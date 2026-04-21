import type { ScriptResult } from "../types";
import type { NormalizedInput } from "../../chat-normalizer";
import { logActivityAndCountWeek } from "./log-activity";

type GymResult = { weekCount: number; bodyPart?: string };

/**
 * Log a gym session. Body part is optional — defaults to session count.
 */
export async function logGym(
  input: NormalizedInput,
): Promise<ScriptResult<GymResult>> {
  const categoryId = input.categoryId;
  if (!categoryId) {
    return { success: false, error: "No Gym category found." };
  }

  const bodyPart = typeof input.params.bodyPart === "string"
    ? input.params.bodyPart
    : undefined;
  const notes = typeof input.params.notes === "string"
    ? input.params.notes
    : undefined;

  const data: Record<string, unknown> = {};
  if (bodyPart) data.bodyPart = bodyPart;
  if (notes) data.notes = notes;

  try {
    const { weekCount } = await logActivityAndCountWeek(input.userId, categoryId, data);

    const detail = bodyPart ? `${bodyPart} session` : "gym session";
    return {
      success: true,
      mutation: "gym_logged",
      summary: `Logged ${detail}. ${weekCount} session${weekCount === 1 ? "" : "s"} this week.`,
      data: { weekCount, bodyPart },
    };
  } catch (err) {
    console.error("[logGym]", err);
    return { success: false, error: "Couldn't log gym session — try again?" };
  }
}
