import type { PublicClient } from "viem";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { STATE_VIEW_ABI } from "./abis";
import { isV4PoolId, UNISWAP_V4 } from "./addresses";
import { subgraphPoolToCached } from "./discoverPoolsSubgraph";
import { fetchV4PoolFromSubgraph } from "./subgraph";
import { loadPoolCache } from "./poolCache";
import type { CachedPool, PoolLiveState, TokenMeta } from "./types";

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
  const poolId = isV4PoolId(pool.address) ? pool.address : null;
  if (!poolId) return fetchPoolLiveStateFallback(pool);

  try {
    const [slot0, liquidity, meta0, meta1] = await Promise.all([
      client.readContract({
        address: UNISWAP_V4.stateView,
        abi: STATE_VIEW_ABI,
        functionName: "getSlot0",
        args: [poolId],
      }),
      client.readContract({
        address: UNISWAP_V4.stateView,
        abi: STATE_VIEW_ABI,
        functionName: "getLiquidity",
        args: [poolId],
      }),
      fetchTokenMeta(client, pool.token0),
      fetchTokenMeta(client, pool.token1),
    ]);

    const sqrtPriceX96 = slot0[0] as bigint;
    const tick = Number(slot0[1]);
    const lpFee = Number(slot0[3]);

    return {
      pool: {
        ...pool,
        protocol: "v4",
        fee: lpFee || pool.fee,
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
    return fetchPoolLiveStateFallback(pool);
  }
}

function fetchPoolLiveStateFallback(pool: CachedPool): PoolLiveState | null {
  if (!pool.token0 || !pool.token1) return null;
  return {
    pool: { ...pool, protocol: "v4" },
    token0Symbol: pool.token0.slice(0, 6),
    token1Symbol: pool.token1.slice(0, 6),
    token0Decimals: 18,
    token1Decimals: 18,
    liquidity: 0n,
    sqrtPriceX96: 0n,
    tick: 0,
    price: 0,
  };
}

export function feeToPercent(fee: number): string {
  return `${(fee / 10_000).toFixed(fee % 100 === 0 ? 2 : 4)}%`;
}

export async function resolvePoolByAddress(
  _client: PublicClient,
  poolAddress: `0x${string}`,
): Promise<CachedPool | null> {
  const cached = loadPoolCache()?.pools.find(
    (p) => p.address.toLowerCase() === poolAddress.toLowerCase(),
  );
  if (cached) return cached;

  if (!isV4PoolId(poolAddress)) return null;

  try {
    const sg = await fetchV4PoolFromSubgraph(poolAddress);
    if (sg) return subgraphPoolToCached(sg);
  } catch {
    /* subgraph unavailable */
  }

  return null;
}
