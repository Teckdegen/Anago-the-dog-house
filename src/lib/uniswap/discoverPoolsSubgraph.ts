import type { CachedPool } from "./types";
import type { PoolMetrics } from "./poolMetrics";
import { poolDisplayId } from "./poolMetricsCache";
import { saveMetricsBatch } from "./poolMetricsCache";
import {
  fetchAllV4PoolsFromSubgraph,
  type SubgraphPool,
} from "./subgraph";

function toAddress(id: string): `0x${string}` {
  const hex = id.startsWith("0x") ? id : `0x${id}`;
  return hex.toLowerCase() as `0x${string}`;
}

function parseUsd(v: string | undefined | null): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function subgraphPoolToCached(p: SubgraphPool): CachedPool {
  return {
    address: toAddress(p.id),
    token0: toAddress(p.token0.id),
    token1: toAddress(p.token1.id),
    fee: Number(p.feeTier),
    tickSpacing: Number(p.tickSpacing),
    protocol: "v4",
  };
}

function feeToPercent(fee: number): string {
  return `${(fee / 10_000).toFixed(fee % 100 === 0 ? 2 : 4)}%`;
}

export function subgraphPoolToMetrics(p: SubgraphPool): PoolMetrics {
  const cached = subgraphPoolToCached(p);
  const day = p.poolDayDatas?.[0];
  const tvlUsd = parseUsd(day?.tvlUSD) ?? parseUsd(p.totalValueLockedUSD);
  const volume24hUsd = parseUsd(day?.volumeUSD);
  const fees24hUsd = parseUsd(day?.feesUSD);
  const aprPercent =
    fees24hUsd != null && tvlUsd != null && tvlUsd > 0
      ? (fees24hUsd / tvlUsd) * 365 * 100
      : null;

  const token0Price = parseUsd(day?.token0Price ?? p.token0Price);
  const token1Price = parseUsd(day?.token1Price ?? p.token1Price);
  const priceUsd = token0Price ?? (token1Price != null && token1Price > 0 ? 1 / token1Price : null);

  return {
    poolAddress: cached.address,
    displayId: poolDisplayId(cached.address),
    symbol0: p.token0.symbol || cached.token0.slice(0, 6),
    symbol1: p.token1.symbol || cached.token1.slice(0, 6),
    token0: cached.token0,
    token1: cached.token1,
    logo0: null,
    logo1: null,
    pairImageUrl: null,
    feePercent: feeToPercent(cached.fee),
    tvlUsd,
    volume24hUsd,
    fees24hUsd,
    aprPercent,
    priceUsd,
    priceChange24h: null,
    priceNative: null,
    updatedAt: Date.now(),
  };
}

/** Load every Uniswap V4 pool on Monad from The Graph subgraph. */
export async function discoverPoolsFromSubgraph(
  onProgress?: (msg: string) => void,
  apiKey?: string,
): Promise<CachedPool[]> {
  const { pools, poolManager } = await fetchAllV4PoolsFromSubgraph(onProgress, apiKey);
  if (pools.length === 0) {
    throw new Error("Subgraph returned zero V4 pools for Monad.");
  }

  onProgress?.(
    `Subgraph · mapped ${pools.length} pools` +
      (poolManager ? ` (PoolManager reports ${poolManager.poolCount})` : ""),
  );

  const cached = pools.map(subgraphPoolToCached);
  const metrics = pools.map(subgraphPoolToMetrics);
  saveMetricsBatch(metrics);

  return cached;
}
