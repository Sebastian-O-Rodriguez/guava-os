import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase";
import { requireAuth } from "../../lib/auth-server";
import { generateId } from "../../lib/id";
import type { GoalPeriod, GoalUnit } from "../../lib/types";
import { GOAL_UNITS } from "../../lib/types";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const GoalPeriodSchema = z.enum(["daily", "weekly"]);

const GoalUnitSchema = z.enum(GOAL_UNITS as [string, ...string[]]);

const UpsertGoalSchema = z.object({
  categoryId: z.string().min(1),
  metric: z.string().min(1).max(100),
  unit: GoalUnitSchema.optional().default("count"),
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
  unit: string;
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
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const userId = authResult;

    const url = new URL(request.url);
    const categoryId = url.searchParams.get("categoryId");

    let goals: GoalData[];

    if (categoryId) {
      // Verify ownership
      const { data: category } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("id", categoryId)
        .eq("user_id", userId)
        .single();

      if (!category) {
        return Response.json({ success: false, error: "Category not found" }, { status: 404 });
      }

      const { data, error } = await supabaseAdmin
        .from("goals")
        .select("*")
        .eq("category_id", categoryId)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      goals = (data ?? []) as GoalData[];
    } else {
      // Fetch all active category IDs for this user first, then fetch goals
      const { data: categories, error: catError } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .eq("active", true);

      if (catError) throw catError;

      const categoryIds = (categories ?? []).map((c: { id: string }) => c.id);

      if (categoryIds.length === 0) {
        return Response.json({ success: true, data: [] });
      }

      const { data, error } = await supabaseAdmin
        .from("goals")
        .select("*")
        .in("category_id", categoryIds)
        .eq("active", true)
        .order("category_id", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      goals = (data ?? []) as GoalData[];
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
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const userId = authResult;

    const body = await request.json();
    const parsed = UpsertGoalSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    // Verify the category belongs to this user
    const { data: category } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("id", parsed.data.categoryId)
      .eq("user_id", userId)
      .single();

    if (!category) {
      return Response.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    // Upsert: find existing goal by (categoryId, metric) or create new
    const { data: existing } = await supabaseAdmin
      .from("goals")
      .select("id")
      .eq("category_id", parsed.data.categoryId)
      .eq("metric", parsed.data.metric)
      .eq("active", true)
      .single();

    let goal: GoalData;
    let isNew: boolean;

    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from("goals")
        .update({
          target: parsed.data.target,
          unit: parsed.data.unit,
          period: parsed.data.period,
        })
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      goal = updated as GoalData;
      isNew = false;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("goals")
        .insert({
          id: generateId(),
          user_id: userId,
          category_id: parsed.data.categoryId,
          metric: parsed.data.metric,
          unit: parsed.data.unit,
          target: parsed.data.target,
          period: parsed.data.period,
        })
        .select()
        .single();

      if (error) throw error;
      goal = created as GoalData;
      isNew = true;
    }

    return Response.json({ success: true, data: goal }, { status: isNew ? 201 : 200 });
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
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const userId = authResult;

    const url = new URL(request.url);
    let id = url.searchParams.get("id");

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = (body as { id?: string }).id ?? null;
    }

    if (!id) {
      return Response.json({ success: false, error: "Missing goal id" }, { status: 400 });
    }

    // Verify ownership via category join
    const { data: goal } = await supabaseAdmin
      .from("goals")
      .select("id, categories!inner(user_id)")
      .eq("id", id)
      .single();

    const goalRow = goal as { id: string; categories: { user_id: string } } | null;

    if (!goalRow || goalRow.categories.user_id !== userId) {
      return Response.json({ success: false, error: "Goal not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin.from("goals").delete().eq("id", id).eq("user_id", userId);

    if (error) throw error;

    return Response.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error("[DELETE /api/goals]", err);
    return Response.json({ success: false, error: "Failed to delete goal" }, { status: 500 });
  }
}
