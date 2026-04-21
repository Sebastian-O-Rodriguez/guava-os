import { openrouter, CHAT_MODEL } from "./openrouter";
import { classifierOutputSchema, type ClassifierOutput } from "./chat-scenarios";
import { CLASSIFIER_PROMPT } from "./chat-prompt";

/**
 * Send the user message to the LLM for intent classification.
 * Returns a validated { scenario, params, confidence } object.
 *
 * The classifier extracts intent + entities ONLY — no macro estimation.
 * On any failure (network, parse, validation) returns scenario "unknown".
 */
export async function classifyMessage(
  userMessage: string,
  conversationContext?: Array<{ role: string; content: string }>,
): Promise<ClassifierOutput> {
  try {
    // Build messages: system prompt + optional conversation context + current message
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: CLASSIFIER_PROMPT },
    ];

    // Include last few messages for clarification context (max 4)
    if (conversationContext && conversationContext.length > 0) {
      const recent = conversationContext.slice(-4);
      for (const msg of recent) {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: userMessage });

    const response = await openrouter().chat.completions.create({
      model: CHAT_MODEL,
      messages,
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
      return { scenario: "unknown", params: {}, confidence: 0 };
    }

    const result = classifierOutputSchema.safeParse(parsed);
    if (!result.success) {
      console.error("[classifyMessage] Schema validation failed:", result.error.issues);
      return { scenario: "unknown", params: {}, confidence: 0 };
    }

    return result.data;
  } catch (err) {
    console.error("[classifyMessage] LLM call failed:", err);
    return { scenario: "unknown", params: {}, confidence: 0 };
  }
}
