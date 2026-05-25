/**
 * Pools in Supabase that are NOT in the hardcoded curated list.
 * Used only to append new factory pools to the explore UI.
 */

import { getSupabaseAdmin } from "../../lib/supabase-admin.mjs";
import { ensurePoolsIndexed, readCuratedAddresses } from "../../lib/clmm-pool-index.mjs";

const DISCOVER_THROTTLE_MS = 120_000;
let lastDiscoverAt = 0;

function rowToPool(row) {
  const address = row.address.toLowerCase();
  return {
    address,
    token0: row.token0,
    token1: row.token1,
    fee: row.fee ?? 0,
    tickSpacing: row.tick_spacing ?? 0,
    protocol: "v3",
    symbol0: row.symbol0 ?? "",
    symbol1: row.symbol1 ?? "",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const discover = url.searchParams.get("discover") === "1" || url.searchParams.get("discover") === "true";

  try {
    const supabase = getSupabaseAdmin();
    const curated = new Set(readCuratedAddresses());

    if (discover) {
      const now = Date.now();
      if (now - lastDiscoverAt >= DISCOVER_THROTTLE_MS) {
        lastDiscoverAt = now;
        await ensurePoolsIndexed(supabase, { discoverNew: true });
      }
    }

    const { data, error } = await supabase
      .from("clmm_pools")
      .select("address, token0, token1, symbol0, symbol1, fee, tick_spacing")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const pools = (data ?? [])
      .filter((r) => !curated.has(r.address.toLowerCase()))
      .map(rowToPool);

    return res.status(200).json({ pools });
  } catch (e) {
    console.error("[api/clmm/new-pools]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("SUPABASE")) {
      return res.status(503).json({ error: "Supabase not configured", pools: [] });
    }
    return res.status(500).json({ error: msg, pools: [] });
  }
}
