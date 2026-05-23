import type { CachedPool } from "./types";
import type { PoolMetrics } from "./poolMetrics";
import { saveMetricsBatch } from "./poolMetricsCache";

export type V4PoolsApiResponse = {
  pools: Array<CachedPool & { symbol0?: string; symbol1?: string }>;
  count: number;
  expected?: number;
  updatedAt: number;
  error?: string;
};

export async function fetchPoolsFromApi(): Promise<V4PoolsApiResponse> {
  const res = await fetch("/api/v4-pools", {
    signal: AbortSignal.timeout(90_000),
  });

  const json = (await res.json()) as V4PoolsApiResponse & { error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Pool API HTTP ${res.status}`);
  }

  if (!json.pools?.length) {
    throw new Error(json.error ?? "Subgraph returned zero pools");
  }

  return json;
}

export async function fetchPoolMetricsBatch(poolIds: string[]): Promise<PoolMetrics[]> {
  if (poolIds.length === 0) return [];

  const res = await fetch("/api/v4-pools-metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: poolIds }),
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json()) as { metrics?: PoolMetrics[]; error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Metrics API HTTP ${res.status}`);
  }

  const metrics = json.metrics ?? [];
  if (metrics.length > 0) saveMetricsBatch(metrics);
  return metrics;
}
