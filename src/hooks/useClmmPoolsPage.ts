import { useCallback, useEffect, useState } from "react";
import type { CachedPool, EnrichedPool } from "@/lib/capricorn";
import {
  fetchPoolMetadata,
  fetchTokenMeta,
  getMonadPublicClient,
  hydratePools,
} from "@/lib/capricorn";
import { fetchPoolMetrics } from "@/lib/capricorn/poolMetrics";
import { fetchClmmPoolsPage, fetchPoolAddressList, type ClmmPoolsQuery } from "@/lib/clmm/api";

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

/** Live fee, TVL, volume, APR from Monad RPC (+ DexScreener for volume). */
async function enrichPoolsOnChain(rows: EnrichedPool[]): Promise<EnrichedPool[]> {
  const client = getMonadPublicClient();
  const batch = 12;
  const out: EnrichedPool[] = [];

  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    const chunk = await Promise.all(
      slice.map(async (row) => {
        try {
          let pool = apiRowToCached(row);
          const meta = await fetchPoolMetadata(client, pool.address);
          if (meta) pool = meta;
          const metrics = await fetchPoolMetrics(pool, client, true);
          return { ...pool, metrics } satisfies EnrichedPool;
        } catch {
          return row;
        }
      }),
    );
    out.push(...chunk);
  }
  return out;
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

  const enriched = await enrichPoolsOnChain(
    matched.map((p) => ({ ...p, metrics: { poolAddress: p.address } } as EnrichedPool)),
  );

  const sorted = sortRows(enriched, sort, order);
  const total = sorted.length;
  return {
    rows: paginate(sorted, page, limit),
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
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
      const sort = query.sort ?? "tvl";
      const order = query.order ?? "desc";

      if (q) {
        const result = await searchPoolsOnChain(
          q,
          sort,
          order,
          query.page ?? 1,
          query.limit ?? 50,
        );
        setRows(result.rows);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else {
        const data = await fetchClmmPoolsPage({ ...query, q: undefined });
        setTotal(data.total);
        setTotalPages(data.totalPages);
        const enriched = await enrichPoolsOnChain(data.pools);
        setRows(sortRows(enriched, sort, order));
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
