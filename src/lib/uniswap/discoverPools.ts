import { fetchPoolsFromApi } from "./fetchPoolsApi";
import { getSeedPools, loadPoolCache, mergePools, savePoolCache } from "./poolCache";
import type { CachedPool } from "./types";

export type DiscoverResult = {
  pools: CachedPool[];
  lastIndexedBlock: bigint;
  newPools: number;
};

/** Pools bundled in the app + browser cache from a prior subgraph fetch. */
export function loadLocalV4Pools(): CachedPool[] {
  const seed = getSeedPools();
  const cached = loadPoolCache();
  return mergePools([...seed], cached.pools);
}

/**
 * Loads all Uniswap V4 Monad pools:
 * 1. Seed file (from build-time sync) + localStorage cache
 * 2. If empty → `/api/v4-pools` on Vercel (THE_GRAPH_API_KEY server-side)
 */
export async function discoverPoolsIncremental(
  _client?: unknown,
  onProgress?: (msg: string) => void,
): Promise<DiscoverResult> {
  let pools = loadLocalV4Pools();

  if (pools.length === 0) {
    onProgress?.("Loading pools from Uniswap V4 subgraph…");
    try {
      const remote = await fetchPoolsFromApi();
      pools = remote.pools.map((p) => ({ ...p, protocol: "v4" as const }));
      savePoolCache({
        pools,
        lastIndexedBlock: String(Math.floor(Date.now() / 1000)),
        updatedAt: remote.updatedAt,
      });
      const expected = remote.expected ?? Number(remote.poolManager?.poolCount ?? 0);
      onProgress?.(
        `Loaded ${pools.length} V4 pools` + (expected ? ` (subgraph reports ${expected})` : ""),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onProgress?.(`Pool load failed: ${msg}`);
      console.error("[discoverPools]", e);
      return {
        pools: [],
        lastIndexedBlock: 0n,
        newPools: 0,
      };
    }
  } else {
    onProgress?.(`${pools.length} Uniswap V4 pools`);
  }

  return {
    pools,
    lastIndexedBlock: BigInt(Math.floor(Date.now() / 1000)),
    newPools: 0,
  };
}
