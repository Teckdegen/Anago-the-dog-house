/**
 * Vercel — pool list only (no metrics). Use poolData.generated.ts in production when synced.
 */

const SUBGRAPH_ID = "3kaAG19ytkGfu8xD7YAAZ3qAQ3UDJRkmKH2kHUuyGHah";
const POOL_MANAGER = "0x188d586ddcf52439676ca21a244753fa19f9ea8e";
const PAGE_SIZE = 1000;

function toAddress(id) {
  const hex = id.startsWith("0x") ? id : `0x${id}`;
  return hex.toLowerCase();
}

function toEntry(p) {
  return {
    address: toAddress(p.id),
    token0: toAddress(p.token0.id),
    token1: toAddress(p.token1.id),
    fee: Number(p.feeTier),
    tickSpacing: Number(p.tickSpacing),
    symbol0: p.token0.symbol || p.token0.id.slice(0, 6),
    symbol1: p.token1.symbol || p.token1.id.slice(0, 6),
    protocol: "v4",
  };
}

const POOLS_PAGE = `
  query V4PoolsPage($skip: Int!, $first: Int!) {
    poolManager(id: "${POOL_MANAGER}") { poolCount }
    pools(first: $first, skip: $skip, orderBy: liquidity, orderDirection: desc) {
      id feeTier tickSpacing
      token0 { id symbol }
      token1 { id symbol }
    }
  }
`;

async function fetchAllPools(apiKey) {
  const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${SUBGRAPH_ID}`;
  const all = [];
  let skip = 0;
  let expected = 0;

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
    if (!expected && data.poolManager) expected = Number(data.poolManager.poolCount);
    const page = data.pools ?? [];
    if (page.length === 0) break;
    all.push(...page.map(toEntry));
    skip += PAGE_SIZE;
    if (page.length < PAGE_SIZE) break;
    if (expected > 0 && all.length >= expected) break;
  }
  return { pools: all, expected };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return res.status(503).json({
      error: "THE_GRAPH_API_KEY not configured on Vercel",
    });
  }

  try {
    const { pools, expected } = await fetchAllPools(apiKey);
    return res.status(200).json({
      pools,
      count: pools.length,
      expected,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error("[api/v4-pools]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
