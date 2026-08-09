/**
 * Deterministic JSON serialization.
 *
 * Object keys are emitted in a fixed, sorted order so the same logical graph
 * always serializes to byte-identical output (stable diffs, reproducible
 * tests). Arrays preserve their (meaningful) order.
 */

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortValue(obj[key]);
    }
    return out;
  }
  return value;
}

/** Serialize any JSON-compatible value with deterministic key ordering. */
export function serializeDeterministic(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2) + "\n";
}
