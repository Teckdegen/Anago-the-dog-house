/**
 * 24/7 CLMM pool indexer — The Graph subgraph → Supabase.
 *
 *   node script.js              # every 5 min (default)
 *   node script.js --once
 *
 * Env: .env or .env.local — THE_GRAPH_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { syncClmmPoolsToSupabase } from "./lib/clmm-sync.mjs";
import { testSupabaseConnection } from "./lib/supabase-admin.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    const path = join(ROOT, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnv();

const once = process.argv.includes("--once");
const FIVE_MIN_MS = 300_000;
const intervalMs = Math.max(60_000, parseInt(process.env.SYNC_INTERVAL_MS ?? String(FIVE_MIN_MS), 10) || FIVE_MIN_MS);
const fullMetrics =
  process.env.FULL_METRICS_SYNC === "true" || process.env.FULL_METRICS_SYNC === "1";

let running = false;

async function tick() {
  if (running) {
    console.log(`[${iso()}] Previous sync still running — skip`);
    return;
  }
  running = true;
  try {
    console.log(`[${iso()}] Subgraph → Supabase sync starting…`);
    const result = await syncClmmPoolsToSupabase({ fullMetrics });
    console.log(
      `[${iso()}] Done: ${result.poolCount} pools, ${result.metricsUpdated} metrics updated`,
    );
  } catch (e) {
    console.error(`[${iso()}] Sync failed:`, e instanceof Error ? e.message : e);
    if (e instanceof Error && e.cause) console.error("  cause:", e.cause);
  } finally {
    running = false;
  }
}

function iso() {
  return new Date().toISOString();
}

async function main() {
  const missing = [];
  if (!process.env.THE_GRAPH_API_KEY || process.env.THE_GRAPH_API_KEY === "your_key_here") {
    missing.push("THE_GRAPH_API_KEY");
  }
  if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`);
    console.error("Add them to .env — see .env.example");
    process.exit(1);
  }

  console.log("CLMM pool indexer");
  console.log(`  Subgraph → Supabase (UI reads Supabase only)`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL?.replace(/\/+$/, "")}`);
  console.log(`  Full metrics: ${fullMetrics ? "yes (all pools)" : "top 1500 by liquidity"}`);
  console.log(`  Interval: ${once ? "once" : `every ${Math.round(intervalMs / 60_000)} min`}`);

  console.log(`[${iso()}] Testing Supabase connection…`);
  try {
    await testSupabaseConnection();
    console.log(`[${iso()}] Supabase OK (clmm_pools table reachable)`);
  } catch (e) {
    console.error(`[${iso()}] Supabase check failed:`, e instanceof Error ? e.message : e);
    console.error(`
Fix checklist:
  1. Supabase Dashboard → Project Settings → API
  2. SUPABASE_URL = Project URL (https://xxxxx.supabase.co)
  3. SUPABASE_SERVICE_ROLE_KEY = service_role secret (not anon)
  4. SQL Editor → run supabase/migrations/001_clmm_pools.sql
  5. Project not paused (Dashboard home)
`);
    process.exit(1);
  }

  await tick();

  if (!once) {
    setInterval(tick, intervalMs);
    console.log(`[${iso()}] Indexer running — Ctrl+C to stop`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
