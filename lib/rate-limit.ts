/**
 * Simple in-memory rate limiter (sliding window per key).
 * Not shared across workers/instances — sufficient for single-process Expo server.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();
let lastCleanup = 0;

/** Inline cleanup of expired entries — called on every check, throttled to once per 60s */
function cleanup(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}

/**
 * Check rate limit for a given key. Returns null if allowed, or a 429 Response if exceeded.
 *
 * @param key   Unique identifier (e.g. IP, userId, or combination)
 * @param max   Max requests per window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(key: string, max: number, windowMs: number): Response | null {
  const now = Date.now();
  cleanup(now);
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return Response.json(
      { success: false, error: "Too many requests — try again later" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  return null;
}

/**
 * Extract client IP from request headers (X-Forwarded-For, then fallback).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
