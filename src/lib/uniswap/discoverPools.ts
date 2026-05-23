import type { PublicClient } from "viem";
import { parseAbiItem } from "viem";
import { UNISWAP_V3 } from "./addresses";
import { FACTORY_ABI } from "./abis";
import type { CachedPool } from "./types";
import { getSeedPools, loadPoolCache, mergePools, savePoolCache } from "./poolCache";
import { SEED_POOLS_LAST_INDEXED_BLOCK } from "./seedPools.generated";
import {
  discoverPoolsFromDexScreener,
  enrichPoolsOnChain,
} from "./discoverPoolsDexScreener";

const POOL_CREATED = parseAbiItem(
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
);

/** Monad RPC: max 100 blocks per eth_getLogs */
const LOG_CHUNK = 100n;
const MAX_LOG_CHUNKS_PER_SYNC = 30;

export type DiscoverResult = {
  pools: CachedPool[];
  lastIndexedBlock: bigint;
  newPools: number;
};

/**
 * Primary: DexScreener lists Uniswap V3/V4 pairs on Monad (works in browser + Vercel).
 * Secondary: small on-chain log tail for brand-new pools after last index.
 */
export async function discoverPoolsIncremental(
  client: PublicClient,
  onProgress?: (msg: string) => void,
): Promise<DiscoverResult> {
  const latest = await client.getBlockNumber();
  const cached = loadPoolCache();
  let existing = cached.pools.length > 0 ? cached.pools : getSeedPools();

  onProgress?.("Loading pools from DexScreener…");
  let dexPools = await discoverPoolsFromDexScreener(onProgress);
  if (dexPools.length > 0) {
    onProgress?.(`Enriching ${dexPools.length} pools on-chain…`);
    dexPools = await enrichPoolsOnChain(client, dexPools, onProgress);
  }
  existing = mergePools(existing, dexPools);

  const seedBlock = BigInt(SEED_POOLS_LAST_INDEXED_BLOCK || "0");
  const cachedBlock = BigInt(cached.lastIndexedBlock || "0");
  const highWater = cachedBlock > seedBlock ? cachedBlock : seedBlock;

  let fromBlock = highWater > 0n ? highWater + 1n : latest > LOG_CHUNK * MAX_LOG_CHUNKS_PER_SYNC
    ? latest - LOG_CHUNK * BigInt(MAX_LOG_CHUNKS_PER_SYNC)
    : 0n;

  if (fromBlock > latest) {
    savePoolCache({
      lastIndexedBlock: latest.toString(),
      pools: existing,
      updatedAt: Date.now(),
    });
    return { pools: existing, lastIndexedBlock: latest, newPools: 0 };
  }

  const discovered: CachedPool[] = [];
  let chunks = 0;

  while (fromBlock <= latest && chunks < MAX_LOG_CHUNKS_PER_SYNC) {
    const toBlock =
      fromBlock + LOG_CHUNK - 1n > latest ? latest : fromBlock + LOG_CHUNK - 1n;
    onProgress?.(`New pools · blocks ${fromBlock}–${toBlock}`);

    try {
      const logs = await client.getLogs({
        address: UNISWAP_V3.factory,
        event: POOL_CREATED,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const args = log.args as {
          token0?: `0x${string}`;
          token1?: `0x${string}`;
          fee?: number;
          tickSpacing?: number;
          pool?: `0x${string}`;
        };
        if (!args.pool || !args.token0 || !args.token1) continue;
        discovered.push({
          address: args.pool,
          token0: args.token0,
          token1: args.token1,
          fee: Number(args.fee ?? 0),
          tickSpacing: Number(args.tickSpacing ?? 0),
          protocol: "v3",
        });
      }
    } catch {
      break;
    }

    fromBlock = toBlock + 1n;
    chunks++;
  }

  const merged = mergePools(existing, discovered);
  savePoolCache({
    lastIndexedBlock: latest.toString(),
    pools: merged,
    updatedAt: Date.now(),
  });

  return {
    pools: merged,
    lastIndexedBlock: latest,
    newPools: dexPools.length + discovered.length,
  };
}

/** Lookup pool by two tokens + fee */
export async function getPoolAddress(
  client: PublicClient,
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  fee: number,
): Promise<`0x${string}` | null> {
  const addr = await client.readContract({
    address: UNISWAP_V3.factory,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [tokenA, tokenB, fee],
  });
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return null;
  return addr as `0x${string}`;
}
