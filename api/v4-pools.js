/**
 * Vercel serverless — loads all Uniswap V4 Monad pools from The Graph (key stays server-side).
 * Set THE_GRAPH_API_KEY in Vercel project Environment Variables.
 */

const SUBGRAPH_ID = "3kaAG19ytkGfu8xD7YAAZ3qAQ3UDJRkmKH2kHUuyGHah";
const POOL_MANAGER = "0x188d586ddcf52439676ca21a244753fa19f9ea8e";
const PAGE_SIZE = 1000;

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

function toCached(p) {
  return {
    address: toAddress(p.id),
    token0: toAddress(p.token0.id),
    token1: toAddress(p.token1.id),
    fee: Number(p.feeTier),
    tickSpacing: Number(p.tickSpacing),
    protocol: "v4",
  };
}

function toMetrics(p) {
  const cached = toCached(p);
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
    poolAddress: cached.address,
    displayId: poolDisplayId(cached.address),
    symbol0: p.token0.symbol || cached.token0.slice(0, 6),
    symbol1: p.token1.symbol || cached.token1.slice(0, 6),
    token0: cached.token0,
    token1: cached.token1,
    logo0: null,
    logo1: null,
    pairImageUrl: null,
    feePercent: feeToPercent(cached.fee),
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

const POOLS_PAGE = `
  query V4PoolsPage($skip: Int!, $first: Int!) {
    poolManager(id: "${POOL_MANAGER}") {
      id
      poolCount
      txCount
      totalVolumeUSD
      totalValueLockedUSD
    }
    pools(first: $first, skip: $skip, orderBy: liquidity, orderDirection: desc) {
      id
      feeTier
      tickSpacing
      liquidity
      sqrtPrice
      tick
      hooks
      token0Price
      token1Price
      totalValueLockedUSD
      volumeUSD
      txCount
      token0 { id symbol name decimals }
      token1 { id symbol name decimals }
      poolDayDatas(first: 1, orderBy: date, orderDirection: desc) {
        date
        volumeUSD
        feesUSD
        tvlUSD
        token0Price
        token1Price
      }
    }
  }
`;

async function fetchAllPools(apiKey) {
  const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${SUBGRAPH_ID}`;
  const all = [];
  let skip = 0;
  let expected = 0;
  let poolManager = null;

  while (true) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: POOLS_PAGE,
        variables: { skip, first: PAGE_SIZE },
      }),
    });

    const json = await res.json();
    if (!res.ok || json.errors?.length) {
      throw new Error(json.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`);
    }

    const data = json.data;
    if (!poolManager && data.poolManager) {
      poolManager = data.poolManager;
      expected = Number(data.poolManager.poolCount);
    }

    const page = data.pools ?? [];
    if (page.length === 0) break;
    all.push(...page);
    skip += PAGE_SIZE;
    if (page.length < PAGE_SIZE) break;
    if (expected > 0 && all.length >= expected) break;
  }

  return { pools: all, poolManager, expected };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return res.status(503).json({
      error: "THE_GRAPH_API_KEY not configured on Vercel",
      hint: "Add THE_GRAPH_API_KEY in Vercel → Settings → Environment Variables",
    });
  }

  try {
    const { pools: raw, poolManager, expected } = await fetchAllPools(apiKey);
    const pools = raw.map(toCached);
    const metrics = raw.map(toMetrics);

    return res.status(200).json({
      pools,
      metrics,
      count: pools.length,
      poolManager,
      expected,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error("[api/v4-pools]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
