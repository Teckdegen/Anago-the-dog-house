export type CachedPool = {
  address: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickSpacing: number;
};

export type PoolLiveState = {
  pool: CachedPool;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  price: number;
};

export type TokenMeta = {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
};

export type ClmmTab = "swap" | "positions" | "liquidity";
