/**
 * Cron: Capricorn factory scan → Supabase.
 * Vercel cron + manual: Authorization: Bearer <CRON_SECRET>
 */

import { syncClmmPoolsToSupabase } from "../../lib/clmm-sync.mjs";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.authorization ?? "";
  return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await syncClmmPoolsToSupabase();
    return res.status(200).json(result);
  } catch (e) {
    console.error("[cron/sync-clmm-pools]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
