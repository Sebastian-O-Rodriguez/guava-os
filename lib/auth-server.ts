/**
 * Server-side auth helper for API routes.
 *
 * Extracts user_id from the Supabase auth token in the request.
 * Every API route MUST call getAuthUser() and reject if null.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Extract authenticated user from request Authorization header.
 * Returns user_id or null if not authenticated.
 */
export async function getAuthUser(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  // Create a per-request client with the user's JWT
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user.id;
}

/**
 * Require authentication — returns user_id or a 401 Response.
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
  return userId;
}
