/**
 * Sync Uniswap V4 pools from subgraph → Supabase.
 * Used by script.js (24/7 indexer). UI never calls this.
 */

import { fetchAllPoolsFromSubgraph, fetchMetricsBatch } from "./clmm-subgraph.mjs";
import { getSupabaseAdmin } from "./supabase-admin.mjs";

const UPSERT_CHUNK = 400;
const METRICS_BATCH = 50;
/** Default when run on Vercel cron (short timeout) */
const METRICS_TOP_N = 1500;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function syncClmmPoolsToSupabase(options = {}) {
  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error("THE_GRAPH_API_KEY not configured");
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { pools, expected } = await fetchAllPoolsFromSubgraph(apiKey);
  if (pools.length === 0) throw new Error("Subgraph returned zero pools");

  const metricsTopN = options.fullMetrics
    ? pools.length
    : (options.metricsTopN ?? METRICS_TOP_N);

  let upserted = 0;
  for (const batch of chunk(pools, UPSERT_CHUNK)) {
    const rows = batch.map((p) => ({
      ...p,
      synced_at: now,
    }));
    const { error } = await supabase.from("clmm_pools").upsert(rows, { onConflict: "address" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    upserted += rows.length;
  }

  const topForMetrics = pools.slice(0, metricsTopN);
  let metricsUpdated = 0;

  for (const ids of chunk(
    topForMetrics.map((p) => p.address),
    METRICS_BATCH,
  )) {
    const updates = await fetchMetricsBatch(apiKey, ids);
    if (updates.length === 0) continue;

    for (const u of updates) {
      const { error } = await supabase
        .from("clmm_pools")
        .update({
          tvl_usd: u.tvl_usd,
          volume_24h_usd: u.volume_24h_usd,
          fees_24h_usd: u.fees_24h_usd,
          apr_percent: u.apr_percent,
          metrics_at: u.metrics_at,
        })
        .eq("address", u.address);
      if (error) console.warn("[clmm-sync] metrics update", u.address, error.message);
      else metricsUpdated++;
    }

    // Gentle throttle for long 24/7 runs
    await new Promise((r) => setTimeout(r, 120));
  }

  return {
    ok: true,
    poolCount: upserted,
    expected,
    metricsUpdated,
    metricsTopN,
    syncedAt: now,
  };
}
