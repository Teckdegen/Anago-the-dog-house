import { fetchPoolsFromApi } from "./fetchPoolsApi";
import { getPoolData, getPoolDataCount, poolDataToCached } from "./poolData";
import { loadPoolCache, savePoolCache } from "./poolCache";
import type { CachedPool } from "./types";

export type DiscoverResult = {
  pools: CachedPool[];
  lastIndexedBlock: bigint;
  newPools: number;
};

export function loadLocalV4Pools(): CachedPool[] {
  const bundled = getPoolData();
  if (bundled.length > 0) {
    return bundled.map(poolDataToCached);
  }
  return loadPoolCache().pools;
}

export async function discoverPoolsIncremental(
  _client?: unknown,
  onProgress?: (msg: string) => void,
): Promise<DiscoverResult> {
  const pools = loadLocalV4Pools();
  const bundledCount = getPoolDataCount();

  if (pools.length > 0) {
    onProgress?.(`${pools.length} Uniswap V4 pools${bundledCount ? " (bundled)" : ""}`);
    return {
      pools,
      lastIndexedBlock: BigInt(Math.floor(Date.now() / 1000)),
      newPools: 0,
    };
  }

  onProgress?.("Loading pool list from subgraph…");
  try {
    const remote = await fetchPoolsFromApi();
    const list = remote.pools.map((p) => ({
      address: p.address,
      token0: p.token0,
      token1: p.token1,
      fee: p.fee,
      tickSpacing: p.tickSpacing,
      protocol: "v4" as const,
    }));
    savePoolCache({
      pools: list,
      lastIndexedBlock: String(Math.floor(Date.now() / 1000)),
      updatedAt: remote.updatedAt,
    });
    onProgress?.(`Loaded ${list.length} pool addresses`);
    return {
      pools: list,
      lastIndexedBlock: BigInt(Math.floor(Date.now() / 1000)),
      newPools: 0,
    };
  } catch (e) {
    onProgress?.(`Pool load failed: ${e instanceof Error ? e.message : String(e)}`);
    console.error("[discoverPools]", e);
    return { pools: [], lastIndexedBlock: 0n, newPools: 0 };
  }
}
