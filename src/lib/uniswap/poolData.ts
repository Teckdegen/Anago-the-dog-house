import type { CachedPool } from "./types";
import { POOL_DATA, POOL_DATA_COUNT, POOL_DATA_UPDATED_AT } from "./poolData.generated";

/** Static pool row from sync:pools — symbols included, metrics fetched on demand */
export type PoolDataEntry = CachedPool & {
  symbol0: string;
  symbol1: string;
};

const symbolMap = new Map<string, { symbol0: string; symbol1: string }>();

for (const p of POOL_DATA) {
  symbolMap.set(p.address.toLowerCase(), { symbol0: p.symbol0, symbol1: p.symbol1 });
}

export function getPoolData(): PoolDataEntry[] {
  return POOL_DATA.map((p) => ({ ...p, protocol: "v4" as const }));
}

export function getPoolDataCount(): number {
  return POOL_DATA_COUNT || POOL_DATA.length;
}

export function getPoolDataUpdatedAt(): number {
  return POOL_DATA_UPDATED_AT;
}

export function getPoolSymbols(address: string): { symbol0: string; symbol1: string } | null {
  return symbolMap.get(address.toLowerCase()) ?? null;
}

export function poolDataToCached(p: PoolDataEntry): CachedPool {
  return {
    address: p.address,
    token0: p.token0,
    token1: p.token1,
    fee: p.fee,
    tickSpacing: p.tickSpacing,
    protocol: "v4",
  };
}
