"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { revalidatePath } from "next/cache";
import type { ActionResult, CategoryType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CategoryTypeSchema = z.enum(["gym", "nutrition", "running", "custom"]);

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: CategoryTypeSchema.optional().default("custom"),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Return shape for a category (plain object, no Prisma types to client)
// ---------------------------------------------------------------------------

type CategoryData = {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

export async function createCategory(
  data: z.infer<typeof CreateCategorySchema>,
): Promise<ActionResult<CategoryData>> {
  try {
    const parsed = CreateCategorySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const userId = await getOrCreateUser();
    const category = await prisma.category.create({
      data: {
        userId,
        name: parsed.data.name,
        type: parsed.data.type,
        icon: parsed.data.icon ?? null,
        color: parsed.data.color ?? null,
      },
    });

    revalidatePath("/");
    revalidatePath("/progress");

    return {
      success: true,
      data: category as CategoryData,
    };
  } catch (err) {
    console.error("[createCategory]", err);
    return { success: false, error: "Failed to create category" };
  }
}

export async function getCategories(
  includeArchived = false,
): Promise<ActionResult<CategoryData[]>> {
  try {
    const userId = await getOrCreateUser();
    const categories = await prisma.category.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { active: true }),
      },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, data: categories as CategoryData[] };
  } catch (err) {
    console.error("[getCategories]", err);
    return { success: false, error: "Failed to fetch categories" };
  }
}

export async function updateCategory(
  id: string,
  data: z.infer<typeof UpdateCategorySchema>,
): Promise<ActionResult<CategoryData>> {
  try {
    const parsed = UpdateCategorySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const userId = await getOrCreateUser();

    // Verify ownership
    const existing = await prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return { success: false, error: "Category not found" };
    }

    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });

    revalidatePath("/");
    revalidatePath("/progress");

    return { success: true, data: category as CategoryData };
  } catch (err) {
    console.error("[updateCategory]", err);
    return { success: false, error: "Failed to update category" };
  }
}

export async function deleteCategory(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    const userId = await getOrCreateUser();

    // Verify ownership
    const existing = await prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return { success: false, error: "Category not found" };
    }

    await prisma.category.delete({ where: { id } });

    revalidatePath("/");
    revalidatePath("/progress");

    return { success: true, data: { deleted: true } };
  } catch (err) {
    console.error("[deleteCategory]", err);
    return { success: false, error: "Failed to delete category" };
  }
}
