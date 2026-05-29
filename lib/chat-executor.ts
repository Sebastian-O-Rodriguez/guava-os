/**
 * Chat executor — produces Action objects from normalized chat input.
 *
 * No longer executes mutations directly. Instead:
 * 1. Receives normalized input
 * 2. Generates a proposal message (propose mode)
 * 3. Builds an Action object for the action executor (build mode)
 *
 * Execution is delegated to lib/actions/executor.ts.
 */
import type { NormalizedInput } from "./chat-normalizer";
import type { EstimatedNutritionEntry } from "./chat-scenarios";
import type { Action, ActionPayload } from "./actions/types";
import { createAction } from "./actions/executor";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExecutorStatus = "proposed" | "executed" | "info" | "error" | "clarify";

export type ExecutorResult = {
  message: string;
  status: ExecutorStatus;
  mutation?: string;
  data?: unknown;
  timestamp?: number;
};

// ---------------------------------------------------------------------------
// Propose — generate preview text, no DB writes
// ---------------------------------------------------------------------------

export function proposeAction(
  input: NormalizedInput,
  estimates?: EstimatedNutritionEntry[],
): ExecutorResult {
  switch (input.intent) {
    case "log_nutrition":
      return proposeNutrition(estimates ?? []);
    case "log_gym":
      return proposeSimple(input, "gym session");
    case "log_run":
      return proposeRun(input);
    case "mark_habit":
      return proposeSimple(input, `${input.title} as done`);
    case "increment_goal":
      return proposeIncrement(input);
    case "set_goal":
      return proposeGoal(input);
    case "add_category":
      return proposeCategory(input);
    case "query_progress":
      // Queries don't need confirmation — execute directly
      return { message: "", status: "info" };
    default:
      return {
        message: "I'm best at tracking habits and food — want to log something or check your progress?",
        status: "info",
      };
  }
}

// ---------------------------------------------------------------------------
// Build — construct an Action from normalized input (no DB writes)
// ---------------------------------------------------------------------------

export function buildAction(
  input: NormalizedInput,
  estimates?: EstimatedNutritionEntry[],
): Action | null {
  const payload = buildPayload(input, estimates);
  if (!payload) return null;

  return createAction({
    intent: input.intent as Action["intent"],
    userId: input.userId,
    categoryId: input.categoryId ?? null,
    categoryName: input.categoryName ?? null,
    payload,
    confidence: input.confidence,
  });
}

// ---------------------------------------------------------------------------
// Payload builders — NormalizedInput → ActionPayload
// ---------------------------------------------------------------------------

function buildPayload(
  input: NormalizedInput,
  estimates?: EstimatedNutritionEntry[],
): ActionPayload | null {
  switch (input.intent) {
    case "log_nutrition": {
      const entries = (estimates ?? []).map((e) => ({
        item: e.item,
        calories: e.calories,
        protein: e.protein,
        fat: e.fat,
        carbs: e.carbs,
        unknown: e.unknown,
      }));
      return { intent: "log_nutrition", entries };
    }
    case "log_gym": {
      const p = input.params as Record<string, unknown>;
      return {
        intent: "log_gym",
        bodyPart: typeof p.bodyPart === "string" ? p.bodyPart : undefined,
        notes: typeof p.notes === "string" ? p.notes : undefined,
      };
    }
    case "log_run": {
      const p = input.params as Record<string, unknown>;
      return {
        intent: "log_run",
        miles: typeof p.miles === "number" ? p.miles : input.count ?? 0,
        duration: typeof p.duration === "string" ? p.duration : undefined,
        notes: typeof p.notes === "string" ? p.notes : undefined,
      };
    }
    case "mark_habit": {
      const p = input.params as Record<string, unknown>;
      return {
        intent: "mark_habit",
        habit: typeof p.habit === "string" ? p.habit : input.title ?? "",
      };
    }
    case "increment_goal": {
      const p = input.params as Record<string, unknown>;
      return {
        intent: "increment_goal",
        habit: typeof p.habit === "string" ? p.habit : input.title ?? "",
        value: typeof p.value === "number" ? p.value : input.count ?? 1,
        unit: typeof p.unit === "string" ? p.unit : input.unit ?? "count",
      };
    }
    case "set_goal": {
      const p = input.params as Record<string, unknown>;
      return {
        intent: "set_goal",
        categoryName: typeof p.categoryName === "string" ? p.categoryName : "",
        metric: typeof p.metric === "string" ? p.metric : input.title ?? "sessions",
        target: typeof p.target === "number" ? p.target : input.count ?? 1,
        unit: typeof p.unit === "string" ? p.unit : input.unit,
        period: input.period === "weekly" ? "weekly" : "daily",
      };
    }
    case "add_category": {
      const p = input.params as Record<string, unknown>;
      return {
        intent: "add_category",
        name: typeof p.name === "string" ? p.name : input.title ?? "",
        type: typeof p.type === "string" ? (p.type as "gym" | "nutrition" | "running" | "custom") : undefined,
      };
    }
    case "query_progress": {
      const p = input.params as Record<string, unknown>;
      return {
        intent: "query_progress",
        timeframe: p.timeframe === "week" || p.timeframe === "month" ? p.timeframe : "today",
        category: typeof p.category === "string" ? p.category : undefined,
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Proposal formatters (no DB, no LLM, just text)
// ---------------------------------------------------------------------------

function proposeNutrition(estimates: EstimatedNutritionEntry[]): ExecutorResult {
  const known = estimates.filter((e) => !e.unknown);
  const unknowns = estimates.filter((e) => e.unknown);
  const lines: string[] = [];

  for (const e of known) {
    lines.push(`${e.item} — ~${e.calories} cal, ~${e.protein}g protein, ~${e.fat}g fat, ~${e.carbs}g carbs`);
  }

  if (unknowns.length > 0) {
    lines.push(`Not sure about ${unknowns.map((e) => e.item).join(", ")} — can you give me the rough macros?`);
  }

  if (known.length > 0) {
    const total = known.reduce((s, e) => s + e.calories, 0);
    lines.push(`Total: ~${total} cal (estimated). Sound right?`);
  }

  return { message: lines.join("\n"), status: "proposed" };
}

function proposeSimple(input: NormalizedInput, description: string): ExecutorResult {
  return {
    message: `Log ${description} for today? Sound right?`,
    status: "proposed",
  };
}

function proposeRun(input: NormalizedInput): ExecutorResult {
  const miles = input.count ?? 0;
  const duration = input.params.duration;
  const detail = duration ? `${miles} mi (${duration})` : `${miles} mi`;
  return {
    message: `Log ${detail} run for today? Sound right?`,
    status: "proposed",
  };
}

function proposeIncrement(input: NormalizedInput): ExecutorResult {
  return {
    message: `Log ${input.count} ${input.unit ?? ""} of ${input.title} for today? Sound right?`,
    status: "proposed",
  };
}

function proposeGoal(input: NormalizedInput): ExecutorResult {
  const metric = input.params.metric ?? "sessions";
  const target = input.count ?? 1;
  const period = input.period ?? "daily";
  return {
    message: `Create ${metric} goal: ${target} (${period}) for ${input.categoryName ?? input.title}. Go ahead?`,
    status: "proposed",
  };
}

function proposeCategory(input: NormalizedInput): ExecutorResult {
  const type = input.params.type ?? "custom";
  return {
    message: `Create "${input.title}" category (${type})? Go ahead?`,
    status: "proposed",
  };
}
