/**
 * Bundled Uniswap V4 pool list — addresses + token symbols only.
 * TVL / volume load on demand via /api/v4-pools-metrics.
 *
 * Regenerate: npm run sync:pools (THE_GRAPH_API_KEY in .env.local)
 */

import type { PoolDataEntry } from "./poolData";

export const POOL_DATA_UPDATED_AT = 0;
export const POOL_DATA_COUNT = 0;

/** Minimal pool records — no metrics (keeps bundle small) */
export const POOL_DATA: readonly PoolDataEntry[] = [] as const;
