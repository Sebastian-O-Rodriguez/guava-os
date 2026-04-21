/**
 * Shared internals for activity logging (gym + run).
 * Public scripts import from here — not used directly by executor.
 */
import { insertLog, fetchLogs, todayISO, weekStartISO, weekEndISO } from "../helpers";

/**
 * Insert an activity log and return the weekly count for that category.
 */
export async function logActivityAndCountWeek(
  userId: string,
  categoryId: string,
  data: Record<string, unknown>,
): Promise<{ weekCount: number }> {
  const today = todayISO();
  await insertLog(userId, categoryId, today, data);

  const weekLogs = await fetchLogs(categoryId, weekStartISO(), weekEndISO());
  return { weekCount: weekLogs.length };
}
