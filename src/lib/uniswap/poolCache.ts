import { getPoolData, getPoolDataCount, getPoolDataUpdatedAt, poolDataToCached } from "./poolData";
import type { CachedPool } from "./types";
import { SEED_POOLS, SEED_POOLS_LAST_INDEXED_BLOCK, SEED_POOLS_UPDATED_AT } from "./seedPools.generated";

const CACHE_KEY = "uniswap_v4_pools_monad_subgraph_v1";

export type PoolIndexCache = {
  lastIndexedBlock: string;
  pools: CachedPool[];
  updatedAt: number;
};

export function getSeedPools(): CachedPool[] {
  const fromData = getPoolData().map(poolDataToCached);
  if (fromData.length > 0) return fromData;
  return SEED_POOLS.map((p) => normalizePool(p));
}

export function normalizePool(p: CachedPool): CachedPool {
  return { ...p, protocol: "v4" };
}

export function getSeedPoolIndex(): PoolIndexCache {
  const pools = getSeedPools();
  return {
    lastIndexedBlock: SEED_POOLS_LAST_INDEXED_BLOCK,
    pools,
    updatedAt: SEED_POOLS_UPDATED_AT || getPoolDataUpdatedAt(),
  };
}

/** Bundled poolData + optional browser cache */
export function loadPoolCache(): PoolIndexCache {
  const seed = getSeedPoolIndex();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return seed;
    const cached = JSON.parse(raw) as PoolIndexCache;
    if (cached.pools?.length > seed.pools.length) {
      return {
        lastIndexedBlock: cached.lastIndexedBlock,
        pools: cached.pools.map(normalizePool),
        updatedAt: cached.updatedAt,
      };
    }
    return seed;
  } catch {
    return seed;
  }
}

export function savePoolCache(cache: PoolIndexCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota — ignore
  }
}

export function mergePools(existing: CachedPool[], discovered: CachedPool[]): CachedPool[] {
  const map = new Map<string, CachedPool>();
  for (const p of existing) map.set(poolKey(p), normalizePool(p));
  for (const p of discovered) map.set(poolKey(p), normalizePool(p));
  return Array.from(map.values());
}

export function poolKey(p: Pick<CachedPool, "address">): string {
  return p.address.toLowerCase();
}
