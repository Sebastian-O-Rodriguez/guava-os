/**
 * Strip time component — returns midnight UTC for the given calendar date.
 * Copied from the legacy habits.ts so new modules don't depend on it.
 */
export function normalizeDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
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
