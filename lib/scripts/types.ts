/**
 * Standard return shape for ALL scripts (mutations and queries).
 *
 * Every script returns this. The executor never interprets script internals —
 * it just forwards the result.
 */
export type ScriptResult<T = unknown> = {
  success: boolean;
  mutation?: string;
  summary?: string;
  data?: T;
  error?: string;
  timestamp?: number;
};

/**
 * Mutation names — used in ScriptResult.mutation for the UI refresh contract.
 */
export type MutationType =
  | "nutrition_logged"
  | "gym_logged"
  | "run_logged"
  | "habit_marked"
  | "goal_incremented"
  | "goal_created"
  | "goal_updated"
  | "category_created";
