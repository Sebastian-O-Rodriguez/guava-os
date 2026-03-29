import { z } from "zod";

// The classifier output schema — what the LLM must return
export const classifierOutputSchema = z.object({
  scenario: z.enum([
    "log_nutrition",
    "log_gym",
    "log_run",
    "set_goal",
    "add_category",
    "query_progress",
    "unknown",
  ]),
  params: z.record(z.string(), z.unknown()),
});

export type ClassifierOutput = z.infer<typeof classifierOutputSchema>;

// ---------------------------------------------------------------------------
// Per-scenario param schemas
// ---------------------------------------------------------------------------

export const logNutritionParamsSchema = z.object({
  entries: z.array(
    z.object({
      item: z.string(),
      calories: z.number(),
      protein: z.number(),
      fat: z.number(),
      carbs: z.number().optional(),
    }),
  ),
});

export const logGymParamsSchema = z.object({
  bodyPart: z.string(),
  notes: z.string().optional(),
});

export const logRunParamsSchema = z.object({
  miles: z.number(),
  duration: z.string().optional(),
  notes: z.string().optional(),
});

export const setGoalParamsSchema = z.object({
  categoryName: z.string(), // "gym", "nutrition", "running", or a custom name
  metric: z.string(),
  target: z.number(),
  period: z.enum(["daily", "weekly"]),
});

export const addCategoryParamsSchema = z.object({
  name: z.string(),
  type: z.enum(["gym", "nutrition", "running", "custom"]).optional(),
});

export const queryProgressParamsSchema = z.object({
  timeframe: z.enum(["today", "week", "month"]).optional().default("week"),
  category: z.string().optional(),
});

export type LogNutritionParams = z.infer<typeof logNutritionParamsSchema>;
export type LogGymParams = z.infer<typeof logGymParamsSchema>;
export type LogRunParams = z.infer<typeof logRunParamsSchema>;
export type SetGoalParams = z.infer<typeof setGoalParamsSchema>;
export type AddCategoryParams = z.infer<typeof addCategoryParamsSchema>;
export type QueryProgressParams = z.infer<typeof queryProgressParamsSchema>;
