"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { revalidatePath } from "next/cache";
import type { ActionResult, GoalPeriod } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const GoalPeriodSchema = z.enum(["daily", "weekly"]);

const UpsertGoalSchema = z.object({
  categoryId: z.string().min(1),
  metric: z.string().min(1).max(100),
  target: z.number().positive(),
  period: GoalPeriodSchema.optional().default("weekly"),
});

// ---------------------------------------------------------------------------
// Return shape for a goal (plain object, no Prisma types to client)
// ---------------------------------------------------------------------------

type GoalData = {
  id: string;
  categoryId: string;
  metric: string;
  target: number;
  period: GoalPeriod;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

/**
 * Create a new goal or update an existing one for the same (categoryId, metric) pair.
 * This upsert pattern prevents duplicate goals for the same metric.
 */
export async function upsertGoal(
  data: z.infer<typeof UpsertGoalSchema>,
): Promise<ActionResult<GoalData>> {
  try {
    const parsed = UpsertGoalSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const userId = await getOrCreateUser();

    // Verify the category belongs to this user
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId },
    });
    if (!category) {
      return { success: false, error: "Category not found" };
    }

    // Upsert: find existing goal by (categoryId, metric) or create new
    const existing = await prisma.goal.findFirst({
      where: {
        categoryId: parsed.data.categoryId,
        metric: parsed.data.metric,
        active: true,
      },
    });

    let goal;
    if (existing) {
      goal = await prisma.goal.update({
        where: { id: existing.id },
        data: {
          target: parsed.data.target,
          period: parsed.data.period,
        },
      });
    } else {
      goal = await prisma.goal.create({
        data: {
          categoryId: parsed.data.categoryId,
          metric: parsed.data.metric,
          target: parsed.data.target,
          period: parsed.data.period,
        },
      });
    }

    revalidatePath("/");
    revalidatePath("/progress");

    return { success: true, data: goal as GoalData };
  } catch (err) {
    console.error("[upsertGoal]", err);
    return { success: false, error: "Failed to upsert goal" };
  }
}

export async function getGoalsForCategory(categoryId: string): Promise<ActionResult<GoalData[]>> {
  try {
    const userId = await getOrCreateUser();

    // Verify ownership
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      return { success: false, error: "Category not found" };
    }

    const goals = await prisma.goal.findMany({
      where: { categoryId, active: true },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, data: goals as GoalData[] };
  } catch (err) {
    console.error("[getGoalsForCategory]", err);
    return { success: false, error: "Failed to fetch goals" };
  }
}

export async function getAllGoals(): Promise<ActionResult<GoalData[]>> {
  try {
    const userId = await getOrCreateUser();

    const goals = await prisma.goal.findMany({
      where: {
        category: { userId },
        active: true,
      },
      orderBy: [{ categoryId: "asc" }, { createdAt: "asc" }],
    });

    return { success: true, data: goals as GoalData[] };
  } catch (err) {
    console.error("[getAllGoals]", err);
    return { success: false, error: "Failed to fetch goals" };
  }
}

export async function deleteGoal(id: string): Promise<ActionResult<{ deleted: true }>> {
  try {
    const userId = await getOrCreateUser();

    // Verify ownership via category
    const goal = await prisma.goal.findFirst({
      where: { id, category: { userId } },
    });
    if (!goal) {
      return { success: false, error: "Goal not found" };
    }

    await prisma.goal.delete({ where: { id } });

    revalidatePath("/");
    revalidatePath("/progress");

    return { success: true, data: { deleted: true } };
  } catch (err) {
    console.error("[deleteGoal]", err);
    return { success: false, error: "Failed to delete goal" };
  }
}
