import type { PublicClient } from "viem";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { POOL_ABI } from "./abis";
import { loadPoolCache } from "./poolCache";
import type { CachedPool, PoolLiveState, TokenMeta } from "./types";
import { readPoolTickSpacing } from "./liquidity";

export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): number {
  const ratio = Number(sqrtPriceX96) / 2 ** 96;
  const price = ratio * ratio;
  return price * 10 ** (decimals0 - decimals1);
}

export async function fetchTokenMeta(
  client: PublicClient,
  address: `0x${string}`,
): Promise<TokenMeta> {
  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
      client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
    ]);
    return {
      address,
      symbol: symbol as string,
      decimals: Number(decimals),
    };
  } catch {
    return { address, symbol: address.slice(0, 6), decimals: 18 };
  }
}

export async function fetchPoolLiveState(
  client: PublicClient,
  pool: CachedPool,
): Promise<PoolLiveState | null> {
  try {
    const [token0, token1, fee, liquidity, slot0] = await Promise.all([
      client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "token0" }),
      client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "token1" }),
      client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "fee" }),
      client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "liquidity" }),
      client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "slot0" }),
    ]);

    const [meta0, meta1] = await Promise.all([
      fetchTokenMeta(client, token0 as `0x${string}`),
      fetchTokenMeta(client, token1 as `0x${string}`),
    ]);

    const sqrtPriceX96 = slot0[0] as bigint;
    const tick = Number(slot0[1]);

    return {
      pool: {
        ...pool,
        token0: token0 as `0x${string}`,
        token1: token1 as `0x${string}`,
        fee: Number(fee),
      },
      token0Symbol: meta0.symbol,
      token1Symbol: meta1.symbol,
      token0Decimals: meta0.decimals,
      token1Decimals: meta1.decimals,
      liquidity: liquidity as bigint,
      sqrtPriceX96,
      tick,
      price: sqrtPriceX96ToPrice(sqrtPriceX96, meta0.decimals, meta1.decimals),
    };
  } catch {
    return null;
  }
}

export function feeToPercent(fee: number): string {
  return `${(fee / 10_000).toFixed(fee % 100 === 0 ? 2 : 4)}%`;
}

export async function resolvePoolByAddress(
  client: PublicClient,
  poolAddress: `0x${string}`,
): Promise<CachedPool | null> {
  const cached = loadPoolCache()?.pools.find(
    (p) => p.address.toLowerCase() === poolAddress.toLowerCase(),
  );
  if (cached) return cached;

  try {
    const [token0, token1, fee] = await Promise.all([
      client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "token0" }),
      client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "token1" }),
      client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "fee" }),
    ]);
    const tickSpacing = await readPoolTickSpacing(client, poolAddress);
    return {
      address: poolAddress,
      token0: token0 as `0x${string}`,
      token1: token1 as `0x${string}`,
      fee: Number(fee),
      tickSpacing,
    };
  } catch {
    return null;
  }
}
