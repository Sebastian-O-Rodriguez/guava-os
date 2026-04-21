/**
 * Shared helpers for scripts. DB lookups, date formatting, common queries.
 * Scripts import from here — never directly from supabase.
 *
 * ALL helpers that touch user data require userId as a parameter.
 * No implicit user lookup — auth is handled at the API route level.
 */
import { supabaseAdmin } from "../supabase";
import { todayLocal, getWeekStart, getWeekEnd } from "../dates";
import { generateId } from "../id";

export { generateId, supabaseAdmin };

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function todayISO(): string {
  return todayLocal();
}

export function weekStartISO(): string {
  return getWeekStart(new Date()).toISOString().slice(0, 10);
}

export function weekEndISO(): string {
  return getWeekEnd(new Date()).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// DB access — all require explicit userId
// ---------------------------------------------------------------------------

/**
 * Find a category by type for a specific user.
 */
export async function findCategoryByType(
  userId: string,
  type: string,
): Promise<{ id: string; name: string; type: string } | null> {
  const { data } = await supabaseAdmin
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("active", true)
    .single();
  return data as { id: string; name: string; type: string } | null;
}

/**
 * Find a category by name (fuzzy, case-insensitive) for a specific user.
 */
export async function findCategoryByName(
  userId: string,
  name: string,
): Promise<{ id: string; name: string; type: string } | null> {
  const { data: categories } = await supabaseAdmin
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId)
    .eq("active", true);

  if (!categories || categories.length === 0) return null;

  const lower = name.toLowerCase();
  const catList = categories as Array<{ id: string; name: string; type: string }>;

  return (
    catList.find((c) => c.name.toLowerCase() === lower) ??
    catList.find((c) => c.name.toLowerCase().includes(lower)) ??
    catList.find((c) => c.type === lower) ??
    null
  );
}

/**
 * Insert a log row with user_id.
 */
export async function insertLog(
  userId: string,
  categoryId: string,
  date: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from("logs").insert({
    id: generateId(),
    user_id: userId,
    category_id: categoryId,
    date,
    data,
  });
  if (error) throw error;
}

/**
 * Fetch logs for a category within a date range.
 */
export async function fetchLogs(
  categoryId: string,
  startDate: string,
  endDate?: string,
): Promise<Array<{ data: unknown }>> {
  let query = supabaseAdmin
    .from("logs")
    .select("data")
    .eq("category_id", categoryId)
    .gte("date", startDate);

  if (endDate) {
    query = query.lte("date", endDate);
  }

  const { data } = await query;
  return (data ?? []) as Array<{ data: unknown }>;
}

/**
 * Fetch active goals for a category.
 */
export async function fetchGoals(
  categoryId: string,
): Promise<Array<{ id: string; metric: string; target: number; period: string }>> {
  const { data } = await supabaseAdmin
    .from("goals")
    .select("id, metric, target, period")
    .eq("category_id", categoryId)
    .eq("active", true);
  return (data ?? []) as Array<{ id: string; metric: string; target: number; period: string }>;
}
