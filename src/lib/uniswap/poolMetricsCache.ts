import type { PoolMetrics } from "./poolMetrics";

const CACHE_KEY = "uniswap_v3_pool_metrics_v2";
const METRICS_TTL_MS = 10 * 60 * 1000; // 10 min before background refresh

let memory: Record<string, PoolMetrics> | null = null;

export function loadAllMetricsCache(): Record<string, PoolMetrics> {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    memory = raw ? (JSON.parse(raw) as Record<string, PoolMetrics>) : {};
    return memory;
  } catch {
    memory = {};
    return memory;
  }
}

export function getCachedMetrics(poolAddress: string): PoolMetrics | null {
  const key = poolAddress.toLowerCase();
  const m = loadAllMetricsCache()[key];
  return m ?? null;
}

export function saveMetrics(metrics: PoolMetrics): void {
  const key = metrics.poolAddress.toLowerCase();
  const all = loadAllMetricsCache();
  all[key] = metrics;
  memory = all;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

export function saveMetricsBatch(batch: PoolMetrics[]): void {
  const all = loadAllMetricsCache();
  for (const m of batch) all[m.poolAddress.toLowerCase()] = m;
  memory = all;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

export function isMetricsFresh(m: PoolMetrics | null | undefined): boolean {
  if (!m?.updatedAt) return false;
  return Date.now() - m.updatedAt < METRICS_TTL_MS;
}

export function poolDisplayId(address: string): string {
  const n = parseInt(address.slice(2, 10), 16) % 100000;
  return `#${String(n).padStart(5, "0")}`;
}
