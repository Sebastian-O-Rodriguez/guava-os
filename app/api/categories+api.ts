import { z } from "zod";
import { prisma } from "../../lib/db";
import { getOrCreateUser } from "../../lib/user";
import type { CategoryType } from "../../lib/types";

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
// GET /api/categories — list all active categories (pass ?archived=true for all)
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("archived") === "true";

    const userId = await getOrCreateUser();
    const categories = await prisma.category.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { active: true }),
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({ success: true, data: categories as CategoryData[] });
  } catch (err) {
    console.error("[GET /api/categories]", err);
    return Response.json({ success: false, error: "Failed to fetch categories" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/categories — create a new category
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = CreateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
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

    return Response.json({ success: true, data: category as CategoryData }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/categories]", err);
    return Response.json({ success: false, error: "Failed to create category" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/categories — update a category (pass id in body)
// ---------------------------------------------------------------------------

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { id, ...rest } = body as { id?: string } & Record<string, unknown>;

    if (!id) {
      return Response.json({ success: false, error: "Missing category id" }, { status: 400 });
    }

    const parsed = UpdateCategorySchema.safeParse(rest);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const userId = await getOrCreateUser();

    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (!existing) {
      return Response.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json({ success: true, data: category as CategoryData });
  } catch (err) {
    console.error("[PATCH /api/categories]", err);
    return Response.json({ success: false, error: "Failed to update category" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/categories — delete a category (pass id as query param or body)
// ---------------------------------------------------------------------------

export async function DELETE(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    let id = url.searchParams.get("id");

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = (body as { id?: string }).id ?? null;
    }

    if (!id) {
      return Response.json({ success: false, error: "Missing category id" }, { status: 400 });
    }

    const userId = await getOrCreateUser();

    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (!existing) {
      return Response.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    await prisma.category.delete({ where: { id } });

    return Response.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error("[DELETE /api/categories]", err);
    return Response.json({ success: false, error: "Failed to delete category" }, { status: 500 });
  }
}
