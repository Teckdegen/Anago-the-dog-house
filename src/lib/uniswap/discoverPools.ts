import { getSeedPools, loadPoolCache, mergePools } from "./poolCache";
import type { CachedPool } from "./types";

export type DiscoverResult = {
  pools: CachedPool[];
  lastIndexedBlock: bigint;
  newPools: number;
};

/** Pools bundled in the app + anything saved in the browser from a prior visit. */
export function loadLocalV4Pools(): CachedPool[] {
  const seed = getSeedPools();
  const cached = loadPoolCache();
  return mergePools([...seed], cached.pools);
}

/**
 * Browser-safe pool list — does not call The Graph (API key stays in .env.local for `npm run sync:pools` only).
 * Run `npm run sync:pools` to fetch all V4 pools from the subgraph into seedPools.generated.ts.
 */
export async function discoverPoolsIncremental(
  _client?: unknown,
  onProgress?: (msg: string) => void,
): Promise<DiscoverResult> {
  const pools = loadLocalV4Pools();

  if (pools.length === 0) {
    onProgress?.(
      "No pools loaded — run npm run sync:pools with THE_GRAPH_API_KEY in .env.local (not VITE_)",
    );
  } else {
    onProgress?.(`${pools.length} Uniswap V4 pools`);
  }

  return {
    pools,
    lastIndexedBlock: BigInt(Math.floor(Date.now() / 1000)),
    newPools: 0,
  };
}
