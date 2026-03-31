import { openrouter, CHAT_MODEL } from "./openrouter";
import { classifierOutputSchema, type ClassifierOutput } from "./chat-scenarios";
import { CLASSIFIER_PROMPT } from "./chat-prompt";

/**
 * Send the user message to the LLM for intent classification.
 * Returns a validated { scenario, params } object.
 * On any failure (network, parse, validation) returns scenario "unknown".
 */
export async function classifyMessage(userMessage: string): Promise<ClassifierOutput> {
  try {
    const response = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: CLASSIFIER_PROMPT },
        { role: "user", content: userMessage },
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
      console.error("[classifyMessage] JSON parse failed:", cleaned);
      return { scenario: "unknown", params: {} };
    }

    const result = classifierOutputSchema.safeParse(parsed);
    if (!result.success) {
      console.error("[classifyMessage] Schema validation failed:", result.error.issues);
      return { scenario: "unknown", params: {} };
    }

    return result.data;
  } catch (err) {
    console.error("[classifyMessage] LLM call failed:", err);
    return { scenario: "unknown", params: {} };
  }
}
