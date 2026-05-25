import { useCallback, useEffect, useRef, useState } from "react";
import type { CachedPool, EnrichedPool } from "@/lib/capricorn";
import { fetchPoolMetadata, getMonadPublicClient } from "@/lib/capricorn";
import { enrichFromCache, fetchPoolMetrics } from "@/lib/capricorn/poolMetrics";
import { isMetricsFresh, getCachedMetrics } from "@/lib/capricorn/poolMetricsCache";
import { mapInBatches } from "@/lib/capricorn/rpcQueue";
import { fetchClmmPoolsPage, type ClmmPoolsQuery } from "@/lib/clmm/api";

const EXPLORE_POOL_CAP = 500;

function apiRowToCached(row: EnrichedPool): CachedPool {
  return {
    address: row.address,
    token0: row.token0,
    token1: row.token1,
    fee: row.fee,
    tickSpacing: row.tickSpacing,
    protocol: "v3",
  };
}

function hasPoolTokens(pool: CachedPool): boolean {
  const t0 = pool.token0?.toLowerCase() ?? "";
  return t0.startsWith("0x") && t0.length === 42 && t0 !== "0x0000000000000000000000000000000000000000";
}

function rowFromApi(pool: EnrichedPool): EnrichedPool {
  const cached = getCachedMetrics(pool.address);
  if (cached && isMetricsFresh(cached)) {
    return { ...apiRowToCached(pool), metrics: cached };
  }
  if (pool.metrics?.symbol0 || pool.metrics?.tvlUsd != null) {
    return pool;
  }
  return enrichFromCache(apiRowToCached(pool));
}

function tvlOf(row: EnrichedPool): number {
  const v = row.metrics?.tvlUsd;
  return v != null && Number.isFinite(v) ? v : -1;
}

/** Highest TVL first (null / unknown TVL last). */
function sortByTvlDesc(rows: EnrichedPool[]): EnrichedPool[] {
  return [...rows].sort((a, b) => tvlOf(b) - tvlOf(a));
}

function sortRows(rows: EnrichedPool[], sort: string, order: "asc" | "desc"): EnrichedPool[] {
  if (sort === "tvl" && order === "desc") {
    return sortByTvlDesc(rows);
  }

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

function paginate<T>(items: T[], page: number, limit: number): T[] {
  const from = (page - 1) * limit;
  return items.slice(from, from + limit);
}

async function enrichPoolsOnChain(rows: EnrichedPool[]): Promise<EnrichedPool[]> {
  const client = getMonadPublicClient();

  return mapInBatches(
    rows,
    async (row) => {
      try {
        let pool = apiRowToCached(row);
        if (!hasPoolTokens(pool)) {
          const meta = await fetchPoolMetadata(client, pool.address);
          if (meta) pool = meta;
        }
        const metrics = await fetchPoolMetrics(pool, client, false, { light: true });
        return { ...pool, metrics } satisfies EnrichedPool;
      } catch {
        return rowFromApi(row);
      }
    },
    { concurrency: 2, delayMs: 300 },
  );
}

export function useClmmPoolsPage(query: ClmmPoolsQuery, enabled = true) {
  const [rows, setRows] = useState<EnrichedPool[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enrichGen = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const gen = ++enrichGen.current;
    setLoading(true);
    setError(null);
    try {
      const sort = query.sort ?? "tvl";
      const order = query.order ?? "desc";
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const q = query.q?.trim() ?? "";

      const data = await fetchClmmPoolsPage({
        page: q ? page : 1,
        limit: q ? limit : EXPLORE_POOL_CAP,
        sort: "tvl",
        order: "desc",
        q: q || undefined,
      });
      if (gen !== enrichGen.current) return;

      const initial = data.pools.map(rowFromApi);
      const sortedInitial = q ? sortRows(initial, sort, order) : sortByTvlDesc(initial);

      if (q) {
        setRows(sortedInitial);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setRows(paginate(sortedInitial, page, limit));
        setTotal(data.total);
        setTotalPages(Math.ceil(data.total / limit) || 0);
      }
      setLoading(false);

      setEnriching(true);
      const enriched = await enrichPoolsOnChain(data.pools);
      if (gen !== enrichGen.current) return;

      const sorted = q ? sortRows(enriched, sort, order) : sortByTvlDesc(enriched);
      if (q) {
        setRows(sorted);
      } else {
        setRows(paginate(sorted, page, limit));
      }
    } catch (e) {
      if (gen !== enrichGen.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      if (gen === enrichGen.current) {
        setLoading(false);
        setEnriching(false);
      }
    }
  }, [enabled, query.page, query.limit, query.sort, query.order, query.q]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, total, totalPages, loading, enriching, error, reload: load };
}
