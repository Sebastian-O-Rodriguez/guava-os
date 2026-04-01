import { supabaseAdmin } from "./supabase";
import { generateId } from "./id";

let cachedUserId: string | null = null;

export async function getOrCreateUser(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const { data: users } = await supabaseAdmin.from("users").select("id").limit(1);

  if (users && users.length > 0) {
    cachedUserId = users[0].id as string;
    return cachedUserId;
  }

  // Create new user
  const { data: newUser, error } = await supabaseAdmin
    .from("users")
    .insert({ id: generateId() })
    .select("id")
    .single();

  if (error || !newUser) throw new Error("Failed to create user");
  cachedUserId = newUser.id as string;
  return cachedUserId;
}
