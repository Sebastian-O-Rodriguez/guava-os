import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase";
import { requireAuth } from "../../lib/auth-server";
import { rateLimit, getClientIp } from "../../lib/rate-limit";
import { generateId } from "../../lib/id";
import { normalizeDate, getWeekStart, getWeekEnd } from "../../lib/dates";
import { resolveCategory } from "../../lib/scripts/helpers";
import { createAction, executeAction } from "../../lib/actions/executor";
import type { ActionResult } from "../../lib/actions/types";

// ---------------------------------------------------------------------------
// Validation schema for the request body
// ---------------------------------------------------------------------------

const QuickLogSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_nutrition"),
    macro: z.enum(["calories", "protein", "fat", "carbs"]),
    amount: z.number(),
  }),
  z.object({
    action: z.literal("log_food"),
    item: z.string().min(1).max(200),
    calories: z.number().min(0).default(0),
    protein: z.number().min(0).default(0),
    fat: z.number().min(0).default(0),
    carbs: z.number().min(0).default(0),
  }),
  z.object({
    action: z.literal("remove_nutrition"),
    macro: z.enum(["calories", "protein", "fat", "carbs"]),
    amount: z.number(),
  }),
  z.object({
    action: z.literal("increment_gym"),
    bodyPart: z.string().min(1),
  }),
  z.object({
    action: z.literal("log_gym"),
    bodyPart: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("decrement_gym"),
    bodyPart: z.string().min(1),
  }),
  z.object({
    action: z.literal("toggle_gym"),
    bodyPart: z.string().min(1),
  }),
  z.object({
    action: z.literal("add_run"),
    miles: z.number().positive(),
    duration: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("remove_run"),
    miles: z.number().positive(),
  }),
  z.object({
    action: z.literal("increment_goal"),
    categoryId: z.string().min(1),
    amount: z.number().positive(),
    unit: z.string().optional().default("count"),
  }),
]);

