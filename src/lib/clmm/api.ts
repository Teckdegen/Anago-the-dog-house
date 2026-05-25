import type { EnrichedPool } from "@/lib/capricorn/poolMetrics";

export type ClmmPoolsPageResponse = {
  pools: EnrichedPool[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sort: string;
  order: string;
};

export type ClmmPoolsQuery = {
  page?: number;
  limit?: number;
  sort?: "tvl" | "apr" | "vol" | "liquidity";
  order?: "asc" | "desc";
  q?: string;
};

export type NewClmmPoolRow = {
  address: string;
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  symbol0?: string;
  symbol1?: string;
};

/** Pools in Supabase that are not in the hardcoded list (optional factory discover). */
export async function fetchNewClmmPools(discover = false): Promise<{ pools: NewClmmPoolRow[] }> {
  const params = new URLSearchParams();
  if (discover) params.set("discover", "1");
  const res = await fetch(`/api/clmm/new-pools?${params}`);
  const json = (await res.json()) as { pools?: NewClmmPoolRow[]; error?: string };
  if (!res.ok && !json.pools) {
    throw new Error(json.error ?? `Failed to load new pools (${res.status})`);
  }
  return { pools: json.pools ?? [] };
}

export async function fetchClmmPoolsPage(query: ClmmPoolsQuery = {}): Promise<ClmmPoolsPageResponse> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  if (query.q?.trim()) params.set("q", query.q.trim());

  const res = await fetch(`/api/clmm/pools?${params}`);
  const json = (await res.json()) as ClmmPoolsPageResponse & { error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Failed to load pools (${res.status})`);
  }

  return json;
}

/** Hardcoded + any new pools from Supabase. */
export async function fetchPoolAddressList(): Promise<string[]> {
  const hardcoded = (await import("@/lib/capricorn/pools")).CAPRICORN_POOL_ADDRESSES.map((a) =>
    a.toLowerCase(),
  );
  try {
    const { pools } = await fetchNewClmmPools(false);
    const extra = pools.map((p) => p.address.toLowerCase());
    return [...new Set([...hardcoded, ...extra])];
  } catch {
    return hardcoded;
  }
}
