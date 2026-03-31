import { prisma } from "./db";
import { ensureDefaultCategories } from "./seed-defaults";

/**
 * Returns the single user's ID, creating the user row if it doesn't exist yet.
 * Also ensures default categories (Gym, Nutrition, Running) are seeded.
 * RoutineMe is a single-user app — this is the only identity helper needed.
 */
export async function getOrCreateUser(): Promise<string> {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({ data: {} });
  }

  await ensureDefaultCategories(user.id);

  return user.id;
}
