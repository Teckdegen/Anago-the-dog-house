/** Paginated CLMM pools for the explore page. */

import { getSupabaseAdmin } from "../../lib/supabase-admin.mjs";

const SORT_COLUMNS = {
  tvl: "tvl_usd",
  apr: "apr_percent",
  vol: "volume_24h_usd",
  liquidity: "liquidity",
};

function poolDisplayId(address) {
  const a = address.toLowerCase();
  return a.length >= 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function feeToPercent(fee) {
  return `${(fee / 10_000).toFixed(fee % 100 === 0 ? 2 : 4)}%`;
}

function rowToPool(row) {
  const address = row.address.toLowerCase();
  return {
    address,
    token0: row.token0,
    token1: row.token1,
    fee: row.fee,
    tickSpacing: row.tick_spacing ?? 0,
    protocol: "v3",
    metrics: {
      poolAddress: address,
      displayId: poolDisplayId(address),
      symbol0: row.symbol0,
      symbol1: row.symbol1,
      token0: row.token0,
      token1: row.token1,
      logo0: null,
      logo1: null,
      pairImageUrl: null,
      feePercent: feeToPercent(row.fee),
      tvlUsd: row.tvl_usd,
      volume24hUsd: row.volume_24h_usd,
      fees24hUsd: row.fees_24h_usd,
      aprPercent: row.apr_percent,
      priceUsd: row.price_usd,
      priceChange24h: null,
      priceNative: null,
      updatedAt: row.metrics_at ? new Date(row.metrics_at).getTime() : 0,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const sortKey = url.searchParams.get("sort") ?? "tvl";
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const q = (url.searchParams.get("q") ?? "").trim();

  try {
    const supabase = getSupabaseAdmin();
    const sortCol = SORT_COLUMNS[sortKey] ?? SORT_COLUMNS.tvl;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from("clmm_pools").select("*", { count: "exact" });

    if (q) {
      const safe = q.replace(/[%_,]/g, "");
      query = query.or(
        `symbol0.ilike.%${safe}%,symbol1.ilike.%${safe}%,address.ilike.%${safe}%`,
      );
    }

    query = query.order(sortCol, { ascending: order === "asc", nullsFirst: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const pools = (data ?? []).map(rowToPool);
    const total = count ?? 0;

    return res.status(200).json({
      pools,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      sort: sortKey,
      order,
    });
  } catch (e) {
    console.error("[api/clmm/pools]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("SUPABASE")) {
      return res.status(503).json({ error: "Supabase not configured", detail: msg });
    }
    return res.status(500).json({ error: msg });
  }
}
