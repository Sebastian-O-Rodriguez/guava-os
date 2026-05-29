/**
 * Canonical Action type and Zod schemas for the RoutineMe action system.
 *
 * An Action is the unit of work between the chat pipeline and script execution.
 * It replaces the ad-hoc PendingAction type previously duplicated across
 * chat-surface.tsx and chat+api.ts.
 *
 * Pipeline: classify -> normalize -> Action -> propose/execute -> ScriptResult
 */
import { z } from "zod";
import type { GoalUnit, CategoryType } from "../types";
import type { MutationType } from "../scripts/types";

// ---------------------------------------------------------------------------
// Intent enum — all executable intents in the system
// ---------------------------------------------------------------------------

export const ActionIntent = z.enum([
  "log_nutrition",
  "log_gym",
  "log_run",
  "mark_habit",
  "increment_goal",
  "set_goal",
  "add_category",
  "query_progress",
  "unknown",
]);

export type ActionIntent = z.infer<typeof ActionIntent>;

// ---------------------------------------------------------------------------
// Per-intent payload schemas
// ---------------------------------------------------------------------------

export const LogNutritionPayload = z.object({
  intent: z.literal("log_nutrition"),
  entries: z.array(
    z.object({
      item: z.string(),
      calories: z.number(),
      protein: z.number(),
      fat: z.number(),
      carbs: z.number(),
      unknown: z.boolean().optional(),
    }),
  ),
});

export const LogGymPayload = z.object({
  intent: z.literal("log_gym"),
  bodyPart: z.string().optional(),
  notes: z.string().optional(),
});

export const LogRunPayload = z.object({
  intent: z.literal("log_run"),
  miles: z.number(),
  duration: z.string().optional(),
  notes: z.string().optional(),
});

export const MarkHabitPayload = z.object({
  intent: z.literal("mark_habit"),
  habit: z.string(),
});

export const IncrementGoalPayload = z.object({
  intent: z.literal("increment_goal"),
  habit: z.string(),
  value: z.number(),
  unit: z.string(),
});

export const SetGoalPayload = z.object({
  intent: z.literal("set_goal"),
  categoryName: z.string(),
  metric: z.string(),
  target: z.number(),
  unit: z.string().optional(),
  period: z.enum(["daily", "weekly"]),
});

export const AddCategoryPayload = z.object({
  intent: z.literal("add_category"),
  name: z.string(),
  type: z.enum(["gym", "nutrition", "running", "custom"]).optional(),
});

export const QueryProgressPayload = z.object({
  intent: z.literal("query_progress"),
  timeframe: z.enum(["today", "week", "month"]).default("today"),
  category: z.string().optional(),
});

export const UnknownPayload = z.object({
  intent: z.literal("unknown"),
});

/**
 * Discriminated union of all action payloads, keyed by `intent`.
 */
export const ActionPayload = z.discriminatedUnion("intent", [
  LogNutritionPayload,
  LogGymPayload,
  LogRunPayload,
  MarkHabitPayload,
  IncrementGoalPayload,
  SetGoalPayload,
  AddCategoryPayload,
  QueryProgressPayload,
  UnknownPayload,
]);

export type ActionPayload = z.infer<typeof ActionPayload>;

// ---------------------------------------------------------------------------
// Action — the canonical unit of work
// ---------------------------------------------------------------------------

export const ActionSchema = z.object({
  /** Unique action ID (client-generated UUID) */
  id: z.string().uuid(),

  /** Which intent this action represents */
  intent: ActionIntent,

  /** Authenticated user ID (always server-set, never trust client) */
  userId: z.string(),

  /** Resolved category context */
  categoryId: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),

  /** The typed payload for this intent */
  payload: ActionPayload,

  /** Action lifecycle status */
  status: z.enum(["proposed", "confirmed", "executed", "cancelled", "error"]),

  /** Confidence score from classifier (0-1) */
  confidence: z.number().min(0).max(1),

  /** ISO timestamp of creation */
  createdAt: z.string().datetime(),

  /** Mutation type after execution (null until executed) */
  mutation: z.string().nullable().optional(),
});

export type Action = z.infer<typeof ActionSchema>;

// ---------------------------------------------------------------------------
// Action creation helper type (fields the server fills in)
// ---------------------------------------------------------------------------

export type CreateActionInput = Omit<Action, "id" | "status" | "createdAt" | "mutation">;

// ---------------------------------------------------------------------------
// Action result — what comes back after execution
// ---------------------------------------------------------------------------

export const ActionResultSchema = z.object({
  actionId: z.string().uuid(),
  success: z.boolean(),
  message: z.string(),
  status: z.enum(["proposed", "executed", "info", "error", "clarify"]),
  mutation: z.string().nullable().optional(),
  data: z.unknown().optional(),
  timestamp: z.number(),
});

export type ActionResult = z.infer<typeof ActionResultSchema>;
