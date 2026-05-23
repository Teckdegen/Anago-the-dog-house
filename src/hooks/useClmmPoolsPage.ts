import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CAPRICORN_POOL_ADDRESSES,
  getMonadPublicClient,
  hydratePools,
  stubPoolsFromAddresses,
  type CachedPool,
  type EnrichedPool,
} from "@/lib/capricorn";
import { hydrateEnrichedPools } from "@/lib/capricorn/poolMetrics";
import { useEnrichedPools } from "@/hooks/useEnrichedPools";
import type { ClmmPoolsQuery } from "@/lib/clmm/api";

function sortRows(rows: EnrichedPool[], sort: string, order: "asc" | "desc"): EnrichedPool[] {
  const key =
    sort === "apr"
      ? "aprPercent"
      : sort === "vol"
        ? "volume24hUsd"
        : sort === "liquidity"
          ? "liquidity"
          : "tvlUsd";

  const mult = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av =
      key === "liquidity"
        ? Number(a.liquidity ?? 0)
        : ((a.metrics as Record<string, number | null>)[key] ?? -1);
    const bv =
      key === "liquidity"
        ? Number(b.liquidity ?? 0)
        : ((b.metrics as Record<string, number | null>)[key] ?? -1);
    return (av - bv) * mult;
  });
}

function filterRows(rows: EnrichedPool[], q: string): EnrichedPool[] {
  if (!q.trim()) return rows;
  const safe = q.trim().toLowerCase();
  return rows.filter((r) => {
    const m = r.metrics;
    return (
      r.address.toLowerCase().includes(safe) ||
      m.symbol0.toLowerCase().includes(safe) ||
      m.symbol1.toLowerCase().includes(safe)
    );
  });
}

export function useClmmPoolsPage(query: ClmmPoolsQuery, enabled = true) {
  const [pools, setPools] = useState<CachedPool[]>(() => stubPoolsFromAddresses());
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setHydrating(true);
    const client = getMonadPublicClient();
    hydratePools(client, CAPRICORN_POOL_ADDRESSES).then((resolved) => {
      if (!cancelled) {
        setPools(resolved.length > 0 ? resolved : stubPoolsFromAddresses());
        setHydrating(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const { rows: enriched, indexing, progress, refreshMetrics } = useEnrichedPools(pools, enabled);

  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const sort = query.sort ?? "tvl";
  const order = query.order ?? "desc";

  const filtered = useMemo(
    () => sortRows(filterRows(enriched, query.q ?? ""), sort, order),
    [enriched, query.q, sort, order],
  );

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 0;
  const rows = useMemo(() => {
    const from = (page - 1) * limit;
    return filtered.slice(from, from + limit);
  }, [filtered, page, limit]);

  const loading = hydrating || (indexing && enriched.every((r) => !r.metrics.updatedAt));

  const reload = useCallback(() => {
    refreshMetrics();
    const client = getMonadPublicClient();
    hydratePools(client, CAPRICORN_POOL_ADDRESSES).then((resolved) => {
      if (resolved.length > 0) setPools(resolved);
    });
  }, [refreshMetrics]);

  return {
    rows: loading && rows.length === 0 ? hydrateEnrichedPools(pools).slice(0, limit) : rows,
    total,
    totalPages,
    loading,
    error: null as string | null,
    reload,
    indexing,
    progress,
  };
}
