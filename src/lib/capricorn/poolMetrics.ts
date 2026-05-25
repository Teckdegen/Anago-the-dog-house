import type { PublicClient } from "viem";
import { formatUnits } from "viem";
import { fetchZerionTokenMeta } from "@/lib/web3/zerion";
import { fetchPairFromDexScreener, fetchTokenFromDexScreener, batchGetTokenPrices } from "@/lib/web3/dexscreener";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { fetchPoolMetadata, fetchTokenMeta } from "./poolState";
import {
  getCachedMetrics,
  isMetricsFresh,
  poolDisplayId,
  saveMetrics,
} from "./poolMetricsCache";
import type { CachedPool } from "./types";

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
  buys24h: number | null;
  sells24h: number | null;
  priceNative: string | null;
  updatedAt: number;
};

export type EnrichedPool = CachedPool & { metrics: PoolMetrics };

type PairDexStats = {
  volume24hUsd: number | null;
  tvlUsd: number | null;
  priceChange24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
};

export async function fetchPairDexStats(pairAddress: string): Promise<PairDexStats> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/monad/${pairAddress}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { volume24hUsd: null, tvlUsd: null, priceChange24h: null, buys24h: null, sells24h: null };
    }
    const json = await res.json();
    const pair = json?.pair ?? json?.pairs?.[0];
    const vol = parseFloat(pair?.volume?.h24 ?? "0");
    const liq = parseFloat(pair?.liquidity?.usd ?? "0");
    const pc = parseFloat(pair?.priceChange?.h24 ?? "");
    const tx24 = pair?.txns?.h24;
    return {
      volume24hUsd: vol > 0 ? vol : null,
      tvlUsd: liq > 0 ? liq : null,
      priceChange24h: Number.isFinite(pc) ? pc : null,
      buys24h: tx24?.buys != null ? Number(tx24.buys) : null,
      sells24h: tx24?.sells != null ? Number(tx24.sells) : null,
    };
  } catch {
    return { volume24hUsd: null, tvlUsd: null, priceChange24h: null, buys24h: null, sells24h: null };
  }
}

async function computeTvlUsd(
  client: PublicClient,
  pool: CachedPool,
): Promise<number | null> {
  try {
    const [bal0, bal1] = await Promise.all([
      client.readContract({
        address: pool.token0,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [pool.address],
      }),
      client.readContract({
        address: pool.token1,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [pool.address],
      }),
    ]);
    const prices = await batchGetTokenPrices([pool.token0, pool.token1]);
    const [meta0, meta1] = await Promise.all([
      fetchTokenMeta(client, pool.token0),
      fetchTokenMeta(client, pool.token1),
    ]);
    const p0 = prices.get(pool.token0.toLowerCase()) ?? 0;
    const p1 = prices.get(pool.token1.toLowerCase()) ?? 0;
    const human0 = Number(formatUnits(bal0 as bigint, meta0.decimals));
    const human1 = Number(formatUnits(bal1 as bigint, meta1.decimals));
    const tvl = human0 * p0 + human1 * p1;
    return tvl > 0 ? tvl : null;
  } catch {
    return null;
  }
}

export type FetchPoolMetricsOptions = {
  /** DexScreener-only path — avoids on-chain balanceOf / symbol reads (list pages). */
  light?: boolean;
};

