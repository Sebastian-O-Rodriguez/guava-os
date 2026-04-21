import type { ScriptResult } from "../types";
import type { NormalizedInput } from "../../chat-normalizer";
import { supabaseAdmin, generateId } from "../helpers";

type CategoryResult = { categoryId: string; name: string; type: string };

/**
 * Create a new tracking category.
 */
export async function addCategory(
  input: NormalizedInput,
): Promise<ScriptResult<CategoryResult>> {
  const name = (input.title ?? "").slice(0, 50);
  if (!name) {
    return { success: false, error: "What should the category be called?" };
  }

  const type = typeof input.params.type === "string" ? input.params.type : "custom";
  const userId = input.userId;

  try {
    const categoryId = generateId();
    const { error } = await supabaseAdmin.from("categories").insert({
      id: categoryId,
      user_id: userId,
      name,
      type,
    });
    if (error) throw error;

    return {
      success: true,
      mutation: "category_created",
      summary: `Created "${name}" category.`,
      data: { categoryId, name, type },
    };
  } catch (err) {
    console.error("[addCategory]", err);
    return { success: false, error: "Couldn't create category — try again?" };
  }
}
