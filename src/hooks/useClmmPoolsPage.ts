import { useCallback, useEffect, useRef, useState } from "react";
import type { CachedPool, EnrichedPool } from "@/lib/capricorn";
import { fetchPoolMetadata, getMonadPublicClient } from "@/lib/capricorn";
import { enrichFromCache, fetchPoolMetrics } from "@/lib/capricorn/poolMetrics";
import { isMetricsFresh, getCachedMetrics } from "@/lib/capricorn/poolMetricsCache";
import { mapInBatches } from "@/lib/capricorn/rpcQueue";
import { stubPoolsFromAddresses } from "@/lib/capricorn/pools";
import type { ClmmPoolsQuery } from "@/lib/clmm/api";

function hasPoolTokens(pool: CachedPool): boolean {
  const t0 = pool.token0?.toLowerCase() ?? "";
  return t0.startsWith("0x") && t0.length === 42 && t0 !== "0x0000000000000000000000000000000000000000";
}

function stubToEnriched(pool: CachedPool): EnrichedPool {
  const cached = getCachedMetrics(pool.address);
  if (cached && isMetricsFresh(cached)) {
    return { ...pool, metrics: cached };
  }
  return enrichFromCache(pool);
}

function tvlOf(row: EnrichedPool): number {
  const v = row.metrics?.tvlUsd;
  return v != null && Number.isFinite(v) ? v : -1;
}

function metricNum(row: EnrichedPool, key: "aprPercent" | "volume24hUsd" | "tvlUsd"): number {
  const v = row.metrics[key];
  return v != null && Number.isFinite(v) ? v : -1;
}

/** Highest TVL first (unknown TVL last). */
function sortByTvlDesc(rows: EnrichedPool[]): EnrichedPool[] {
  return [...rows].sort((a, b) => tvlOf(b) - tvlOf(a));
}

function sortRows(rows: EnrichedPool[], sort: string, order: "asc" | "desc"): EnrichedPool[] {
  if (sort === "tvl" && order === "desc") {
    return sortByTvlDesc(rows);
  }

  const key: "aprPercent" | "volume24hUsd" | "tvlUsd" =
    sort === "apr" ? "aprPercent" : sort === "vol" ? "volume24hUsd" : "tvlUsd";
  const mult = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => (metricNum(a, key) - metricNum(b, key)) * mult);
}

function paginate<T>(items: T[], page: number, limit: number): T[] {
  const from = (page - 1) * limit;
  return items.slice(from, from + limit);
}

function matchesQuery(row: EnrichedPool, q: string): boolean {
  const needle = q.toLowerCase();
  if (row.address.toLowerCase().includes(needle)) return true;
  const m = row.metrics;
  return (
    (m.symbol0?.toLowerCase().includes(needle) ?? false) ||
    (m.symbol1?.toLowerCase().includes(needle) ?? false)
  );
}

function filterByQuery(rows: EnrichedPool[], q: string): EnrichedPool[] {
  const trimmed = q.trim();
  if (!trimmed) return rows;
  return rows.filter((r) => matchesQuery(r, trimmed));
}

/** Fetch real TVL/APR for visible page only (mainnet RPC + DexScreener). */
async function enrichPoolsOnChain(rows: EnrichedPool[]): Promise<EnrichedPool[]> {
  const client = getMonadPublicClient();

  return mapInBatches(
    rows,
    async (row) => {
      try {
        let pool: CachedPool = {
          address: row.address,
          token0: row.token0,
          token1: row.token1,
          fee: row.fee,
          tickSpacing: row.tickSpacing,
          protocol: "v3",
        };
        if (!hasPoolTokens(pool)) {
          const meta = await fetchPoolMetadata(client, pool.address);
          if (meta) pool = meta;
        }
        const metrics = await fetchPoolMetrics(pool, client, false, { light: true });
        return { ...pool, metrics } satisfies EnrichedPool;
      } catch {
        return stubToEnriched({
          address: row.address,
          token0: row.token0,
          token1: row.token1,
          fee: row.fee,
          tickSpacing: row.tickSpacing,
          protocol: "v3",
        });
      }
    },
    { concurrency: 2, delayMs: 350 },
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

    const sort = query.sort ?? "tvl";
    const order = query.order ?? "desc";
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q?.trim() ?? "";

    try {
      const stubs = stubPoolsFromAddresses().map(stubToEnriched);
      let working = filterByQuery(stubs, q);
      const sortedStub = sortRows(working, sort, order);
      const pageSlice = paginate(sortedStub, page, limit);

      setRows(pageSlice);
      setTotal(working.length);
      setTotalPages(Math.ceil(working.length / limit) || 0);
      setLoading(false);

      setEnriching(true);
      const enrichedPage = await enrichPoolsOnChain(pageSlice);
      if (gen !== enrichGen.current) return;

      const sortedPage = sortRows(enrichedPage, sort, order);
      setRows(sortedPage);
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
