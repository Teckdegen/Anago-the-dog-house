import { UNISWAP_V4 } from "./addresses";

/** Uniswap V4 Monad — https://thegraph.com/explorer/subgraphs/3kaAG19ytkGfu8xD7YAAZ3qAQ3UDJRkmKH2kHUuyGHah */
export const UNISWAP_V4_MONAD_SUBGRAPH_ID = "3kaAG19ytkGfu8xD7YAAZ3qAQ3UDJRkmKH2kHUuyGHah";

export const UNISWAP_V4_MONAD_DEPLOYMENT_ID =
  "QmWSUVsKg4UVAbh84JnSiqsDoE8YAsBEkrwz3xyynNvb8B";

export const UNISWAP_V4_MONAD_POOL_MANAGER = UNISWAP_V4.poolManager.toLowerCase();

const PAGE_SIZE = 1000;

export type SubgraphToken = {
  id: string;
  symbol: string;
  name?: string;
  decimals: string;
};

export type SubgraphPoolDay = {
  date: string;
  volumeUSD: string;
  feesUSD: string;
  tvlUSD: string;
  token0Price?: string;
  token1Price?: string;
};

export type SubgraphPool = {
  id: string;
  feeTier: string;
  tickSpacing: string;
  liquidity: string;
  sqrtPrice: string;
  tick: string;
  hooks?: string;
  token0Price?: string;
  token1Price?: string;
  totalValueLockedUSD: string;
  volumeUSD: string;
  txCount: string;
  token0: SubgraphToken;
  token1: SubgraphToken;
  poolDayDatas?: SubgraphPoolDay[];
};

export type SubgraphPoolManager = {
  id: string;
  poolCount: string;
  txCount: string;
  totalVolumeUSD: string;
  totalValueLockedUSD: string;
};

function getGraphApiKey(explicit?: string): string | undefined {
  if (explicit) return explicit;

  if (typeof window !== "undefined") {
    return undefined;
  }

  const key = typeof process !== "undefined" ? process.env.THE_GRAPH_API_KEY : undefined;
  if (!key || key === "your_key_here") return undefined;
  return key;
}

export function subgraphQueryUrl(apiKey?: string): string {
  const key = getGraphApiKey(apiKey);
  if (!key) {
    throw new Error(
      "Missing THE_GRAPH_API_KEY. Set it on Vercel or in .env.local for sync:pools.",
    );
  }
  return `https://gateway.thegraph.com/api/${key}/subgraphs/id/${UNISWAP_V4_MONAD_SUBGRAPH_ID}`;
}

export async function queryV4Subgraph<T>(
  query: string,
  variables?: Record<string, unknown>,
  apiKey?: string,
): Promise<T> {
  const key = getGraphApiKey(apiKey);

  if (typeof window !== "undefined" && !key) {
    const res = await fetch("/api/v4-subgraph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (!res.ok || json.errors?.length) {
      const msg = json.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`;
      throw new Error(`Subgraph proxy failed: ${msg}`);
    }
    if (!json.data) throw new Error("Subgraph returned no data");
    return json.data;
  }

  const res = await fetch(subgraphQueryUrl(key), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`;
    throw new Error(`Subgraph query failed: ${msg}`);
  }
  if (!json.data) throw new Error("Subgraph returned no data");
  return json.data;
}

const POOLS_PAGE_QUERY = `
  query V4PoolsPage($skip: Int!, $first: Int!) {
    poolManager(id: "${UNISWAP_V4_MONAD_POOL_MANAGER}") {
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

const POOL_BY_ID_QUERY = `
  query V4PoolById($id: ID!) {
    pool(id: $id) {
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

export async function fetchV4PoolManager(apiKey?: string): Promise<SubgraphPoolManager | null> {
  const data = await queryV4Subgraph<{ poolManager: SubgraphPoolManager | null }>(
    `query { poolManager(id: "${UNISWAP_V4_MONAD_POOL_MANAGER}") { id poolCount txCount totalVolumeUSD totalValueLockedUSD } }`,
    undefined,
    apiKey,
  );
  return data.poolManager;
}

/** Paginate until every V4 pool on Monad is loaded (1000 per page). */
export async function fetchAllV4PoolsFromSubgraph(
  onProgress?: (msg: string) => void,
  apiKey?: string,
): Promise<{ pools: SubgraphPool[]; poolManager: SubgraphPoolManager | null }> {
  const all: SubgraphPool[] = [];
  let skip = 0;
  let poolManager: SubgraphPoolManager | null = null;
  let expected = 0;

  while (true) {
    onProgress?.(`Subgraph · fetching pools ${skip}–${skip + PAGE_SIZE}…`);
    const data = await queryV4Subgraph<{
      poolManager: SubgraphPoolManager | null;
      pools: SubgraphPool[];
    }>(POOLS_PAGE_QUERY, { skip, first: PAGE_SIZE }, apiKey);

    if (!poolManager && data.poolManager) {
      poolManager = data.poolManager;
      expected = Number(data.poolManager.poolCount);
      onProgress?.(`Subgraph · ${expected} pools indexed on Monad V4`);
    }

    const page = data.pools ?? [];
    if (page.length === 0) break;

    all.push(...page);
    skip += PAGE_SIZE;

    onProgress?.(`Subgraph · ${all.length}${expected ? ` / ${expected}` : ""} pools loaded`);

    if (page.length < PAGE_SIZE) break;
    if (expected > 0 && all.length >= expected) break;
  }

  return { pools: all, poolManager };
}

export async function fetchV4PoolFromSubgraph(
  poolId: string,
  apiKey?: string,
): Promise<SubgraphPool | null> {
  const id = poolId.toLowerCase();
  const data = await queryV4Subgraph<{ pool: SubgraphPool | null }>(
    POOL_BY_ID_QUERY,
    { id },
    apiKey,
  );
  return data.pool;
}
