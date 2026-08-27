import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../types";

export function getSupabaseClient(env: Env, authHeader?: string | null): SupabaseClient | null {
  const supabaseUrl =
    env.SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    (typeof process !== "undefined"
      ? process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
      : undefined);

  const secretKey =
    env.SUPABASE_SECRET_KEY ||
    (env as any).SUPABASE_SERVICE_ROLE_KEY ||
    (typeof process !== "undefined"
      ? process.env.SUPABASE_SECRET_KEY || (process.env as any).SUPABASE_SERVICE_ROLE_KEY
      : undefined);

  const publishableKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    (env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY
      : undefined);

  const keyToUse = secretKey || publishableKey;
  if (!supabaseUrl || !keyToUse) {
    return null;
  }

  const globalHeaders: Record<string, string> = {};
  if (authHeader) {
    globalHeaders["Authorization"] = authHeader.startsWith("Bearer ")
      ? authHeader
      : `Bearer ${authHeader}`;
  }

  return createClient(supabaseUrl, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: globalHeaders,
    },
  });
}

export const getSupabaseAdmin = (env: Env) => getSupabaseClient(env);

