/**
 * Shared Uniswap V4 Monad subgraph helpers (Node / Vercel).
 */

export const SUBGRAPH_ID = "3kaAG19ytkGfu8xD7YAAZ3qAQ3UDJRkmKH2kHUuyGHah";
export const POOL_MANAGER = "0x188d586ddcf52439676ca21a244753fa19f9ea8e";
const PAGE_SIZE = 1000;

export function toAddress(id) {
  const hex = id.startsWith("0x") ? id : `0x${id}`;
  return hex.toLowerCase();
}

export function gqlUrl(apiKey) {
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${SUBGRAPH_ID}`;
}

export async function gql(apiKey, query, variables = {}) {
  const res = await fetch(gqlUrl(apiKey), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`);
  }
  return json.data;
}

const POOLS_PAGE = `
  query V4PoolsPage($skip: Int!, $first: Int!) {
    poolManager(id: "${POOL_MANAGER}") { poolCount }
    pools(first: $first, skip: $skip, orderBy: liquidity, orderDirection: desc) {
      id
      feeTier
      tickSpacing
      liquidity
      token0 { id symbol }
      token1 { id symbol }
    }
  }
`;

export function poolToRow(p) {
  return {
    address: toAddress(p.id),
    token0: toAddress(p.token0.id),
    token1: toAddress(p.token1.id),
    symbol0: p.token0.symbol || p.token0.id.slice(0, 6),
    symbol1: p.token1.symbol || p.token1.id.slice(0, 6),
    fee: Number(p.feeTier),
    tick_spacing: Number(p.tickSpacing),
    protocol: "v4",
    liquidity: p.liquidity ?? "0",
  };
}

/** Fetch full pool list from subgraph (server-side only). */
export async function fetchAllPoolsFromSubgraph(apiKey) {
  const all = [];
  let skip = 0;
  let expected = 0;

  while (true) {
    const data = await gql(apiKey, POOLS_PAGE, { skip, first: PAGE_SIZE });
    if (!expected && data.poolManager) expected = Number(data.poolManager.poolCount);
    const page = data.pools ?? [];
    if (page.length === 0) break;
    all.push(...page.map(poolToRow));
    skip += PAGE_SIZE;
    if (page.length < PAGE_SIZE) break;
    if (expected > 0 && all.length >= expected) break;
  }

  return { pools: all, expected };
}

const BATCH_QUERY = `
  query BatchPoolMetrics($ids: [ID!]!) {
    pools(where: { id_in: $ids }) {
      id
      feeTier
      totalValueLockedUSD
      token0 { id symbol }
      token1 { id symbol }
      poolDayDatas(first: 1, orderBy: date, orderDirection: desc) {
        volumeUSD
        feesUSD
        tvlUSD
      }
    }
  }
`;

function parseUsd(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function poolToMetricsUpdate(p) {
  const address = toAddress(p.id);
  const day = p.poolDayDatas?.[0];
  const tvl_usd = parseUsd(day?.tvlUSD) ?? parseUsd(p.totalValueLockedUSD);
  const volume_24h_usd = parseUsd(day?.volumeUSD);
  const fees_24h_usd = parseUsd(day?.feesUSD);
  const apr_percent =
    fees_24h_usd != null && tvl_usd != null && tvl_usd > 0
      ? (fees_24h_usd / tvl_usd) * 365 * 100
      : null;

  return {
    address,
    tvl_usd,
    volume_24h_usd,
    fees_24h_usd,
    apr_percent,
    metrics_at: new Date().toISOString(),
  };
}

/** Batch metrics for up to 50 pool IDs. */
export async function fetchMetricsBatch(apiKey, ids) {
  const data = await gql(apiKey, BATCH_QUERY, { ids });
  return (data.pools ?? []).map(poolToMetricsUpdate);
}
