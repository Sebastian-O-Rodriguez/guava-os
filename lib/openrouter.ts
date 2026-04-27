import OpenAI from "openai";

export const CHAT_MODEL = "anthropic/claude-haiku-4.5";

/**
 * Create a fresh OpenAI client for each call.
 * Trims env var to prevent whitespace/newline corruption from hosting platforms.
 */
export function openrouter(): OpenAI {
  const apiKey = (process.env.OPENROUTER_API_KEY_V2 ?? "").trim();
  if (!apiKey) {
    console.error("[openrouter] OPENROUTER_API_KEY is not set");
  }
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}
