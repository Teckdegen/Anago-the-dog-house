import type { PublicClient } from "viem";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { POOL_ABI } from "./abis";
import { CAPRICORN_POOL_ADDRESSES } from "./pools";
import { mapInBatches } from "./rpcQueue";
import type { CachedPool, PoolLiveState, TokenMeta } from "./types";

const Q96 = 2n ** 96n;
const Q192 = 2n ** 192n;

/** token1 per token0 — bigint-safe (Number(sqrtPriceX96) loses precision). */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): number {
  if (sqrtPriceX96 <= 0n) return 0;
  const scale = 1_000_000_000_000_000_000n;
  const ratioScaled = (sqrtPriceX96 * sqrtPriceX96 * scale) / Q192;
  return (Number(ratioScaled) / Number(scale)) * 10 ** (decimals0 - decimals1);
}

/** Inverse of sqrtPriceX96ToPrice for range presets. */
export function priceToSqrtPriceX96(
  price: number,
  decimals0: number,
  decimals1: number,
): bigint {
  if (!Number.isFinite(price) || price <= 0) return 1n;
  const ratio = price / 10 ** (decimals0 - decimals1);
  const sqrtRatio = Math.sqrt(ratio);
  return BigInt(Math.floor(sqrtRatio * Number(Q96)));
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

export async function fetchPoolMetadata(
  client: PublicClient,
  poolAddress: `0x${string}`,
): Promise<CachedPool | null> {
  try {
    const [token0, token1, fee, tickSpacing] = await Promise.all([
      client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "token0" }),
      client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "token1" }),
      client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "fee" }),
      client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "tickSpacing" }),
    ]);
    return {
      address: poolAddress.toLowerCase() as `0x${string}`,
      token0: (token0 as `0x${string}`).toLowerCase() as `0x${string}`,
      token1: (token1 as `0x${string}`).toLowerCase() as `0x${string}`,
      fee: Number(fee),
      tickSpacing: Number(tickSpacing),
      protocol: "v3",
    };
  } catch {
    return null;
  }
}

export async function fetchPoolLiveState(
  client: PublicClient,
  pool: CachedPool,
): Promise<PoolLiveState | null> {
  try {
    const [slot0, liquidity, meta0, meta1] = await Promise.all([
      client.readContract({
        address: pool.address,
        abi: POOL_ABI,
        functionName: "slot0",
      }),
      client.readContract({
        address: pool.address,
        abi: POOL_ABI,
        functionName: "liquidity",
      }),
      fetchTokenMeta(client, pool.token0),
      fetchTokenMeta(client, pool.token1),
    ]);

    const sqrtPriceX96 = slot0[0] as bigint;
    const tick = Number(slot0[1]);

    return {
      pool,
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
  const pct = fee / 10_000;
  if (pct >= 1 && pct % 1 === 0) return `${pct.toFixed(0)}%`;
  if (pct * 10 === Math.floor(pct * 10)) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}

const knownSet = new Set(CAPRICORN_POOL_ADDRESSES.map((a) => a.toLowerCase()));

export function isKnownPoolAddress(address: string): boolean {
  return knownSet.has(address.toLowerCase());
}

export async function resolvePoolByAddress(
  client: PublicClient,
  poolAddress: `0x${string}`,
): Promise<CachedPool | null> {
  return fetchPoolMetadata(client, poolAddress.toLowerCase() as `0x${string}`);
}

export async function hydratePools(
  client: PublicClient,
  addresses: readonly string[],
): Promise<CachedPool[]> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const results = await mapInBatches(
    unique,
    (a) => fetchPoolMetadata(client, a as `0x${string}`),
    { concurrency: 2, delayMs: 200 },
  );
  return results.filter((p): p is CachedPool => p != null);
}
