import type { CachedPool } from "./types";

const CACHE_KEY = "uniswap_v3_pools_monad_v1";

export type PoolIndexCache = {
  lastIndexedBlock: string;
  pools: CachedPool[];
  updatedAt: number;
};

export function loadPoolCache(): PoolIndexCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PoolIndexCache;
  } catch {
    return null;
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
  for (const p of existing) map.set(poolKey(p), p);
  for (const p of discovered) map.set(poolKey(p), p);
  return Array.from(map.values());
}

export function poolKey(p: Pick<CachedPool, "address">): string {
  return p.address.toLowerCase();
}
