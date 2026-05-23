import type { CachedPool } from "./types";
import {
  SEED_POOLS,
  SEED_POOLS_LAST_INDEXED_BLOCK,
  SEED_POOLS_UPDATED_AT,
} from "./seedPools.generated";

const CACHE_KEY = "uniswap_v3_pools_monad_v2";

export type PoolIndexCache = {
  lastIndexedBlock: string;
  /** Highest block fully scanned for PoolCreated logs */
  factoryIndexedThroughBlock?: string;
  pools: CachedPool[];
  updatedAt: number;
};

export function getSeedPools(): CachedPool[] {
  return SEED_POOLS.map((p) => normalizePool(p));
}

function normalizePool(p: CachedPool): CachedPool {
  return { ...p, protocol: p.protocol ?? "v3" };
}

export function getSeedPoolIndex(): PoolIndexCache {
  return {
    lastIndexedBlock: SEED_POOLS_LAST_INDEXED_BLOCK,
    pools: getSeedPools(),
    updatedAt: SEED_POOLS_UPDATED_AT || Date.now(),
  };
}

/** Hardcoded pools + optional browser cache (instant on Vercel, auto-sync after) */
export function loadPoolCache(): PoolIndexCache {
  const seed = getSeedPoolIndex();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return seed;
    const cached = JSON.parse(raw) as PoolIndexCache;
    return {
      lastIndexedBlock:
        BigInt(cached.lastIndexedBlock || 0) > BigInt(seed.lastIndexedBlock)
          ? cached.lastIndexedBlock
          : seed.lastIndexedBlock,
      factoryIndexedThroughBlock: cached.factoryIndexedThroughBlock,
      pools: mergePools(seed.pools, (cached.pools ?? []).map(normalizePool)),
      updatedAt: Math.max(cached.updatedAt ?? 0, seed.updatedAt),
    };
  } catch {
    return seed;
  }
}

export function savePoolCache(cache: PoolIndexCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota exceeded — ignore
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