export async function fetchPoolMetrics(
  pool: CachedPool,
  publicClient?: PublicClient | null,
  force = false,
  options?: FetchPoolMetricsOptions,
): Promise<PoolMetrics> {
  const key = pool.address.toLowerCase();
  const cached = getCachedMetrics(key);
  if (!force && cached && isMetricsFresh(cached)) return cached;

  const light = options?.light ?? false;
  let resolved = pool;
  const missingTokens =
    !pool.token0 ||
    !pool.token0.startsWith("0x") ||
    pool.token0 === "0x0000000000000000000000000000000000000000";

  if (publicClient && missingTokens) {
    const meta = await fetchPoolMetadata(publicClient, pool.address);
    if (meta) resolved = meta;
  }

  const dexClient = light ? null : publicClient;
  const [meta0, meta1, pairDex, pairStats] = await Promise.all([
    fetchTokenFromDexScreener(resolved.token0, dexClient),
    fetchTokenFromDexScreener(resolved.token1, dexClient),
    fetchPairFromDexScreener(resolved.address),
    fetchPairDexStats(resolved.address),
  ]);

  let volume24hUsd = pairStats.volume24hUsd;
  let tvlUsd = pairStats.tvlUsd;

  if (!light && publicClient && tvlUsd == null) {
    tvlUsd = await computeTvlUsd(publicClient, resolved);
  }

  const [zer0, zer1] = await Promise.all([
    fetchZerionTokenMeta(resolved.token0).catch(() => null),
    fetchZerionTokenMeta(resolved.token1).catch(() => null),
  ]);

  let symbol0 = meta0?.symbol || zer0?.symbol || resolved.token0.slice(0, 6);
  let symbol1 = meta1?.symbol || zer1?.symbol || resolved.token1.slice(0, 6);

  let priceChange24h = pairStats.priceChange24h;
  if (priceChange24h == null && zer0?.priceChange24h != null) priceChange24h = zer0.priceChange24h;
  if (priceChange24h == null && zer1?.priceChange24h != null) priceChange24h = zer1.priceChange24h;

  if (!light && (!symbol0 || symbol0.length > 12) && publicClient) {
    const m = await fetchTokenMeta(publicClient, resolved.token0);
    symbol0 = m.symbol;
  }
  if (!light && (!symbol1 || symbol1.length > 12) && publicClient) {
    const m = await fetchTokenMeta(publicClient, resolved.token1);
    symbol1 = m.symbol;
  }

  const fee = resolved.fee || 3000;
  const fees24hUsd = estimateFees24h(volume24hUsd, fee);
  const aprPercent = estimateApr(fees24hUsd, tvlUsd);

  const metrics: PoolMetrics = {
    poolAddress: key,
    displayId: poolDisplayId(resolved.address),
    symbol0,
    symbol1,
    token0: resolved.token0,
    token1: resolved.token1,
    logo0: meta0?.logoURI ?? zer0?.logoURI ?? null,
    logo1: meta1?.logoURI ?? zer1?.logoURI ?? null,
    pairImageUrl: pairDex?.imageUrl ?? null,
    feePercent: feeToPercent(fee),
    tvlUsd,
    volume24hUsd,
    fees24hUsd,
    aprPercent,
    priceUsd: meta0?.priceUsd ?? null,
    priceChange24h,
    buys24h: pairStats.buys24h,
    sells24h: pairStats.sells24h,
    priceNative: null,
    updatedAt: Date.now(),
  };

  saveMetrics(metrics);
  return metrics;
}

export function enrichFromCache(pool: CachedPool): EnrichedPool {
  const key = pool.address.toLowerCase();
  const cached = getCachedMetrics(key);
  const base: PoolMetrics = cached ?? {
    poolAddress: key,
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
    buys24h: null,
    sells24h: null,
    priceNative: null,
    updatedAt: 0,
  };
  return { ...pool, metrics: base };
}

export function hydrateEnrichedPools(pools: CachedPool[]): EnrichedPool[] {
  return pools.map(enrichFromCache);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const METRICS_BATCH_SIZE = 3;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function indexPoolMetricsBatched(
  pools: CachedPool[],
  onProgress: (done: number, total: number) => void,
  options?: { limit?: number; publicClient?: PublicClient | null },
): Promise<void> {
  const limit = options?.limit ?? pools.length;
  const client = options?.publicClient ?? null;
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

  const batches = chunk(targets, METRICS_BATCH_SIZE);

  for (const batch of batches) {
    await Promise.all(
      batch.map((p) => fetchPoolMetrics(p, client, true).catch(() => enrichFromCache(p).metrics)),
    );
    done += batch.length;
    onProgress(Math.min(done, total), total);
    await sleep(400);
  }
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
