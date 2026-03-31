import { z } from "zod";
import { prisma } from "../../lib/db";
import { getOrCreateUser } from "../../lib/user";
import type { GoalPeriod } from "../../lib/types";

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
// GET /api/goals — list goals
//   ?categoryId=<id>  → goals for one category
//   (no param)        → all goals for all user categories
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get("categoryId");
    const userId = await getOrCreateUser();

    let goals: GoalData[];

    if (categoryId) {
      // Verify ownership
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
      if (!category) {
        return Response.json({ success: false, error: "Category not found" }, { status: 404 });
      }

      goals = (await prisma.goal.findMany({
        where: { categoryId, active: true },
        orderBy: { createdAt: "asc" },
      })) as GoalData[];
    } else {
      goals = (await prisma.goal.findMany({
        where: { category: { userId }, active: true },
        orderBy: [{ categoryId: "asc" }, { createdAt: "asc" }],
      })) as GoalData[];
    }

    return Response.json({ success: true, data: goals });
  } catch (err) {
    console.error("[GET /api/goals]", err);
    return Response.json({ success: false, error: "Failed to fetch goals" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/goals — upsert a goal (create or update by categoryId + metric)
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = UpsertGoalSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const userId = await getOrCreateUser();

    // Verify the category belongs to this user
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId },
    });
    if (!category) {
      return Response.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    // Upsert: find existing goal by (categoryId, metric) or create new
    const existing = await prisma.goal.findFirst({
      where: {
        categoryId: parsed.data.categoryId,
        metric: parsed.data.metric,
        active: true,
      },
    });

    let goal: GoalData;
    if (existing) {
      goal = (await prisma.goal.update({
        where: { id: existing.id },
        data: {
          target: parsed.data.target,
          period: parsed.data.period,
        },
      })) as GoalData;
    } else {
      goal = (await prisma.goal.create({
        data: {
          categoryId: parsed.data.categoryId,
          metric: parsed.data.metric,
          target: parsed.data.target,
          period: parsed.data.period,
        },
      })) as GoalData;
    }

    return Response.json({ success: true, data: goal }, { status: existing ? 200 : 201 });
  } catch (err) {
    console.error("[POST /api/goals]", err);
    return Response.json({ success: false, error: "Failed to upsert goal" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/goals — delete a goal (pass id as query param or body)
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
      return Response.json({ success: false, error: "Missing goal id" }, { status: 400 });
    }

    const userId = await getOrCreateUser();

    // Verify ownership via category
    const goal = await prisma.goal.findFirst({
      where: { id, category: { userId } },
    });
    if (!goal) {
      return Response.json({ success: false, error: "Goal not found" }, { status: 404 });
    }

    await prisma.goal.delete({ where: { id } });

    return Response.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error("[DELETE /api/goals]", err);
    return Response.json({ success: false, error: "Failed to delete goal" }, { status: 500 });
  }
}
