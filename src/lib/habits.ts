/** Strip time component — returns midnight UTC for the given calendar date. */
export function normalizeDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/** Day-of-week abbreviation used in scheduled frequency configs. */
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Returns true when a habit with the given frequency should be tracked on `date`.
 *
 * Frequency shapes (stored as JSON in the DB):
 *   { type: "daily" }
 *   { type: "scheduled", days: ["mon","wed","fri"] }
 *   { type: "weekly", timesPerWeek: 3 }
 *
 * Legacy shapes are handled gracefully:
 *   { type: "weekdays" } → treated as scheduled Mon-Fri
 *   { type: "custom", days: [...] } → treated as scheduled
 */
export function habitAppliesToDate(frequency: unknown, date: Date): boolean {
  if (
    typeof frequency !== "object" ||
    frequency === null ||
    !("type" in frequency)
  ) {
    // Fallback: treat malformed frequency as daily so habits never silently vanish.
    return true;
  }

  const freq = frequency as Record<string, unknown>;
  const dayIndex = date.getUTCDay(); // 0 = Sun … 6 = Sat

  switch (freq.type) {
    case "daily":
      return true;

    case "scheduled": {
      const days = freq.days;
      const dayName = DAY_NAMES[dayIndex];
      return Array.isArray(days) && days.includes(dayName);
    }

    case "weekly":
      // Weekly target habits are always "applicable" — they can be done any day
      return true;

    // Legacy support
    case "weekdays":
      return dayIndex >= 1 && dayIndex <= 5;

    case "custom": {
      const days = freq.days;
      const dayName = DAY_NAMES[dayIndex];
      return Array.isArray(days) && days.includes(dayName);
    }

    default:
      return true;
  }
}

/**
 * Returns true if a habit should appear on the Today page for the given date.
 * Different from habitAppliesToDate — scheduled habits only show on their days,
 * while weekly habits show every day.
 */
export function habitShowsOnDate(frequency: unknown, date: Date): boolean {
  if (
    typeof frequency !== "object" ||
    frequency === null ||
    !("type" in frequency)
  ) {
    return true;
  }

  const freq = frequency as Record<string, unknown>;
  const dayIndex = date.getUTCDay();

  switch (freq.type) {
    case "daily":
      return true;

    case "scheduled": {
      const days = freq.days;
      const dayName = DAY_NAMES[dayIndex];
      return Array.isArray(days) && days.includes(dayName);
    }

    case "weekly":
      return true;

    // Legacy
    case "weekdays":
      return dayIndex >= 1 && dayIndex <= 5;
    case "custom": {
      const days = freq.days;
      const dayName = DAY_NAMES[dayIndex];
      return Array.isArray(days) && days.includes(dayName);
    }

    default:
      return true;
  }
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

/**
 * Check if a frequency config is the "weekly" target type.
 */
export function isWeeklyTarget(frequency: unknown): boolean {
  return (
    typeof frequency === "object" &&
    frequency !== null &&
    "type" in frequency &&
    (frequency as Record<string, unknown>).type === "weekly"
  );
}

/**
 * Check if a frequency config is the "scheduled" type (or legacy weekdays/custom).
 */
export function isScheduled(frequency: unknown): boolean {
  if (typeof frequency !== "object" || frequency === null || !("type" in frequency)) {
    return false;
  }
  const type = (frequency as Record<string, unknown>).type;
  return type === "scheduled" || type === "weekdays" || type === "custom";
}
