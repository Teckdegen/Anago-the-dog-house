import { createClient } from "@supabase/supabase-js";

export function normalizeSupabaseUrl(url) {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://") || !trimmed.includes(".supabase.co")) {
    throw new Error(
      "SUPABASE_URL must look like https://YOUR_PROJECT_REF.supabase.co (Project Settings → API → Project URL)",
    );
  }
  return trimmed;
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  if (key.startsWith("sb_publishable_") || key.includes("anon")) {
    console.warn(
      "[supabase] Warning: use the service_role key (secret), not the anon/publishable key",
    );
  }
  return createClient(normalizeSupabaseUrl(url), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Fail fast with a clear message if Supabase is unreachable or table missing */
export async function testSupabaseConnection() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("clmm_pools").select("address").limit(1);
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      throw new Error(
        'Table clmm_pools not found — run supabase/migrations/001_clmm_pools.sql in the SQL Editor first',
      );
    }
    throw new Error(`Supabase query failed: ${error.message} (${error.code ?? "unknown"})`);
  }
  return true;
}

export function formatSupabaseError(err) {
  if (!err) return "unknown error";
  const parts = [err.message];
  if (err.code) parts.push(`code=${err.code}`);
  if (err.details) parts.push(err.details);
  if (err.hint) parts.push(err.hint);
  const cause = err.cause;
  if (cause instanceof Error) {
    parts.push(`cause: ${cause.message}`);
    if (cause.cause) parts.push(String(cause.cause));
  }
  return parts.filter(Boolean).join(" · ");
}
