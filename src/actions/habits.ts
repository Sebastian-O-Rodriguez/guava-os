"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import type { ActionResult, FrequencyConfig } from "@/lib/types";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const frequencySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("weekdays") }),
  z.object({
    type: z.literal("custom"),
    days: z
      .array(
        z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      )
      .min(1, "At least one day is required for custom frequency"),
  }),
]);

const habitNameSchema = z
  .string()
  .trim()
  .min(1, "Habit name cannot be empty")
  .max(100, "Habit name must be 100 characters or less");

const createHabitSchema = z.object({
  name: habitNameSchema,
  frequency: frequencySchema.optional(),
});

const updateHabitSchema = z.object({
  name: habitNameSchema.optional(),
  frequency: frequencySchema.optional(),
  active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

export async function createHabit(data: {
  name: string;
  frequency?: FrequencyConfig;
}): Promise<ActionResult<{ id: string; name: string; frequency: FrequencyConfig; active: boolean; createdAt: Date }>> {
  try {
    const parsed = createHabitSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const userId = await getOrCreateUser();

    const habit = await prisma.habit.create({
      data: {
        userId,
        name: parsed.data.name,
        frequency: (parsed.data.frequency ?? { type: "daily" }) as object,
      },
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return {
      success: true,
      data: {
        id: habit.id,
        name: habit.name,
        frequency: habit.frequency as unknown as FrequencyConfig,
        active: habit.active,
        createdAt: habit.createdAt,
      },
    };
  } catch (err) {
    console.error("createHabit error:", err);
    return { success: false, error: "Failed to create habit" };
  }
}

export async function updateHabit(
  id: string,
  data: { name?: string; frequency?: FrequencyConfig; active?: boolean },
): Promise<ActionResult<{ id: string; name: string; frequency: FrequencyConfig; active: boolean }>> {
  try {
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid habit id" };
    }

    const parsed = updateHabitSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { name, frequency, active } = parsed.data;

    // Build update payload — only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (frequency !== undefined) updateData.frequency = frequency as object;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No fields to update" };
    }

    const habit = await prisma.habit.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return {
      success: true,
      data: {
        id: habit.id,
        name: habit.name,
        frequency: habit.frequency as unknown as FrequencyConfig,
        active: habit.active,
      },
    };
  } catch (err) {
    console.error("updateHabit error:", err);
    return { success: false, error: "Failed to update habit" };
  }
}

export async function archiveHabit(
  id: string,
): Promise<ActionResult<{ id: string; active: boolean }>> {
  try {
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid habit id" };
    }

    const habit = await prisma.habit.update({
      where: { id },
      data: { active: false },
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return {
      success: true,
      data: { id: habit.id, active: habit.active },
    };
  } catch (err) {
    console.error("archiveHabit error:", err);
    return { success: false, error: "Failed to archive habit" };
  }
}

export async function getHabits(
  includeArchived: boolean = false,
): Promise<ActionResult<Array<{ id: string; name: string; frequency: FrequencyConfig; active: boolean; createdAt: Date }>>> {
  try {
    const userId = await getOrCreateUser();

    const habits = await prisma.habit.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { active: true }),
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      success: true,
      data: habits.map((h) => ({
        id: h.id,
        name: h.name,
        frequency: h.frequency as unknown as FrequencyConfig,
        active: h.active,
        createdAt: h.createdAt,
      })),
    };
  } catch (err) {
    console.error("getHabits error:", err);
    return { success: false, error: "Failed to fetch habits" };
  }
}

export async function getHabit(
  id: string,
): Promise<ActionResult<{ id: string; name: string; frequency: FrequencyConfig; active: boolean; createdAt: Date }>> {
  try {
    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid habit id" };
    }

    const habit = await prisma.habit.findUnique({ where: { id } });

    if (!habit) {
      return { success: false, error: "Habit not found" };
    }

    return {
      success: true,
      data: {
        id: habit.id,
        name: habit.name,
        frequency: habit.frequency as unknown as FrequencyConfig,
        active: habit.active,
        createdAt: habit.createdAt,
      },
    };
  } catch (err) {
    console.error("getHabit error:", err);
    return { success: false, error: "Failed to fetch habit" };
  }
}
