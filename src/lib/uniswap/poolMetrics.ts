import type { PublicClient } from "viem";
import { fetchTokenFromDexScreener } from "@/lib/web3/dexscreener";
import { fetchTokenMeta } from "./poolState";
import type { CachedPool } from "./types";
import {
  getCachedMetrics,
  isMetricsFresh,
  saveMetrics,
  poolDisplayId,
} from "./poolMetricsCache";
import { fetchV4PoolFromSubgraph } from "./subgraph";
import { subgraphPoolToMetrics } from "./discoverPoolsSubgraph";

function feeToPercent(fee: number): string {
  return `${(fee / 10_000).toFixed(fee % 100 === 0 ? 2 : 4)}%`;
}

function estimateFees24h(volume24h: number | null, fee: number): number | null {
  if (volume24h == null || volume24h <= 0) return null;
  return volume24h * (fee / 1_000_000);
}

function estimateApr(fees24h: number | null, tvl: number | null): number | null {
  if (fees24h == null || tvl == null || tvl <= 0) return null;
  return (fees24h / tvl) * 365 * 100;
}

export type PoolMetrics = {
  poolAddress: string;
  displayId: string;
  symbol0: string;
  symbol1: string;
  token0: string;
  token1: string;
  logo0: string | null;
  logo1: string | null;
  pairImageUrl: string | null;
  feePercent: string;
  tvlUsd: number | null;
  volume24hUsd: number | null;
  fees24hUsd: number | null;
  aprPercent: number | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  priceNative: string | null;
  updatedAt: number;
};

export type EnrichedPool = CachedPool & { metrics: PoolMetrics };

async function fetchV4MetricsFromSubgraph(pool: CachedPool): Promise<PoolMetrics | null> {
  try {
    const raw = await fetchV4PoolFromSubgraph(pool.address);
    if (!raw) return null;
    return subgraphPoolToMetrics(raw);
  } catch {
    return null;
  }
}

export async function fetchPoolMetrics(
  pool: CachedPool,
  publicClient?: PublicClient | null,
  force = false,
): Promise<PoolMetrics> {
  const key = pool.address.toLowerCase();
  const cached = getCachedMetrics(key);
  if (!force && cached && isMetricsFresh(cached)) return cached;

  const fromSubgraph = await fetchV4MetricsFromSubgraph(pool);
  if (fromSubgraph) {
    saveMetrics(fromSubgraph);
    return fromSubgraph;
  }

  const [meta0, meta1] = await Promise.all([
    fetchTokenFromDexScreener(pool.token0, publicClient),
    fetchTokenFromDexScreener(pool.token1, publicClient),
  ]);

  let symbol0 = meta0?.symbol || pool.token0.slice(0, 6);
  let symbol1 = meta1?.symbol || pool.token1.slice(0, 6);

  if ((!symbol0 || symbol0.length > 12) && publicClient) {
    const m = await fetchTokenMeta(publicClient, pool.token0);
    symbol0 = m.symbol;
  }
  if ((!symbol1 || symbol1.length > 12) && publicClient) {
    const m = await fetchTokenMeta(publicClient, pool.token1);
    symbol1 = m.symbol;
  }

  const tvlUsd = cached?.tvlUsd ?? null;
  const volume24hUsd = cached?.volume24hUsd ?? null;
  const fees24hUsd = estimateFees24h(volume24hUsd, pool.fee);
  const aprPercent = estimateApr(fees24hUsd, tvlUsd);

  const metrics: PoolMetrics = {
    poolAddress: key,
    displayId: poolDisplayId(key),
    symbol0,
    symbol1,
    token0: pool.token0,
    token1: pool.token1,
    logo0: meta0?.logoURI ?? null,
    logo1: meta1?.logoURI ?? null,
    pairImageUrl: null,
    feePercent: feeToPercent(pool.fee),
    tvlUsd,
    volume24hUsd,
    fees24hUsd,
    aprPercent,
    priceUsd: cached?.priceUsd ?? null,
    priceChange24h: null,
    priceNative: null,
    updatedAt: Date.now(),
  };

  saveMetrics(metrics);
  return metrics;
}

export function enrichFromCache(pool: CachedPool): EnrichedPool {
  const cached = getCachedMetrics(pool.address.toLowerCase());
  const base: PoolMetrics = cached ?? {
    poolAddress: pool.address.toLowerCase(),
    displayId: poolDisplayId(pool.address),
    symbol0: pool.token0.slice(0, 6),
    symbol1: pool.token1.slice(0, 6),
    token0: pool.token0,
    token1: pool.token1,
    logo0: null,
    logo1: null,
    pairImageUrl: null,
    feePercent: feeToPercent(pool.fee),
    tvlUsd: null,
    volume24hUsd: null,
    fees24hUsd: null,
    aprPercent: null,
    priceUsd: null,
    priceChange24h: null,
    priceNative: null,
    updatedAt: 0,
  };
  return { ...pool, metrics: base };
}

export function hydrateEnrichedPools(pools: CachedPool[]): EnrichedPool[] {
  return pools.map(enrichFromCache);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** First visit: enrich one-by-one with UI callback. Cached pools skip network. */
export async function indexPoolMetricsIncremental(
  pools: CachedPool[],
  publicClient: PublicClient | null | undefined,
  onProgress: (done: number, total: number, latest?: EnrichedPool) => void,
  options?: { delayMs?: number; onlyStale?: boolean },
): Promise<EnrichedPool[]> {
  const delayMs = options?.delayMs ?? 40;
  const onlyStale = options?.onlyStale ?? true;
  const result: EnrichedPool[] = [];
  let done = 0;

  for (const pool of pools) {
    const cached = getCachedMetrics(pool.address.toLowerCase());
    if (onlyStale && cached && isMetricsFresh(cached)) {
      const row = enrichFromCache(pool);
      result.push(row);
      done++;
      onProgress(done, pools.length, row);
      continue;
    }

    const metrics = await fetchPoolMetrics(pool, publicClient, true);
    const row: EnrichedPool = { ...pool, metrics };
    result.push(row);
    done++;
    onProgress(done, pools.length, row);
    if (delayMs > 0) await sleep(delayMs);
  }

  return result;
}

export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function formatApr(apr: number | null | undefined): string {
  if (apr == null || Number.isNaN(apr)) return "—";
  return `${apr.toFixed(2)}%`;
}

export function truncateAddress(addr: string, left = 6, right = 4): string {
  if (addr.length <= left + right + 2) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}
