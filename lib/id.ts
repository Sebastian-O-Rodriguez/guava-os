/**
 * Generate a cuid-like ID for Supabase inserts.
 * Prisma's @default(cuid()) doesn't run on Supabase — we generate IDs in JS.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 14);
  return `c${timestamp}${random}`;
}