// ---------------------------------------------------------------------------
// Helper: ISO date string (YYYY-MM-DD) from a Date
// ---------------------------------------------------------------------------

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// POST /api/quick-log — dispatch based on action type in body
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  try {
    // Rate limit — 60 requests per minute per IP
    const rl = rateLimit(`quick-log:${getClientIp(request)}`, 60, 60_000);
    if (rl) return rl;

    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const userId = authResult;

    const body = await request.json();
    const parsed = QuickLogSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const data = parsed.data;

    switch (data.action) {
      case "add_nutrition":
        return handleAddNutrition(userId, data.macro, data.amount);

      case "log_food":
        return handleLogFood(userId, data.item, data.calories, data.protein, data.fat, data.carbs);

      case "remove_nutrition":
        return handleRemoveNutrition(userId, data.macro, data.amount);

      case "increment_gym":
        return handleIncrementGym(userId, data.bodyPart);

      case "log_gym":
        return handleLogGymSession(userId, data.bodyPart, data.notes);

      case "decrement_gym":
        return handleDecrementGym(userId, data.bodyPart);

      case "toggle_gym":
        return handleToggleGym(userId, data.bodyPart);

      case "add_run":
        return handleAddRun(userId, data.miles, data.duration, data.notes);

      case "remove_run":
        return handleRemoveRun(userId, data.miles);

      case "increment_goal":
        return handleIncrementGoal(userId, data.categoryId, data.amount, data.unit);
    }
  } catch (err) {
    console.error("[POST /api/quick-log]", err);
    return Response.json(
      { success: false, error: "Failed to process quick log" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Executor → Response helper
// ---------------------------------------------------------------------------

function actionResultToResponse(result: ActionResult): Response {
  if (!result.success) {
    return Response.json(
      { success: false, error: result.message },
      { status: 400 },
    );
  }
  return Response.json({
    success: true,
    mutation: result.mutation,
    message: result.message,
    data: result.data,
  });
}

// ---------------------------------------------------------------------------
// Action handlers — forward mutations routed through executor
// ---------------------------------------------------------------------------

async function handleAddNutrition(
  userId: string,
  macro: "calories" | "protein" | "fat" | "carbs",
  amount: number,
): Promise<Response> {
  const cat = await resolveCategory(userId, "nutrition");
  const entry = { item: `+${amount} ${macro}`, calories: 0, protein: 0, fat: 0, carbs: 0, unknown: false };
  entry[macro] = amount;

  const action = createAction({
    intent: "log_nutrition",
    userId,
    categoryId: cat.id,
    categoryName: cat.name,
    payload: { intent: "log_nutrition", entries: [entry] },
    confidence: 1,
  });

  return actionResultToResponse(await executeAction(action));
}

async function handleLogFood(
  userId: string,
  item: string,
  calories: number,
  protein: number,
  fat: number,
  carbs: number,
): Promise<Response> {
  const cat = await resolveCategory(userId, "nutrition");

  const action = createAction({
    intent: "log_nutrition",
    userId,
    categoryId: cat.id,
    categoryName: cat.name,
    payload: {
      intent: "log_nutrition",
      entries: [{ item, calories, protein, fat, carbs }],
    },
    confidence: 1,
  });

  return actionResultToResponse(await executeAction(action));
}

async function handleLogGymSession(
  userId: string,
  bodyPart?: string,
  notes?: string,
): Promise<Response> {
  const cat = await resolveCategory(userId, "gym");

  const action = createAction({
    intent: "log_gym",
    userId,
    categoryId: cat.id,
    categoryName: cat.name,
    payload: { intent: "log_gym", bodyPart, notes },
    confidence: 1,
  });

  return actionResultToResponse(await executeAction(action));
}

async function handleRemoveNutrition(
  userId: string,
  macro: "calories" | "protein" | "fat" | "carbs",
  amount: number,
): Promise<Response> {
  const cat = await resolveCategory(userId, "nutrition");

  const entry = { item: `-${amount} ${macro}`, calories: 0, protein: 0, fat: 0, carbs: 0 };
  entry[macro] = -amount;

  const { error } = await supabaseAdmin.from("logs").insert({
    id: generateId(),
    user_id: userId,
    category_id: cat.id,
    date: toISODate(normalizeDate(new Date())),
    data: entry,
  });

  if (error) throw error;

  return Response.json({ success: true });
}

async function handleIncrementGym(userId: string, bodyPart: string): Promise<Response> {
  const cat = await resolveCategory(userId, "gym");

  const action = createAction({
    intent: "log_gym",
    userId,
    categoryId: cat.id,
    categoryName: cat.name,
    payload: { intent: "log_gym", bodyPart: bodyPart.toLowerCase() },
    confidence: 1,
  });

  return actionResultToResponse(await executeAction(action));
}

async function handleDecrementGym(userId: string, bodyPart: string): Promise<Response> {
  const cat = await resolveCategory(userId, "gym");

  const now = new Date();
  const isoStart = toISODate(getWeekStart(now));
  const isoEnd = toISODate(getWeekEnd(now));

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("logs")
    .select("id, data")
    .eq("category_id", cat.id)
    .gte("date", isoStart)
    .lte("date", isoEnd)
    .order("created_at", { ascending: false });

  if (fetchError) throw fetchError;

  const match = (existing ?? []).find((log) => {
    const d = log.data as { bodyPart?: string };
    return d.bodyPart?.toLowerCase() === bodyPart.toLowerCase();
  });

  if (match) {
    const { error } = await supabaseAdmin.from("logs").delete().eq("id", match.id);
    if (error) throw error;
  }

  return Response.json({ success: true });
}

async function handleToggleGym(userId: string, bodyPart: string): Promise<Response> {
  const cat = await resolveCategory(userId, "gym");

  const now = new Date();
  const isoStart = toISODate(getWeekStart(now));
  const isoEnd = toISODate(getWeekEnd(now));

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("logs")
    .select("id, data")
    .eq("category_id", cat.id)
    .gte("date", isoStart)
    .lte("date", isoEnd);

  if (fetchError) throw fetchError;

  const match = (existing ?? []).find((log) => {
    const d = log.data as { bodyPart?: string };
    return d.bodyPart?.toLowerCase() === bodyPart.toLowerCase();
  });

  if (match) {
    const { error } = await supabaseAdmin.from("logs").delete().eq("id", match.id);
    if (error) throw error;
    return Response.json({ success: true, toggled: false });
  } else {
    const { error } = await supabaseAdmin.from("logs").insert({
      id: generateId(),
      user_id: userId,
      category_id: cat.id,
      date: toISODate(normalizeDate(now)),
      data: { bodyPart: bodyPart.toLowerCase(), count: 1 },
    });
    if (error) throw error;
    return Response.json({ success: true, toggled: true });
  }
}

async function handleAddRun(userId: string, miles: number, duration?: string, notes?: string): Promise<Response> {
  const cat = await resolveCategory(userId, "running");

  const action = createAction({
    intent: "log_run",
    userId,
    categoryId: cat.id,
    categoryName: cat.name,
    payload: { intent: "log_run", miles, duration, notes },
    confidence: 1,
  });

  return actionResultToResponse(await executeAction(action));
}

async function handleRemoveRun(userId: string, miles: number): Promise<Response> {
  const cat = await resolveCategory(userId, "running");

  // Create a negative log entry (mirrors Next.js behavior)
  const { error } = await supabaseAdmin.from("logs").insert({
    id: generateId(),
    user_id: userId,
    category_id: cat.id,
    date: toISODate(normalizeDate(new Date())),
    data: { miles: -miles },
  });

  if (error) throw error;

  return Response.json({ success: true });
}

async function handleIncrementGoal(
  userId: string,
  categoryId: string,
  amount: number,
  unit: string,
): Promise<Response> {
  // Verify category belongs to user before constructing action
  const { data: cat } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .eq("id", categoryId)
    .eq("user_id", userId)
    .eq("active", true)
    .single();

  if (!cat) {
    return Response.json({ success: false, error: "Category not found" }, { status: 404 });
  }

  const action = createAction({
    intent: "increment_goal",
    userId,
    categoryId: cat.id,
    categoryName: (cat as { id: string; name: string }).name,
    payload: {
      intent: "increment_goal",
      habit: (cat as { id: string; name: string }).name,
      value: amount,
      unit,
    },
    confidence: 1,
  });

  return actionResultToResponse(await executeAction(action));
}
