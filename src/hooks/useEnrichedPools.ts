import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CachedPool } from "@/lib/capricorn/types";
import {
  hydrateEnrichedPools,
  indexPoolMetricsBatched,
  enrichFromCache,
  type EnrichedPool,
} from "@/lib/capricorn/poolMetrics";
import { getCachedMetrics, isMetricsFresh } from "@/lib/capricorn/poolMetricsCache";
import { getMonadPublicClient } from "@/lib/capricorn";

export function useEnrichedPools(pools: CachedPool[], enabled: boolean) {
  const [rows, setRows] = useState<EnrichedPool[]>(() => hydrateEnrichedPools(pools));
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const runId = useRef(0);
  const monadClient = getMonadPublicClient();

  const poolsKey = useMemo(() => pools.map((p) => p.address).join(","), [pools]);

  const runIndex = useCallback(async () => {
    if (!enabled || pools.length === 0) return;
    const id = ++runId.current;

    setRows(hydrateEnrichedPools(pools));

    const prefetchTotal = pools.length;
    const needsWork = pools.some((p) => {
      const c = getCachedMetrics(p.address.toLowerCase());
      return !c || !isMetricsFresh(c);
    });

    if (!needsWork) {
      setProgress({ done: prefetchTotal, total: prefetchTotal });
      setIndexing(false);
      return;
    }

    setIndexing(true);
    setProgress({ done: 0, total: prefetchTotal });

    await indexPoolMetricsBatched(
      pools,
      (done, total) => {
        if (runId.current !== id) return;
        setProgress({ done, total });
        setRows(pools.map((p) => enrichFromCache(p)));
      },
      { limit: prefetchTotal, publicClient: monadClient },
    );

    if (runId.current === id) {
      setRows(hydrateEnrichedPools(pools));
      setIndexing(false);
    }
  }, [pools, poolsKey, enabled, monadClient]);

  useEffect(() => {
    setRows(hydrateEnrichedPools(pools));
    if (enabled) runIndex();
    return () => {
      runId.current++;
    };
  }, [poolsKey, enabled, runIndex]);

  return { rows, indexing, progress, refreshMetrics: runIndex };
}
