import type { PublicClient } from "viem";
import { parseAbiItem } from "viem";
import { UNISWAP_V3 } from "./addresses";
import { FACTORY_ABI } from "./abis";
import type { CachedPool } from "./types";
import { loadPoolCache, mergePools, savePoolCache } from "./poolCache";

const POOL_CREATED = parseAbiItem(
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
);

const CHUNK_SIZE = 50_000n;
const INITIAL_LOOKBACK = 300_000n;

export type DiscoverResult = {
  pools: CachedPool[];
  lastIndexedBlock: bigint;
  newPools: number;
};

export async function discoverPoolsIncremental(
  client: PublicClient,
  onProgress?: (msg: string) => void,
): Promise<DiscoverResult> {
  const latest = await client.getBlockNumber();
  const cached = loadPoolCache();
  const existing = cached?.pools ?? [];

  let fromBlock =
    cached?.lastIndexedBlock != null
      ? BigInt(cached.lastIndexedBlock) + 1n
      : latest > INITIAL_LOOKBACK
        ? latest - INITIAL_LOOKBACK
        : 0n;

  if (fromBlock > latest) {
    return { pools: existing, lastIndexedBlock: latest, newPools: 0 };
  }

  const discovered: CachedPool[] = [];

  while (fromBlock <= latest) {
    const toBlock = fromBlock + CHUNK_SIZE > latest ? latest : fromBlock + CHUNK_SIZE;
    onProgress?.(`Scanning blocks ${fromBlock.toString()} → ${toBlock.toString()}…`);

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
      });
    }

    fromBlock = toBlock + 1n;
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
    newPools: discovered.length,
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
