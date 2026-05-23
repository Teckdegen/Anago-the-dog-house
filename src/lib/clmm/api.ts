import type { EnrichedPool } from "@/lib/capricorn/poolMetrics";

/** Client-side pools page (hardcoded list + on-chain metrics). */
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
