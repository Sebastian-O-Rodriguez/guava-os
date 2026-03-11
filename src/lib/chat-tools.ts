import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  createHabit,
  updateHabit,
  deleteHabit,
  getHabits,
} from "@/actions/habits";
import type { FrequencyConfig } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tool definitions for OpenAI-compatible API (OpenRouter)
// ---------------------------------------------------------------------------

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_habit",
      description:
        "Create a new habit with a name and frequency. Use this when the user wants to start tracking something new.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The habit name, e.g. 'Gym', 'Meditate', 'Read'",
          },
          frequency_type: {
            type: "string",
            enum: ["daily", "scheduled", "weekly"],
            description:
              "daily = every day, scheduled = specific days of the week, weekly = X times per week any days",
          },
          days: {
            type: "array",
            items: {
              type: "string",
              enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
            },
            description:
              "Required when frequency_type is 'scheduled'. Which days of the week.",
          },
          times_per_week: {
            type: "number",
            description:
              "Required when frequency_type is 'weekly'. How many times per week (1-7).",
          },
        },
        required: ["name", "frequency_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_habit",
      description:
        "Update an existing habit's name or frequency. Use list_habits first to find the habit ID.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The habit ID (from list_habits)",
          },
          name: {
            type: "string",
            description: "New name (optional)",
          },
          frequency_type: {
            type: "string",
            enum: ["daily", "scheduled", "weekly"],
            description: "New frequency type (optional)",
          },
          days: {
            type: "array",
            items: {
              type: "string",
              enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
            },
            description: "New days (required if frequency_type is 'scheduled')",
          },
          times_per_week: {
            type: "number",
            description: "New times per week (required if frequency_type is 'weekly')",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_habit",
      description:
        "Permanently delete a habit and all its completion history. Use list_habits first to find the habit ID.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The habit ID (from list_habits)",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_habits",
      description:
        "List all current habits with their IDs, names, and frequencies. Use this to see what exists before creating, updating, or deleting.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor — calls the actual server actions
// ---------------------------------------------------------------------------

/**
 * Build a FrequencyConfig from flat tool call args.
 */
function buildFrequency(args: Record<string, unknown>): FrequencyConfig {
  const freqType = args.frequency_type as string | undefined;

  if (freqType === "scheduled" && Array.isArray(args.days)) {
    return { type: "scheduled", days: args.days as string[] };
  }
  if (freqType === "weekly" && args.times_per_week != null) {
    return { type: "weekly", timesPerWeek: Number(args.times_per_week) };
  }
  return { type: "daily" };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "create_habit": {
      const frequency = buildFrequency(args);

      const result = await createHabit({
        name: args.name as string,
        frequency,
      });
      if (result.success) {
        return JSON.stringify({
          success: true,
          habit: {
            id: result.data.id,
            name: result.data.name,
            frequency: result.data.frequency,
          },
        });
      }
      return JSON.stringify({ success: false, error: result.error });
    }

    case "update_habit": {
      const updateData: { name?: string; frequency?: FrequencyConfig } = {};
      if (args.name) updateData.name = args.name as string;
      if (args.frequency_type) updateData.frequency = buildFrequency(args);

      const result = await updateHabit(args.id as string, updateData);
      if (result.success) {
        return JSON.stringify({
          success: true,
          habit: {
            id: result.data.id,
            name: result.data.name,
            frequency: result.data.frequency,
          },
        });
      }
      return JSON.stringify({ success: false, error: result.error });
    }

    case "delete_habit": {
      const result = await deleteHabit(args.id as string);
      if (result.success) {
        return JSON.stringify({ success: true, deletedId: result.data.id });
      }
      return JSON.stringify({ success: false, error: result.error });
    }

    case "list_habits": {
      const result = await getHabits();
      if (result.success) {
        return JSON.stringify({
          success: true,
          habits: result.data.map((h) => ({
            id: h.id,
            name: h.name,
            frequency: h.frequency,
            active: h.active,
          })),
        });
      }
      return JSON.stringify({ success: false, error: result.error });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
