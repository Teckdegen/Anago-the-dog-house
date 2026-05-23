import type { PublicClient } from "viem";
import { getSeedPools, loadPoolCache, mergePools, savePoolCache } from "./poolCache";
import { SEED_POOLS_LAST_INDEXED_BLOCK } from "./seedPools.generated";
import type { CachedPool } from "./types";
import {
  discoverPoolsFromDexScreener,
  enrichPoolsOnChain,
} from "./discoverPoolsDexScreener";
import { scanFactoryPools } from "./discoverPoolsFactory";

/** Approximate block when Uniswap V3 factory went live on Monad. */
export const FACTORY_START_BLOCK = 75_000_000n;

const BROWSER_FACTORY_CHUNKS = 150;

export type DiscoverResult = {
  pools: CachedPool[];
  lastIndexedBlock: bigint;
  newPools: number;
};

/**
 * DexScreener + progressive Factory PoolCreated scan (100-block chunks for Monad RPC).
 * Pools deduped by address — never listed twice.
 */
export async function discoverPoolsIncremental(
  client: PublicClient,
  onProgress?: (msg: string) => void,
): Promise<DiscoverResult> {
  const latest = await client.getBlockNumber();
  const cached = loadPoolCache();
  let existing = cached.pools.length > 0 ? cached.pools : getSeedPools();
  let newCount = 0;

  onProgress?.("Loading pools from DexScreener…");
  let dexPools = await discoverPoolsFromDexScreener(onProgress);
  if (dexPools.length > 0) {
    onProgress?.(`Enriching ${dexPools.length} pools on-chain…`);
    dexPools = await enrichPoolsOnChain(client, dexPools, onProgress);
  }
  const beforeDex = existing.length;
  existing = mergePools(existing, dexPools);
  newCount += existing.length - beforeDex;

  const seedBlock = BigInt(SEED_POOLS_LAST_INDEXED_BLOCK || "0");
  const factoryCursor = cached.factoryIndexedThroughBlock
    ? BigInt(cached.factoryIndexedThroughBlock) + 1n
    : cached.lastIndexedBlock && BigInt(cached.lastIndexedBlock) > seedBlock
      ? BigInt(cached.lastIndexedBlock) + 1n
      : FACTORY_START_BLOCK;

  let factoryIndexedThrough = cached.factoryIndexedThroughBlock ?? factoryCursor.toString();

  if (factoryCursor <= latest) {
    onProgress?.(`Factory scan from block ${factoryCursor}…`);
    const { pools: factoryPools, lastScannedBlock } = await scanFactoryPools(client, {
      fromBlock: factoryCursor,
      toBlock: latest,
      maxChunks: BROWSER_FACTORY_CHUNKS,
      onProgress,
    });
    const enrichedFactory =
      factoryPools.length > 0
        ? await enrichPoolsOnChain(client, factoryPools, onProgress)
        : factoryPools;
    const beforeFactory = existing.length;
    existing = mergePools(existing, enrichedFactory);
    newCount += existing.length - beforeFactory;
    factoryIndexedThrough = lastScannedBlock.toString();
  }

  savePoolCache({
    lastIndexedBlock: latest.toString(),
    factoryIndexedThroughBlock: factoryIndexedThrough,
    pools: existing,
    updatedAt: Date.now(),
  });

  return { pools: existing, lastIndexedBlock: latest, newPools: newCount };
}

export { getPoolAddress } from "./discoverPoolsLookup";
