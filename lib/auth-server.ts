/**
 * Server-side auth helper for API routes.
 *
 * Extracts user_id from the Supabase auth token in the request.
 * Auto-provisions a row in the `users` table on first authenticated request
 * (required because categories/goals/logs have FK to users.id).
 */
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Track which user IDs have been provisioned this process lifetime
const provisionedUsers = new Set<string>();

/**
 * Extract authenticated user from request Authorization header.
 * Returns user_id or null if not authenticated.
 */
export async function getAuthUser(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user.id;
}

/**
 * Ensure a row exists in the `users` table for this auth user.
 * Uses upsert to avoid race conditions on first request.
 */
async function ensureUserRow(userId: string): Promise<void> {
  if (provisionedUsers.has(userId)) return;

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("users")
    .upsert(
      { id: userId, created_at: now, updated_at: now },
      { onConflict: "id", ignoreDuplicates: true },
    );

  provisionedUsers.add(userId);
}

/**
 * Require authentication — returns user_id or a 401 Response.
 * Auto-provisions user row in DB on first request.
 */
export async function requireAuth(
  request: Request,
): Promise<string | Response> {
  const userId = await getAuthUser(request);
  if (!userId) {
    return Response.json(
      { message: "Authentication required", status: "error" },
      { status: 401 },
    );
  }

  await ensureUserRow(userId);
  return userId;
}
