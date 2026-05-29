/**
 * Progress computation — computes actual value for a goal from log data.
 *
 * Supports both new structured logs ({ distance, distance_unit, count })
 * and legacy logs ({ miles, bodyPart, value }).
 */

/**
 * Compute the actual value for a goal from an array of log data payloads.
 *
 * Matching strategy:
 * 1. Match by goal unit (new structured logs)
 * 2. Fall back to legacy matching by category type (old logs)
 */
export function computeActualForMetric(
  metric: string,
  unit: string,
  categoryType: string,
  logDataArray: unknown[],
): number {
  return logDataArray.reduce<number>((sum, raw) => {
    const entry = raw as Record<string, unknown>;

    // --- New structured log shape (has explicit unit fields) ---
    if (unit === "count") {
      const c = entry["count"];
      return sum + (typeof c === "number" ? c : 0);
    }
    if (unit === "miles" || unit === "km") {
      if (typeof entry["distance"] === "number" && entry["distance_unit"] === unit) {
        return sum + (entry["distance"] as number);
      }
      // Old shape: { miles: number }
      if (unit === "miles" && typeof entry["miles"] === "number") {
        return sum + (entry["miles"] as number);
      }
      return sum;
    }
    if (unit === "minutes" || unit === "hours") {
      if (typeof entry["duration"] === "number" && entry["duration_unit"] === unit) {
        return sum + (entry["duration"] as number);
      }
      return sum;
    }
    if (unit === "calories") {
      const v = entry["calories"];
      return sum + (typeof v === "number" ? v : 0);
    }
    if (unit === "grams") {
      const v = entry[metric];
      return sum + (typeof v === "number" ? v : 0);
    }

    // --- Fallback: legacy matching by category type ---
    return sum + computeLegacyMetric(metric, categoryType, entry);
  }, 0);
}

/** Backward-compatible matching for logs written before unit-based system */
export function computeLegacyMetric(
  metric: string,
  categoryType: string,
  entry: Record<string, unknown>,
): number {
  switch (categoryType) {
    case "nutrition": {
      const v = entry[metric];
      return typeof v === "number" ? v : 0;
    }
    case "gym": {
      if (metric === "sessions") return 1;
      const targetBodyPart = metric.replace("_sessions", "").replace(/s$/, "").replace("_", " ");
      const bp = typeof entry["bodyPart"] === "string" ? entry["bodyPart"].toLowerCase().replace(/s$/, "") : "";
      if (!bp) return 0;
      return bp === targetBodyPart || bp.includes(targetBodyPart) || targetBodyPart.includes(bp) ? 1 : 0;
    }
    case "running": {
      if (metric === "sessions") return 1;
      const v = entry[metric];
      return typeof v === "number" ? v : 0;
    }
    case "custom": {
      const v = entry["value"];
      return typeof v === "number" ? v : 0;
    }
    default:
      return 0;
  }
}

/** Build structured log data from amount + unit */
export function buildStructuredLog(amount: number, unit: string): Record<string, unknown> {
  switch (unit) {
    case "miles":
    case "km":
      return { distance: amount, distance_unit: unit, count: 1 };
    case "minutes":
    case "hours":
      return { duration: amount, duration_unit: unit, count: 1 };
    case "calories":
      return { calories: amount, count: 1 };
    case "grams":
      return { value: amount, count: 1 };
    case "count":
    default:
      return { count: amount };
  }
}
