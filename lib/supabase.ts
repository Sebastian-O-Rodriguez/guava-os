import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy Supabase clients — defers creation until first use.
 * Prevents crash during Expo export build when env vars are not available.
 */

let _admin: SupabaseClient | null = null;
let _client: SupabaseClient | null = null;

function getUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
}

function getAnonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

function getServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — server cannot start without it");
  }
  return key;
}

/** Server-side client with service role key (bypasses RLS, used in API routes) */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_admin) {
      _admin = createClient(getUrl(), getServiceKey());
    }
    return (_admin as unknown as Record<string, unknown>)[prop as string];
  },
});

/** Client-side client with anon key */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      _client = createClient(getUrl(), getAnonKey());
    }
    return (_client as unknown as Record<string, unknown>)[prop as string];
  },
});
