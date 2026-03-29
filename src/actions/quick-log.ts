"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { normalizeDate, getWeekStart, getWeekEnd } from "@/lib/dates";

export async function quickAddNutrition(
  macro: "calories" | "protein" | "fat" | "carbs",
  amount: number,
) {
  try {
    const userId = await getOrCreateUser();
    const nutritionCat = await prisma.category.findFirst({
      where: { userId, type: "nutrition", active: true },
    });
    if (!nutritionCat) return { success: false as const, error: "No nutrition category" };

    const entry = { item: `+${amount} ${macro}`, calories: 0, protein: 0, fat: 0, carbs: 0 };
    entry[macro] = amount;

    await prisma.log.create({
      data: {
        categoryId: nutritionCat.id,
        date: normalizeDate(new Date()),
        data: entry as object,
      },
    });

    revalidatePath("/");
    return { success: true as const };
  } catch (err) {
    console.error("[quickAddNutrition]", err);
    return { success: false as const, error: "Failed to log nutrition" };
  }
}

export async function toggleGymSession(bodyPart: string) {
  try {
    const userId = await getOrCreateUser();
    const gymCat = await prisma.category.findFirst({
      where: { userId, type: "gym", active: true },
    });
    if (!gymCat) return { success: false as const, error: "No gym category" };

    const now = new Date();
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);

    const existing = await prisma.log.findMany({
      where: {
        categoryId: gymCat.id,
        date: { gte: weekStart, lte: weekEnd },
      },
    });

    const match = existing.find((log) => {
      const data = log.data as { bodyPart?: string };
      return data.bodyPart?.toLowerCase() === bodyPart.toLowerCase();
    });

    if (match) {
      await prisma.log.delete({ where: { id: match.id } });
    } else {
      await prisma.log.create({
        data: {
          categoryId: gymCat.id,
          date: normalizeDate(now),
          data: { bodyPart: bodyPart.toLowerCase() } as object,
        },
      });
    }

    revalidatePath("/");
    return { success: true as const, toggled: !match };
  } catch (err) {
    console.error("[toggleGymSession]", err);
    return { success: false as const, error: "Failed to toggle gym session" };
  }
}

export async function quickAddRun(miles: number) {
  try {
    const userId = await getOrCreateUser();
    const runCat = await prisma.category.findFirst({
      where: { userId, type: "running", active: true },
    });
    if (!runCat) return { success: false as const, error: "No running category" };

    await prisma.log.create({
      data: {
        categoryId: runCat.id,
        date: normalizeDate(new Date()),
        data: { miles } as object,
      },
    });

    revalidatePath("/");
    return { success: true as const };
  } catch (err) {
    console.error("[quickAddRun]", err);
    return { success: false as const, error: "Failed to log run" };
  }
}
