/**
 * Source-agnostic action executor.
 *
 * Single entry point for all mutations in the system. Accepts a validated
 * Action (from types.ts), routes to the correct script, returns ActionResult.
 *
 * Replaces chat-executor as the canonical dispatch layer. All sources
 * (tap, form, chat) construct an Action and call executeAction().
 *
 * No business logic here — just validation, routing, and result mapping.
 */

import { ActionSchema } from "./types";
import type { Action, ActionResult, ActionPayload, CreateActionInput } from "./types";
import type { NormalizedInput } from "../chat-normalizer";
import type { ScriptResult } from "../scripts/types";
import type { EstimatedNutritionEntry } from "../chat-scenarios";

// Script imports
import { logNutrition } from "../scripts/mutations/log-nutrition";
import { logGym } from "../scripts/mutations/log-gym";
import { logRun } from "../scripts/mutations/log-run";
import { markHabit } from "../scripts/mutations/mark-habit";
import { incrementGoal } from "../scripts/mutations/increment-goal";
import { setGoal } from "../scripts/mutations/set-goal";
import { addCategory } from "../scripts/mutations/add-category";
import { queryProgress } from "../scripts/queries/query-progress";

// ---------------------------------------------------------------------------
// Create — build a full Action from input fields
// ---------------------------------------------------------------------------

export function createAction(input: CreateActionInput): Action {
  return ActionSchema.parse({
    ...input,
    id: crypto.randomUUID(),
    status: "proposed",
    createdAt: new Date().toISOString(),
    mutation: null,
  });
}

// ---------------------------------------------------------------------------
// Execute — validate, route, return result
// ---------------------------------------------------------------------------

export async function executeAction(action: Action): Promise<ActionResult> {
  // Validate action shape
  const parsed = ActionSchema.safeParse(action);
  if (!parsed.success) {
    return errorResult(action.id, `Invalid action: ${parsed.error.issues[0].message}`);
  }

  const { intent, payload } = parsed.data;

  // Unknown intent — nothing to execute
  if (intent === "unknown") {
    return {
      actionId: action.id,
      success: false,
      message: "Unknown intent — cannot execute.",
      status: "error",
      mutation: null,
      timestamp: Date.now(),
    };
  }

  // Query — read-only, no mutation
  if (intent === "query_progress") {
    const input = toNormalizedInput(action);
    const result = await queryProgress(input);
    return scriptToResult(action.id, result, "info");
  }

  // Mutation intents — route to script
  try {
    const input = toNormalizedInput(action);
    let result: ScriptResult;

    switch (intent) {
      case "log_nutrition": {
        const p = payload as Extract<ActionPayload, { intent: "log_nutrition" }>;
        const estimates: EstimatedNutritionEntry[] = p.entries.map((e) => ({
          item: e.item,
          calories: e.calories,
          protein: e.protein,
          fat: e.fat,
          carbs: e.carbs,
          unknown: e.unknown ?? false,
        }));
        result = await logNutrition(input, estimates);
        break;
      }
      case "log_gym":
        result = await logGym(input);
        break;
      case "log_run":
        result = await logRun(input);
        break;
      case "mark_habit":
        result = await markHabit(input);
        break;
      case "increment_goal":
        result = await incrementGoal(input);
        break;
      case "set_goal":
        result = await setGoal(input);
        break;
      case "add_category":
        result = await addCategory(input);
        break;
      default:
        return errorResult(action.id, `Unsupported intent: ${intent}`);
    }

    return scriptToResult(action.id, result, "executed");
  } catch (err) {
    console.error(`[executor] ${intent} failed:`, err);
    return errorResult(
      action.id,
      err instanceof Error ? err.message : "Execution failed",
    );
  }
}

// ---------------------------------------------------------------------------
// Action → NormalizedInput adapter
//
// Bridges the Action type to the NormalizedInput that existing scripts expect.
// This avoids modifying all mutation scripts in this phase.
// ---------------------------------------------------------------------------

function toNormalizedInput(action: Action): NormalizedInput {
  const { intent, userId, payload, categoryId, categoryName, confidence } = action;

  // Base shape all scripts receive
  const base: NormalizedInput = {
    intent,
    userId,
    categoryId: categoryId ?? undefined,
    categoryName: categoryName ?? undefined,
    confidence,
    params: {},
  };

  switch (intent) {
    case "log_nutrition": {
      const p = payload as Extract<ActionPayload, { intent: "log_nutrition" }>;
      return { ...base, category: "nutrition", params: { entries: p.entries } };
    }
    case "log_gym": {
      const p = payload as Extract<ActionPayload, { intent: "log_gym" }>;
      return {
        ...base,
        category: "habit",
        title: p.bodyPart,
        params: { bodyPart: p.bodyPart, notes: p.notes },
      };
    }
    case "log_run": {
      const p = payload as Extract<ActionPayload, { intent: "log_run" }>;
      return {
        ...base,
        category: "habit",
        count: p.miles,
        unit: "miles",
        params: { miles: p.miles, duration: p.duration, notes: p.notes },
      };
    }
    case "mark_habit": {
      const p = payload as Extract<ActionPayload, { intent: "mark_habit" }>;
      return {
        ...base,
        category: "habit",
        title: p.habit,
        unit: "count",
        period: "daily",
        params: { habit: p.habit },
      };
    }
    case "increment_goal": {
      const p = payload as Extract<ActionPayload, { intent: "increment_goal" }>;
      return {
        ...base,
        category: "goal",
        title: p.habit,
        count: p.value,
        unit: p.unit,
        period: "daily",
        params: { habit: p.habit, value: p.value, unit: p.unit },
      };
    }
    case "set_goal": {
      const p = payload as Extract<ActionPayload, { intent: "set_goal" }>;
      return {
        ...base,
        category: "goal",
        title: p.metric,
        count: p.target,
        unit: p.unit,
        period: p.period,
        params: {
          categoryName: p.categoryName,
          metric: p.metric,
          target: p.target,
          unit: p.unit,
          period: p.period,
        },
      };
    }
    case "add_category": {
      const p = payload as Extract<ActionPayload, { intent: "add_category" }>;
      return {
        ...base,
        title: p.name,
        params: { name: p.name, type: p.type },
      };
    }
    case "query_progress": {
      const p = payload as Extract<ActionPayload, { intent: "query_progress" }>;
      return {
        ...base,
        params: { timeframe: p.timeframe, category: p.category },
      };
    }
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

function scriptToResult(
  actionId: string,
  result: ScriptResult,
  defaultStatus: "executed" | "info",
): ActionResult {
  if (!result.success) {
    return {
      actionId,
      success: false,
      message: result.error ?? "Something went wrong.",
      status: "error",
      mutation: null,
      timestamp: Date.now(),
    };
  }
  return {
    actionId,
    success: true,
    message: result.summary ?? "Done.",
    status: defaultStatus,
    mutation: result.mutation ?? null,
    data: result.data,
    timestamp: Date.now(),
  };
}

function errorResult(actionId: string, message: string): ActionResult {
  return {
    actionId,
    success: false,
    message,
    status: "error",
    mutation: null,
    timestamp: Date.now(),
  };
}
