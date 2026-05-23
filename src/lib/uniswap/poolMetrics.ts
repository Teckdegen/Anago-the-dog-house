import type { PublicClient } from "viem";
import { fetchTokenFromDexScreener } from "@/lib/web3/dexscreener";
import { fetchTokenMeta } from "./poolState";
import { fetchPoolMetricsBatch } from "./fetchPoolsApi";
import { getPoolSymbols } from "./poolData";
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
  const key = pool.address.toLowerCase();
  const cached = getCachedMetrics(key);
  const symbols = getPoolSymbols(key);
  const base: PoolMetrics = cached ?? {
    poolAddress: key,
    displayId: poolDisplayId(pool.address),
    symbol0: symbols?.symbol0 ?? pool.token0.slice(0, 6),
    symbol1: symbols?.symbol1 ?? pool.token1.slice(0, 6),
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

const METRICS_BATCH_SIZE = 40;
/** Max pools to prefetch stats for on explore (rest show pair names only until scrolled) */
const METRICS_PREFETCH_LIMIT = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Lazy batch metrics — avoids indexing thousands of pools at once */
export async function indexPoolMetricsBatched(
  pools: CachedPool[],
  onProgress: (done: number, total: number) => void,
  options?: { limit?: number },
): Promise<void> {
  const limit = options?.limit ?? METRICS_PREFETCH_LIMIT;
  const targets = pools.slice(0, limit).filter((p) => {
    const c = getCachedMetrics(p.address.toLowerCase());
    return !c || !isMetricsFresh(c);
  });

  const total = Math.min(pools.length, limit);
  let done = pools.length - targets.length;

  if (targets.length === 0) {
    onProgress(total, total);
    return;
  }

  const batches = chunk(
    targets.map((p) => p.address.toLowerCase()),
    METRICS_BATCH_SIZE,
  );

  for (const ids of batches) {
    try {
      await fetchPoolMetricsBatch(ids);
    } catch (e) {
      console.warn("[poolMetrics] batch failed:", e);
    }
    done += ids.length;
    onProgress(Math.min(done, total), total);
    await new Promise((r) => setTimeout(r, 80));
  }
}

/** @deprecated Prefer indexPoolMetricsBatched */
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
