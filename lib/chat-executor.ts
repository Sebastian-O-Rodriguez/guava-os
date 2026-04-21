/**
 * Chat executor — thin router that dispatches to deterministic scripts.
 *
 * No business logic here. The executor:
 * 1. Receives normalized input
 * 2. Generates a proposal message (propose mode)
 * 3. Dispatches to the correct script (execute mode)
 * 4. Returns the ScriptResult
 */
import type { NormalizedInput } from "./chat-normalizer";
import type { ScriptResult } from "./scripts/types";
import type { EstimatedNutritionEntry } from "./chat-scenarios";

// Script imports
import { logNutrition } from "./scripts/mutations/log-nutrition";
import { logGym } from "./scripts/mutations/log-gym";
import { logRun } from "./scripts/mutations/log-run";
import { markHabit } from "./scripts/mutations/mark-habit";
import { incrementGoal } from "./scripts/mutations/increment-goal";
import { setGoal } from "./scripts/mutations/set-goal";
import { addCategory } from "./scripts/mutations/add-category";
import { queryProgress } from "./scripts/queries/query-progress";

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
// Execute — dispatch to script, return result
// ---------------------------------------------------------------------------

export async function executeAction(
  input: NormalizedInput,
  estimates?: EstimatedNutritionEntry[],
): Promise<ExecutorResult> {
  // Queries execute directly (no confirmation needed)
  if (input.intent === "query_progress") {
    const result = await queryProgress(input);
    return scriptToExecutorResult(result, "info");
  }

  // Unknown — no script to call
  if (input.intent === "unknown") {
    return {
      message: "I'm best at tracking habits and food — want to log something or check your progress?",
      status: "info",
    };
  }

  // Missing category for intents that need one
  if (!input.categoryId && needsCategory(input.intent)) {
    const name = input.title ?? input.categoryName ?? "that";
    return {
      message: `No "${name}" category found. Want to create one?`,
      status: "clarify",
    };
  }

  // Dispatch to script
  let result: ScriptResult;
  switch (input.intent) {
    case "log_nutrition":
      result = await logNutrition(input, estimates ?? []);
      break;
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
      return {
        message: "I'm best at tracking habits and food — want to log something or check your progress?",
        status: "info",
      };
  }

  return scriptToExecutorResult(result, "executed");
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scriptToExecutorResult(result: ScriptResult, defaultStatus: ExecutorStatus): ExecutorResult {
  if (!result.success) {
    return {
      message: result.error ?? "Something went wrong — try again?",
      status: "error",
    };
  }
  return {
    message: result.summary ?? "Done.",
    status: defaultStatus,
    mutation: result.mutation,
    data: result.data,
    timestamp: Date.now(),
  };
}

function needsCategory(intent: string): boolean {
  return [
    "log_nutrition", "log_gym", "log_run",
    "mark_habit", "increment_goal", "set_goal",
  ].includes(intent);
}
