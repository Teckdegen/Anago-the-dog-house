/**
 * Sync Uniswap V4 pools from subgraph → Supabase.
 * Used by script.js (24/7 indexer). UI never calls this.
 */

import { fetchAllPoolsFromSubgraph, fetchMetricsBatch } from "./clmm-subgraph.mjs";
import { getSupabaseAdmin, formatSupabaseError } from "./supabase-admin.mjs";

const UPSERT_CHUNK = 80;
const METRICS_BATCH = 50;
const UPSERT_RETRIES = 3;
const METRICS_TOP_N = 1500;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sanitizeLiquidity(liq) {
  try {
    const s = String(liq ?? "0").trim();
    if (!s || s === "0") return "0";
    const digits = s.includes(".") ? s.split(".")[0] : s;
    if (digits.length > 75) return "0";
    return BigInt(digits).toString();
  } catch {
    return "0";
  }
}

function toDbRow(p, syncedAt) {
  return {
    address: p.address,
    token0: p.token0,
    token1: p.token1,
    symbol0: p.symbol0,
    symbol1: p.symbol1,
    fee: p.fee,
    tick_spacing: p.tick_spacing,
    protocol: p.protocol ?? "v4",
    liquidity: sanitizeLiquidity(p.liquidity),
    synced_at: syncedAt,
  };
}

async function upsertWithRetry(supabase, rows) {
  let lastErr;
  for (let attempt = 1; attempt <= UPSERT_RETRIES; attempt++) {
    try {
      const { error } = await supabase.from("clmm_pools").upsert(rows, { onConflict: "address" });
      if (error) throw error;
      return;
    } catch (e) {
      lastErr = e;
      const msg = formatSupabaseError(e);
      if (attempt < UPSERT_RETRIES && (msg.includes("fetch failed") || msg.includes("ECONNRESET"))) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw new Error(`Upsert failed: ${msg}`);
    }
  }
  throw lastErr;
}

export async function syncClmmPoolsToSupabase(options = {}) {
  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error("THE_GRAPH_API_KEY not configured");
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  console.log("[clmm-sync] Fetching pools from subgraph…");
  const { pools, expected } = await fetchAllPoolsFromSubgraph(apiKey);
  if (pools.length === 0) throw new Error("Subgraph returned zero pools");
  console.log(`[clmm-sync] ${pools.length} pools from subgraph (expected ~${expected})`);

  const metricsTopN = options.fullMetrics
    ? pools.length
    : (options.metricsTopN ?? METRICS_TOP_N);

  let upserted = 0;
  const batches = chunk(pools, UPSERT_CHUNK);
  for (let i = 0; i < batches.length; i++) {
    const rows = batches[i].map((p) => toDbRow(p, now));
    await upsertWithRetry(supabase, rows);
    upserted += rows.length;
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      console.log(`[clmm-sync] Upserted ${upserted}/${pools.length}`);
    }
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
