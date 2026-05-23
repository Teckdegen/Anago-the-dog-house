import { useCallback, useEffect, useState } from "react";
import type { EnrichedPool } from "@/lib/uniswap/poolMetrics";
import { fetchClmmPoolsPage, type ClmmPoolsQuery } from "@/lib/clmm/api";

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
      const data = await fetchClmmPoolsPage(query);
      setRows(data.pools);
      setTotal(data.total);
      setTotalPages(data.totalPages);
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
