/**
 * Index Capricorn CL pools into Supabase (on-chain only — no DexScreener).
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  discoverPoolsFromFactory,
  fetchPoolRow,
  getProvider,
} from "./capricorn-onchain.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CURATED_PATH = join(ROOT, "../src/lib/capricorn/pools.ts");

const UPSERT_CHUNK = 40;
const DEFAULT_SCAN_BLOCKS = Number(process.env.INDEXER_SCAN_BLOCKS ?? 50_000);
const MAX_INDEX_PER_REQUEST = Number(process.env.CLMM_MAX_INDEX_PER_REQUEST ?? 40);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function readCuratedAddresses() {
  const src = readFileSync(CURATED_PATH, "utf8");
  const matches = [...src.matchAll(/"(0x[0-9a-fA-F]{40})"/g)].map((m) => m[1].toLowerCase());
  return [...new Set(matches)];
}

function rowNeedsOnChainIndex(row) {
  if (!row) return true;
  const t0 = (row.token0 ?? "").trim();
  const s0 = (row.symbol0 ?? "").trim();
  return !t0.startsWith("0x") || t0.length !== 42 || !s0;
}

export async function upsertPoolRows(supabase, rows) {
  if (!rows.length) return 0;
  const metricsAt = new Date().toISOString();
  let n = 0;
  for (const batch of chunk(rows, UPSERT_CHUNK)) {
    const payload = batch.map((r) => ({ ...r, metrics_at: metricsAt }));
    const { error } = await supabase.from("clmm_pools").upsert(payload, { onConflict: "address" });
    if (error) throw new Error(error.message);
    n += batch.length;
  }
  return n;
}

/**
 * Ensure curated + newly discovered factory pools exist in Supabase with on-chain metadata.
 */
export async function ensurePoolsIndexed(supabase, options = {}) {
  const discoverNew = options.discoverNew !== false;
  const scanBlocks = options.scanBlocks ?? DEFAULT_SCAN_BLOCKS;
  const maxIndex = options.maxIndex ?? MAX_INDEX_PER_REQUEST;

  const curated = readCuratedAddresses();
  const { data: existing, error } = await supabase
    .from("clmm_pools")
    .select("address, token0, symbol0");
  if (error) throw new Error(error.message);

  const byAddr = new Map((existing ?? []).map((r) => [r.address.toLowerCase(), r]));
  const needsIndex = new Set();

  for (const addr of curated) {
    if (rowNeedsOnChainIndex(byAddr.get(addr))) needsIndex.add(addr);
  }

  let discoveredCount = 0;
  if (discoverNew) {
    try {
      const provider = getProvider();
      const latest = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - scanBlocks);
      const discovered = await discoverPoolsFromFactory(provider, fromBlock, latest);
      discoveredCount = discovered.length;
      for (const addr of discovered) {
        if (rowNeedsOnChainIndex(byAddr.get(addr))) needsIndex.add(addr);
      }
    } catch (e) {
      console.warn("[clmm-pool-index] factory scan skipped:", e instanceof Error ? e.message : e);
    }
  }

  const curatedMissing = curated.filter((a) => needsIndex.has(a));
  const otherMissing = [...needsIndex].filter((a) => !curated.includes(a));
  const targets = [
    ...curatedMissing,
    ...otherMissing.slice(0, Math.max(0, maxIndex - curatedMissing.length)),
  ];
  if (!targets.length) {
    return { indexed: 0, discovered: discoveredCount, pending: needsIndex.size };
  }

  const provider = getProvider();
  const rows = [];
  let failed = 0;
  for (const addr of targets) {
    try {
      rows.push(await fetchPoolRow(provider, addr));
    } catch (e) {
      failed++;
      console.warn(`[clmm-pool-index] skip ${addr}:`, e instanceof Error ? e.message : e);
    }
  }

  const indexed = rows.length ? await upsertPoolRows(supabase, rows) : 0;
  return {
    indexed,
    failed,
    discovered: discoveredCount,
    pending: Math.max(0, needsIndex.size - targets.length),
  };
}
