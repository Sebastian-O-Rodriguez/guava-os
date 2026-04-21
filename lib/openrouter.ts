import OpenAI from "openai";

export const CHAT_MODEL = "anthropic/claude-haiku-4.5";

// Lazy singleton — defers reading process.env until first call.
// Expo server routes may populate env vars after module evaluation.
let _client: OpenAI | null = null;

export function openrouter(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY ?? "";
    if (!apiKey) {
      console.error("[openrouter] OPENROUTER_API_KEY is not set");
    }
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });
  }
  return _client;
}
