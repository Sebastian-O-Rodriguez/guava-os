import type { FrequencyConfig } from "./types";

/** Strip time component — returns midnight UTC for the given calendar date. */
export function normalizeDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/** Day-of-week abbreviation used in custom frequency configs. */
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Returns true when a habit with the given frequency should be tracked on `date`.
 *
 * Frequency shapes (stored as JSON in the DB):
 *   { type: "daily" }
 *   { type: "weekdays" }
 *   { type: "custom", days: ["mon","wed","fri"] }
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

  const freq = frequency as FrequencyConfig;
  const dayIndex = date.getUTCDay(); // 0 = Sun … 6 = Sat

  switch (freq.type) {
    case "daily":
      return true;

    case "weekdays":
      return dayIndex >= 1 && dayIndex <= 5;

    case "custom": {
      const dayName = DAY_NAMES[dayIndex];
      return Array.isArray(freq.days) && freq.days.includes(dayName);
    }

    default:
      return true;
  }
}
