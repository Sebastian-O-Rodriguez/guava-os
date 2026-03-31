import { z } from "zod";
import { prisma } from "../../lib/db";
import { getOrCreateUser } from "../../lib/user";
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
  const nutritionCat = await prisma.category.findFirst({
    where: { userId, type: "nutrition", active: true },
  });
  if (!nutritionCat) {
    return Response.json({ success: false, error: "No nutrition category" }, { status: 404 });
  }

  const entry = { item: `+${amount} ${macro}`, calories: 0, protein: 0, fat: 0, carbs: 0 };
  entry[macro] = amount;

  await prisma.log.create({
    data: {
      categoryId: nutritionCat.id,
      date: normalizeDate(new Date()),
      data: entry as object,
    },
  });

  return Response.json({ success: true });
}

async function handleRemoveNutrition(
  userId: string,
  macro: "calories" | "protein" | "fat" | "carbs",
  amount: number,
): Promise<Response> {
  const nutritionCat = await prisma.category.findFirst({
    where: { userId, type: "nutrition", active: true },
  });
  if (!nutritionCat) {
    return Response.json({ success: false, error: "No nutrition category" }, { status: 404 });
  }

  const entry = { item: `-${amount} ${macro}`, calories: 0, protein: 0, fat: 0, carbs: 0 };
  entry[macro] = -amount;

  await prisma.log.create({
    data: {
      categoryId: nutritionCat.id,
      date: normalizeDate(new Date()),
      data: entry as object,
    },
  });

  return Response.json({ success: true });
}

async function handleIncrementGym(userId: string, bodyPart: string): Promise<Response> {
  const gymCat = await prisma.category.findFirst({
    where: { userId, type: "gym", active: true },
  });
  if (!gymCat) {
    return Response.json({ success: false, error: "No gym category" }, { status: 404 });
  }

  await prisma.log.create({
    data: {
      categoryId: gymCat.id,
      date: normalizeDate(new Date()),
      data: { bodyPart: bodyPart.toLowerCase() } as object,
    },
  });

  return Response.json({ success: true });
}

async function handleDecrementGym(userId: string, bodyPart: string): Promise<Response> {
  const gymCat = await prisma.category.findFirst({
    where: { userId, type: "gym", active: true },
  });
  if (!gymCat) {
    return Response.json({ success: false, error: "No gym category" }, { status: 404 });
  }

  const now = new Date();
  const existing = await prisma.log.findMany({
    where: {
      categoryId: gymCat.id,
      date: { gte: getWeekStart(now), lte: getWeekEnd(now) },
    },
    orderBy: { createdAt: "desc" },
  });

  const match = existing.find((log) => {
    const d = log.data as { bodyPart?: string };
    return d.bodyPart?.toLowerCase() === bodyPart.toLowerCase();
  });

  if (match) {
    await prisma.log.delete({ where: { id: match.id } });
  }

  return Response.json({ success: true });
}

async function handleToggleGym(userId: string, bodyPart: string): Promise<Response> {
  const gymCat = await prisma.category.findFirst({
    where: { userId, type: "gym", active: true },
  });
  if (!gymCat) {
    return Response.json({ success: false, error: "No gym category" }, { status: 404 });
  }

  const now = new Date();
  const existing = await prisma.log.findMany({
    where: {
      categoryId: gymCat.id,
      date: { gte: getWeekStart(now), lte: getWeekEnd(now) },
    },
  });

  const match = existing.find((log) => {
    const d = log.data as { bodyPart?: string };
    return d.bodyPart?.toLowerCase() === bodyPart.toLowerCase();
  });

  if (match) {
    await prisma.log.delete({ where: { id: match.id } });
    return Response.json({ success: true, toggled: false });
  } else {
    await prisma.log.create({
      data: {
        categoryId: gymCat.id,
        date: normalizeDate(now),
        data: { bodyPart: bodyPart.toLowerCase() } as object,
      },
    });
    return Response.json({ success: true, toggled: true });
  }
}

async function handleAddRun(userId: string, miles: number): Promise<Response> {
  const runCat = await prisma.category.findFirst({
    where: { userId, type: "running", active: true },
  });
  if (!runCat) {
    return Response.json({ success: false, error: "No running category" }, { status: 404 });
  }

  await prisma.log.create({
    data: {
      categoryId: runCat.id,
      date: normalizeDate(new Date()),
      data: { miles } as object,
    },
  });

  return Response.json({ success: true });
}

async function handleRemoveRun(userId: string, miles: number): Promise<Response> {
  const runCat = await prisma.category.findFirst({
    where: { userId, type: "running", active: true },
  });
  if (!runCat) {
    return Response.json({ success: false, error: "No running category" }, { status: 404 });
  }

  // Create a negative log entry (mirrors Next.js behavior)
  await prisma.log.create({
    data: {
      categoryId: runCat.id,
      date: normalizeDate(new Date()),
      data: { miles: -miles } as object,
    },
  });

  return Response.json({ success: true });
}
