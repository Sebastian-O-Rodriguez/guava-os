import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase";
import { getOrCreateUser } from "../../lib/user-sb";
import { generateId } from "../../lib/id";
import { normalizeDate, getWeekStart, getWeekEnd } from "../../lib/dates";

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
    action: z.literal("remove_nutrition"),
    macro: z.enum(["calories", "protein", "fat", "carbs"]),
    amount: z.number(),
  }),
  z.object({
    action: z.literal("increment_gym"),
    bodyPart: z.string().min(1),
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
  }),
  z.object({
    action: z.literal("remove_run"),
    miles: z.number().positive(),
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
    const body = await request.json();
    const parsed = QuickLogSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const userId = await getOrCreateUser();
    const data = parsed.data;

    switch (data.action) {
      case "add_nutrition":
        return handleAddNutrition(userId, data.macro, data.amount);

      case "remove_nutrition":
        return handleRemoveNutrition(userId, data.macro, data.amount);

      case "increment_gym":
        return handleIncrementGym(userId, data.bodyPart);

      case "decrement_gym":
        return handleDecrementGym(userId, data.bodyPart);

      case "toggle_gym":
        return handleToggleGym(userId, data.bodyPart);

      case "add_run":
        return handleAddRun(userId, data.miles);

      case "remove_run":
        return handleRemoveRun(userId, data.miles);
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
// Action handlers
// ---------------------------------------------------------------------------

async function handleAddNutrition(
  userId: string,
  macro: "calories" | "protein" | "fat" | "carbs",
  amount: number,
): Promise<Response> {
  const { data: nutritionCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "nutrition")
    .eq("active", true)
    .single();

  if (!nutritionCat) {
    return Response.json({ success: false, error: "No nutrition category" }, { status: 404 });
  }

  const entry = { item: `+${amount} ${macro}`, calories: 0, protein: 0, fat: 0, carbs: 0 };
  entry[macro] = amount;

  const { error } = await supabaseAdmin.from("logs").insert({
    id: generateId(),
    category_id: nutritionCat.id,
    date: toISODate(normalizeDate(new Date())),
    data: entry,
  });

  if (error) throw error;

  return Response.json({ success: true });
}

async function handleRemoveNutrition(
  userId: string,
  macro: "calories" | "protein" | "fat" | "carbs",
  amount: number,
): Promise<Response> {
  const { data: nutritionCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "nutrition")
    .eq("active", true)
    .single();

  if (!nutritionCat) {
    return Response.json({ success: false, error: "No nutrition category" }, { status: 404 });
  }

  const entry = { item: `-${amount} ${macro}`, calories: 0, protein: 0, fat: 0, carbs: 0 };
  entry[macro] = -amount;

  const { error } = await supabaseAdmin.from("logs").insert({
    id: generateId(),
    category_id: nutritionCat.id,
    date: toISODate(normalizeDate(new Date())),
    data: entry,
  });

  if (error) throw error;

  return Response.json({ success: true });
}

async function handleIncrementGym(userId: string, bodyPart: string): Promise<Response> {
  const { data: gymCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "gym")
    .eq("active", true)
    .single();

  if (!gymCat) {
    return Response.json({ success: false, error: "No gym category" }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("logs").insert({
    id: generateId(),
    category_id: gymCat.id,
    date: toISODate(normalizeDate(new Date())),
    data: { bodyPart: bodyPart.toLowerCase() },
  });

  if (error) throw error;

  return Response.json({ success: true });
}

async function handleDecrementGym(userId: string, bodyPart: string): Promise<Response> {
  const { data: gymCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "gym")
    .eq("active", true)
    .single();

  if (!gymCat) {
    return Response.json({ success: false, error: "No gym category" }, { status: 404 });
  }

  const now = new Date();
  const isoStart = toISODate(getWeekStart(now));
  const isoEnd = toISODate(getWeekEnd(now));

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("logs")
    .select("id, data")
    .eq("category_id", gymCat.id)
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
  const { data: gymCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "gym")
    .eq("active", true)
    .single();

  if (!gymCat) {
    return Response.json({ success: false, error: "No gym category" }, { status: 404 });
  }

  const now = new Date();
  const isoStart = toISODate(getWeekStart(now));
  const isoEnd = toISODate(getWeekEnd(now));

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("logs")
    .select("id, data")
    .eq("category_id", gymCat.id)
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
      category_id: gymCat.id,
      date: toISODate(normalizeDate(now)),
      data: { bodyPart: bodyPart.toLowerCase() },
    });
    if (error) throw error;
    return Response.json({ success: true, toggled: true });
  }
}

async function handleAddRun(userId: string, miles: number): Promise<Response> {
  const { data: runCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "running")
    .eq("active", true)
    .single();

  if (!runCat) {
    return Response.json({ success: false, error: "No running category" }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("logs").insert({
    id: generateId(),
    category_id: runCat.id,
    date: toISODate(normalizeDate(new Date())),
    data: { miles },
  });

  if (error) throw error;

  return Response.json({ success: true });
}

async function handleRemoveRun(userId: string, miles: number): Promise<Response> {
  const { data: runCat } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "running")
    .eq("active", true)
    .single();

  if (!runCat) {
    return Response.json({ success: false, error: "No running category" }, { status: 404 });
  }

  // Create a negative log entry (mirrors Next.js behavior)
  const { error } = await supabaseAdmin.from("logs").insert({
    id: generateId(),
    category_id: runCat.id,
    date: toISODate(normalizeDate(new Date())),
    data: { miles: -miles },
  });

  if (error) throw error;

  return Response.json({ success: true });
}
