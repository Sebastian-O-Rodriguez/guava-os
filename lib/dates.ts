/**
 * Strip time component — returns midnight UTC for the given calendar date.
 * Copied from the legacy habits.ts so new modules don't depend on it.
 */
/**
 * Strip time component — returns midnight UTC for the given date.
 * Uses UTC accessors so dates parsed as UTC strings (e.g., "2026-04-05")
 * are not shifted by the local timezone.
 */
export function normalizeDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Get today's date as YYYY-MM-DD using local calendar date.
 * Use this for "what day is it for the user" — not normalizeDate(new Date()).
 */
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Get the Monday (start) of the week containing `date`.
 * Week is Mon–Sun.
 */
export function getWeekStart(date: Date): Date {
  const d = normalizeDate(date);
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return new Date(d.getTime() + mondayOffset * 86_400_000);
}

/**
 * Get the Sunday (end) of the week containing `date`.
 * Week is Mon–Sun.
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  return new Date(start.getTime() + 6 * 86_400_000);
}
