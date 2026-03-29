import { prisma } from "./db";

type DefaultGoal = {
  metric: string;
  target: number;
  period: "daily" | "weekly";
};

type DefaultCategory = {
  name: string;
  type: "gym" | "nutrition" | "running" | "custom";
  icon: string;
  color: string;
  goals: DefaultGoal[];
};

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "Gym",
    type: "gym",
    icon: "dumbbell",
    color: "#6366f1",
    goals: [
      { metric: "leg_sessions", target: 1, period: "weekly" },
      { metric: "back_sessions", target: 1, period: "weekly" },
      { metric: "chest_sessions", target: 1, period: "weekly" },
    ],
  },
  {
    name: "Nutrition",
    type: "nutrition",
    icon: "utensils",
    color: "#10b981",
    goals: [
      { metric: "calories", target: 2500, period: "daily" },
      { metric: "protein", target: 180, period: "daily" },
      { metric: "fat", target: 80, period: "daily" },
    ],
  },
  {
    name: "Running",
    type: "running",
    icon: "footprints",
    color: "#f59e0b",
    goals: [{ metric: "miles", target: 1, period: "weekly" }],
  },
];

/**
 * Creates default Gym, Nutrition, and Running categories with their default
 * goals for the given user, if they don't already exist.
 * Idempotent — safe to call on every request.
 */
export async function ensureDefaultCategories(userId: string): Promise<void> {
  for (const defaults of DEFAULT_CATEGORIES) {
    // Check if this category type already exists for the user
    const existing = await prisma.category.findFirst({
      where: { userId, type: defaults.type },
    });

    if (!existing) {
      // Create category and its goals in a transaction
      await prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: {
            userId,
            name: defaults.name,
            type: defaults.type,
            icon: defaults.icon,
            color: defaults.color,
          },
        });

        if (defaults.goals.length > 0) {
          await tx.goal.createMany({
            data: defaults.goals.map((g) => ({
              categoryId: category.id,
              metric: g.metric,
              target: g.target,
              period: g.period,
            })),
          });
        }
      });
    }
  }
}
