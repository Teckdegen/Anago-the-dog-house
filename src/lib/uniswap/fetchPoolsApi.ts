import type { CachedPool } from "./types";
import type { PoolMetrics } from "./poolMetrics";
import { saveMetricsBatch } from "./poolMetricsCache";

export type V4PoolsApiResponse = {
  pools: CachedPool[];
  metrics?: PoolMetrics[];
  count: number;
  expected?: number;
  poolManager?: { poolCount?: string };
  updatedAt: number;
  error?: string;
  hint?: string;
};

/** Load all V4 pools via Vercel `/api/v4-pools` (The Graph key stays on server). */
export async function fetchPoolsFromApi(): Promise<V4PoolsApiResponse> {
  const res = await fetch("/api/v4-pools", {
    signal: AbortSignal.timeout(60_000),
  });

  const json = (await res.json()) as V4PoolsApiResponse & { error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Pool API HTTP ${res.status}`);
  }

  if (!json.pools?.length) {
    throw new Error(json.error ?? "Subgraph returned zero pools");
  }

  if (json.metrics?.length) {
    saveMetricsBatch(json.metrics);
  }

  return json;
}
