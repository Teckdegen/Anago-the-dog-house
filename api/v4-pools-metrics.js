/**
 * Vercel — batch pool metrics (TVL, volume, APR) for up to 50 pool IDs per request.
 */

const SUBGRAPH_ID = "3kaAG19ytkGfu8xD7YAAZ3qAQ3UDJRkmKH2kHUuyGHah";
const MAX_IDS = 50;

function poolDisplayId(address) {
  const a = address.toLowerCase();
  return a.length >= 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function feeToPercent(fee) {
  return `${(fee / 10_000).toFixed(fee % 100 === 0 ? 2 : 4)}%`;
}

function parseUsd(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toAddress(id) {
  const hex = id.startsWith("0x") ? id : `0x${id}`;
  return hex.toLowerCase();
}

function toMetrics(p) {
  const address = toAddress(p.id);
  const fee = Number(p.feeTier);
  const day = p.poolDayDatas?.[0];
  const tvlUsd = parseUsd(day?.tvlUSD) ?? parseUsd(p.totalValueLockedUSD);
  const volume24hUsd = parseUsd(day?.volumeUSD);
  const fees24hUsd = parseUsd(day?.feesUSD);
  const aprPercent =
    fees24hUsd != null && tvlUsd != null && tvlUsd > 0
      ? (fees24hUsd / tvlUsd) * 365 * 100
      : null;
  const token0Price = parseUsd(day?.token0Price ?? p.token0Price);
  const token1Price = parseUsd(day?.token1Price ?? p.token1Price);
  const priceUsd =
    token0Price ?? (token1Price != null && token1Price > 0 ? 1 / token1Price : null);

  return {
    poolAddress: address,
    displayId: poolDisplayId(address),
    symbol0: p.token0.symbol || p.token0.id.slice(0, 6),
    symbol1: p.token1.symbol || p.token1.id.slice(0, 6),
    token0: toAddress(p.token0.id),
    token1: toAddress(p.token1.id),
    logo0: null,
    logo1: null,
    pairImageUrl: null,
    feePercent: feeToPercent(fee),
    tvlUsd,
    volume24hUsd,
    fees24hUsd,
    aprPercent,
    priceUsd,
    priceChange24h: null,
    priceNative: null,
    updatedAt: Date.now(),
  };
}

const BATCH_QUERY = `
  query BatchPoolMetrics($ids: [ID!]!) {
    pools(where: { id_in: $ids }) {
      id
      feeTier
      totalValueLockedUSD
      volumeUSD
      token0Price
      token1Price
      token0 { id symbol }
      token1 { id symbol }
      poolDayDatas(first: 1, orderBy: date, orderDirection: desc) {
        volumeUSD
        feesUSD
        tvlUSD
        token0Price
        token1Price
      }
    }
  }
`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return res.status(503).json({ error: "THE_GRAPH_API_KEY not configured" });
  }

  const ids = (req.body?.ids ?? [])
    .map((id) => String(id).toLowerCase())
    .filter((id) => id.startsWith("0x"));

  if (ids.length === 0) {
    return res.status(400).json({ error: "Missing ids array" });
  }
  if (ids.length > MAX_IDS) {
    return res.status(400).json({ error: `Max ${MAX_IDS} ids per request` });
  }

  try {
    const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${SUBGRAPH_ID}`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: BATCH_QUERY,
        variables: { ids },
      }),
    });

    const json = await upstream.json();
    if (!upstream.ok || json.errors?.length) {
      throw new Error(json.errors?.map((e) => e.message).join("; ") ?? `HTTP ${upstream.status}`);
    }

    const metrics = (json.data?.pools ?? []).map(toMetrics);
    return res.status(200).json({ metrics, updatedAt: Date.now() });
  } catch (e) {
    console.error("[api/v4-pools-metrics]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
