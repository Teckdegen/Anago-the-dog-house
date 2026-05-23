import type { PublicClient } from "viem";
import { parseAbiItem } from "viem";
import { UNISWAP_V3 } from "./addresses";
import type { CachedPool } from "./types";

const POOL_CREATED = parseAbiItem(
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
);

/** Monad RPC limits eth_getLogs range (typically 100 blocks). */
export const FACTORY_LOG_CHUNK = 100n;

export type FactoryScanOptions = {
  fromBlock: bigint;
  toBlock: bigint;
  maxChunks?: number;
  onProgress?: (msg: string) => void;
};

function logToPool(log: {
  args?: {
    token0?: `0x${string}`;
    token1?: `0x${string}`;
    fee?: number;
    tickSpacing?: number;
    pool?: `0x${string}`;
  };
}): CachedPool | null {
  const args = log.args;
  if (!args?.pool || !args.token0 || !args.token1) return null;
  return {
    address: args.pool,
    token0: args.token0,
    token1: args.token1,
    fee: Number(args.fee ?? 0),
    tickSpacing: Number(args.tickSpacing ?? 0),
    protocol: "v3",
  };
}

/** Scan Factory PoolCreated logs in chunks; dedupes by pool address. */
export async function scanFactoryPools(
  client: PublicClient,
  options: FactoryScanOptions,
): Promise<{ pools: CachedPool[]; lastScannedBlock: bigint }> {
  const { fromBlock, toBlock, maxChunks = 500, onProgress } = options;
  const map = new Map<string, CachedPool>();
  let cursor = fromBlock;
  let chunks = 0;

  while (cursor <= toBlock && chunks < maxChunks) {
    const end =
      cursor + FACTORY_LOG_CHUNK - 1n > toBlock ? toBlock : cursor + FACTORY_LOG_CHUNK - 1n;
    onProgress?.(`Factory · blocks ${cursor}–${end} · ${map.size} pools`);

    try {
      const logs = await client.getLogs({
        address: UNISWAP_V3.factory,
        event: POOL_CREATED,
        fromBlock: cursor,
        toBlock: end,
      });
      for (const log of logs) {
        const pool = logToPool(log);
        if (pool) map.set(pool.address.toLowerCase(), pool);
      }
    } catch (e) {
      console.warn("Factory log chunk failed", cursor, end, e);
      break;
    }

    cursor = end + 1n;
    chunks++;
  }

  return { pools: [...map.values()], lastScannedBlock: cursor > toBlock ? toBlock : cursor - 1n };
}
