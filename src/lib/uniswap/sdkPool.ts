import { Pool } from "@uniswap/v3-sdk";
import { Token } from "@uniswap/sdk-core";
import { MONAD_CHAIN_ID } from "./addresses";
import type { PoolLiveState } from "./types";

/** Build official Uniswap V3 SDK Pool from on-chain live state. */
export function buildSdkPool(live: PoolLiveState): Pool {
  const { pool, token0Decimals, token1Decimals, token0Symbol, token1Symbol, sqrtPriceX96, liquidity, tick } =
    live;

  const token0 = new Token(
    MONAD_CHAIN_ID,
    pool.token0,
    token0Decimals,
    token0Symbol,
    token0Symbol,
  );
  const token1 = new Token(
    MONAD_CHAIN_ID,
    pool.token1,
    token1Decimals,
    token1Symbol,
    token1Symbol,
  );

  return new Pool(
    token0,
    token1,
    pool.fee,
    sqrtPriceX96.toString(),
    liquidity.toString(),
    tick,
  );
}
