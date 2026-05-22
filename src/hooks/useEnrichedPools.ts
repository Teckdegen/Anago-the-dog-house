import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicClient } from "viem";
import type { CachedPool } from "@/lib/uniswap/types";
import {
  hydrateEnrichedPools,
  indexPoolMetricsIncremental,
  enrichFromCache,
  type EnrichedPool,
} from "@/lib/uniswap/poolMetrics";
import { isMetricsFresh, getCachedMetrics } from "@/lib/uniswap/poolMetricsCache";

export function useEnrichedPools(
  pools: CachedPool[],
  publicClient: PublicClient | null | undefined,
  enabled: boolean,
) {
  const [rows, setRows] = useState<EnrichedPool[]>(() => hydrateEnrichedPools(pools));
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const runId = useRef(0);

  const poolsKey = useMemo(() => pools.map((p) => p.address).join(","), [pools]);

  const allCachedFresh = useMemo(() => {
    if (pools.length === 0) return true;
    return pools.every((p) => isMetricsFresh(getCachedMetrics(p.address.toLowerCase())));
  }, [pools, poolsKey]);

  const runIndex = useCallback(async () => {
    if (!enabled || pools.length === 0) return;
    const id = ++runId.current;
    setRows(hydrateEnrichedPools(pools));

    if (allCachedFresh) {
      setProgress({ done: pools.length, total: pools.length });
      setIndexing(false);
      return;
    }

    setIndexing(true);
    setProgress({ done: 0, total: pools.length });

    const map = new Map<string, EnrichedPool>();
    for (const p of pools) map.set(p.address.toLowerCase(), enrichFromCache(p));

    await indexPoolMetricsIncremental(
      pools,
      publicClient,
      (done, total, latest) => {
        if (runId.current !== id) return;
        if (latest) map.set(latest.address.toLowerCase(), latest);
        setRows(pools.map((p) => map.get(p.address.toLowerCase())!));
        setProgress({ done, total });
      },
      { delayMs: 35, onlyStale: true },
    );

    if (runId.current === id) {
      setRows(hydrateEnrichedPools(pools));
      setIndexing(false);
    }
  }, [pools, poolsKey, publicClient, enabled, allCachedFresh]);

  useEffect(() => {
    setRows(hydrateEnrichedPools(pools));
    if (enabled) runIndex();
    return () => {
      runId.current++;
    };
  }, [poolsKey, enabled, runIndex]);

  return { rows, indexing, progress, allCachedFresh, refreshMetrics: runIndex };
}
