import { useCallback, useEffect, useState } from "react";
import type { CachedPool, EnrichedPool } from "@/lib/capricorn";
import {
  feeToPercent,
  fetchPoolMetadata,
  fetchTokenMeta,
  getMonadPublicClient,
  hydratePools,
} from "@/lib/capricorn";
import { fetchPoolMetrics, type PoolMetrics } from "@/lib/capricorn/poolMetrics";
import { fetchClmmPoolsPage, fetchPoolAddressList, type ClmmPoolsQuery } from "@/lib/clmm/api";

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

function paginate<T>(items: T[], page: number, limit: number) {
  const from = (page - 1) * limit;
  return items.slice(from, from + limit);
}

async function poolMatchesQuery(client: ReturnType<typeof getMonadPublicClient>, pool: CachedPool, q: string) {
  const needle = q.toLowerCase();
  if (pool.address.toLowerCase().includes(needle)) return true;
  try {
    const [t0, t1] = await Promise.all([
      fetchTokenMeta(client, pool.token0),
      fetchTokenMeta(client, pool.token1),
    ]);
    return (
      t0.symbol.toLowerCase().includes(needle) || t1.symbol.toLowerCase().includes(needle)
    );
  } catch {
    return false;
  }
}

async function searchPoolsOnChain(
  q: string,
  sort: string,
  order: "asc" | "desc",
  page: number,
  limit: number,
): Promise<{ rows: EnrichedPool[]; total: number; totalPages: number }> {
  const client = getMonadPublicClient();
  const addresses = await fetchPoolAddressList();
  const hydrated = await hydratePools(client, addresses);

  const matched: CachedPool[] = [];
  const batch = 20;
  for (let i = 0; i < hydrated.length; i += batch) {
    const slice = hydrated.slice(i, i + batch);
    const results = await Promise.all(
      slice.map(async (p) => ((await poolMatchesQuery(client, p, q)) ? p : null)),
    );
    for (const p of results) if (p) matched.push(p);
  }

  const enriched: EnrichedPool[] = [];
  for (let i = 0; i < matched.length; i += batch) {
    const slice = matched.slice(i, i + batch);
    const metrics = await Promise.all(
      slice.map((p) => fetchPoolMetrics(p, client, true)),
    );
    enriched.push(...slice.map((p, j) => ({ ...p, metrics: metrics[j] as PoolMetrics })));
  }

  const sorted = sortRows(enriched, sort, order);
  const total = sorted.length;
  return {
    rows: paginate(sorted, page, limit),
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

async function refreshFeesOnChain(rows: EnrichedPool[]): Promise<EnrichedPool[]> {
  const client = getMonadPublicClient();
  return Promise.all(
    rows.map(async (row) => {
      try {
        const meta = await fetchPoolMetadata(client, row.address);
        if (!meta) return row;
        return {
          ...row,
          fee: meta.fee,
          tickSpacing: meta.tickSpacing,
          token0: meta.token0,
          token1: meta.token1,
          metrics: {
            ...row.metrics,
            feePercent: feeToPercent(meta.fee),
            symbol0: row.metrics.symbol0 || (await fetchTokenMeta(client, meta.token0)).symbol,
            symbol1: row.metrics.symbol1 || (await fetchTokenMeta(client, meta.token1)).symbol,
          },
        };
      } catch {
        return row;
      }
    }),
  );
}

export function useClmmPoolsPage(query: ClmmPoolsQuery, enabled = true) {
  const [rows, setRows] = useState<EnrichedPool[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const q = query.q?.trim() ?? "";
      const page = query.page ?? 1;
      const limit = query.limit ?? 50;
      const sort = query.sort ?? "tvl";
      const order = query.order ?? "desc";

      if (q) {
        const result = await searchPoolsOnChain(q, sort, order, page, limit);
        setRows(result.rows);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else {
        const data = await fetchClmmPoolsPage({ ...query, q: undefined });
        setTotal(data.total);
        setTotalPages(data.totalPages);
        const withFees = await refreshFeesOnChain(data.pools);
        setRows(withFees);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, query.page, query.limit, query.sort, query.order, query.q]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, total, totalPages, loading, error, reload: load };
}
