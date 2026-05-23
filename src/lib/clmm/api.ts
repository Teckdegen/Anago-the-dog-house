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

export async function fetchClmmPoolsPage(query: ClmmPoolsQuery = {}): Promise<ClmmPoolsPageResponse> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 50));
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

/** All indexed pool addresses (for on-chain search). */
export async function fetchPoolAddressList(): Promise<string[]> {
  const res = await fetch("/api/clmm/pools?limit=500&page=1&sort=tvl&order=desc");
  const json = (await res.json()) as ClmmPoolsPageResponse & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Failed to load pools");
  return json.pools.map((p) => p.address.toLowerCase());
}
