import { z } from "zod";

// ---------------------------------------------------------------------------
// Classifier output schema — what the LLM must return
// ---------------------------------------------------------------------------

export const classifierOutputSchema = z.object({
  scenario: z.enum([
    "log_nutrition",
    "log_gym",
    "log_run",
    "mark_habit",
    "increment_goal",
    "set_goal",
    "add_category",
    "query_progress",
    "unknown",
  ]),
  params: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ClassifierOutput = z.infer<typeof classifierOutputSchema>;

// ---------------------------------------------------------------------------
// Per-scenario param schemas
// ---------------------------------------------------------------------------

/**
 * log_nutrition: classifier returns item names ONLY.
 * Macros are estimated in a separate step by the estimator.
 */
export const logNutritionParamsSchema = z.object({
  entries: z.array(
    z.object({
      item: z.string(),
    }),
  ),
});

/**
 * Estimated nutrition entry — output of the estimator, not the classifier.
 */
export const estimatedNutritionEntrySchema = z.object({
  item: z.string(),
  calories: z.number(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
  unknown: z.boolean().optional(),
});

export const logGymParamsSchema = z.object({
  bodyPart: z.string().optional(),
  notes: z.string().optional(),
});

export const logRunParamsSchema = z.object({
  miles: z.number(),
  duration: z.string().optional(),
  notes: z.string().optional(),
});

export const markHabitParamsSchema = z.object({
  habit: z.string(),
});

export const incrementGoalParamsSchema = z.object({
  habit: z.string(),
  value: z.number(),
  unit: z.string(),
});

export const setGoalParamsSchema = z.object({
  categoryName: z.string(),
  metric: z.string(),
  target: z.number(),
  unit: z.string().optional(),
  period: z.enum(["daily", "weekly"]),
});

export const addCategoryParamsSchema = z.object({
  name: z.string(),
  type: z.enum(["gym", "nutrition", "running", "custom"]).optional(),
});

export const queryProgressParamsSchema = z.object({
  timeframe: z.enum(["today", "week", "month"]).optional().default("today"),
  category: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type LogNutritionParams = z.infer<typeof logNutritionParamsSchema>;
export type EstimatedNutritionEntry = z.infer<typeof estimatedNutritionEntrySchema>;
export type LogGymParams = z.infer<typeof logGymParamsSchema>;
export type LogRunParams = z.infer<typeof logRunParamsSchema>;
export type MarkHabitParams = z.infer<typeof markHabitParamsSchema>;
export type IncrementGoalParams = z.infer<typeof incrementGoalParamsSchema>;
export type SetGoalParams = z.infer<typeof setGoalParamsSchema>;
export type AddCategoryParams = z.infer<typeof addCategoryParamsSchema>;
export type QueryProgressParams = z.infer<typeof queryProgressParamsSchema>;
