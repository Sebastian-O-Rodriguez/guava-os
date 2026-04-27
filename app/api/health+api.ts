/**
 * Health check — reports env vars + tests OpenRouter connectivity.
 */
export async function GET(): Promise<Response> {
  const vars = {
    OPENROUTER_API_KEY_V2: check("OPENROUTER_API_KEY_V2"),
    EXPO_PUBLIC_SUPABASE_URL: check("EXPO_PUBLIC_SUPABASE_URL"),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: check("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: check("SUPABASE_SERVICE_ROLE_KEY"),
  };

  // Test OpenRouter connectivity with trimmed key
  let openrouterStatus = "NOT_TESTED";
  const rawKey = process.env.OPENROUTER_API_KEY_V2 ?? "";
  const key = rawKey.trim();
  const keyDebug = {
    rawLength: rawKey.length,
    trimmedLength: key.length,
    firstCharCode: rawKey.charCodeAt(0),
    lastCharCode: rawKey.charCodeAt(rawKey.length - 1),
    last5: key.slice(-5),
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages: [{ role: "user", content: "say ok" }],
        max_tokens: 5,
      }),
    });
    const data = await res.json();
    if (data.choices) {
      openrouterStatus = `OK — ${data.choices[0]?.message?.content ?? "empty"}`;
    } else {
      openrouterStatus = `FAILED — ${JSON.stringify(data.error ?? data).slice(0, 200)}`;
    }
  } catch (err) {
    openrouterStatus = `ERROR — ${err instanceof Error ? err.message : String(err)}`;
  }

  return Response.json({ ok: true, env: vars, openrouter: openrouterStatus, keyDebug });
}

function check(name: string): string {
  const val = process.env[name];
  if (!val) return "MISSING";
  return `SET (${val.length} chars, starts: ${val.slice(0, 8)}...)`;
}
