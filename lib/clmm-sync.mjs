/**
 * Capricorn CL pool discovery → Supabase.
 * Scans factory PoolCreated events + refreshes curated pool list.
 * UI reads pools from Supabase via /api/clmm/pools. Prefer bot/ on Railway for indexing.
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { CHAIN_ID, discoverPoolsFromFactory, fetchPoolRow, getProvider } from "./capricorn-onchain.mjs";
import { readCuratedAddresses, upsertPoolRows } from "./clmm-pool-index.mjs";
import { getSupabaseAdmin } from "./supabase-admin.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CURSOR_FILE = join(ROOT, ".capricorn-indexer-cursor.json");

const SCAN_BLOCKS = Number(process.env.INDEXER_SCAN_BLOCKS ?? 100_000);

function loadCursor() {
  if (!existsSync(CURSOR_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CURSOR_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveCursor(block) {
  writeFileSync(CURSOR_FILE, JSON.stringify({ lastBlock: block, updatedAt: new Date().toISOString() }));
}

export async function syncClmmPoolsToSupabase() {
  const provider = getProvider();
  const supabase = getSupabaseAdmin();
  const latest = await provider.getBlockNumber();
  const cursor = loadCursor();
  const fromBlock = cursor?.lastBlock
    ? Math.max(0, Number(cursor.lastBlock) - 1000)
    : Math.max(0, latest - SCAN_BLOCKS);

  console.log(`[clmm-sync] Scanning PoolCreated ${fromBlock} → ${latest}…`);
  const discovered = await discoverPoolsFromFactory(provider, fromBlock, latest);
  const curated = readCuratedAddresses();
  const allAddresses = [...new Set([...curated, ...discovered])];
  console.log(`[clmm-sync] ${allAddresses.length} pools (${curated.length} curated + ${discovered.length} from factory)`);

  const rows = [];
  let failed = 0;
  for (let i = 0; i < allAddresses.length; i++) {
    const addr = allAddresses[i];
    try {
      rows.push(await fetchPoolRow(provider, addr));
    } catch (e) {
      failed++;
      console.warn(`[clmm-sync] skip ${addr}:`, e instanceof Error ? e.message : e);
    }
    if ((i + 1) % 20 === 0) console.log(`[clmm-sync] fetched ${i + 1}/${allAddresses.length}`);
  }

  if (rows.length === 0) throw new Error("No pools indexed");
  await upsertPoolRows(supabase, rows);
  saveCursor(latest);

  return {
    ok: true,
    poolCount: rows.length,
    discovered: discovered.length,
    curated: curated.length,
    failed,
    chainId: CHAIN_ID,
    syncedAt: new Date().toISOString(),
  };
}
