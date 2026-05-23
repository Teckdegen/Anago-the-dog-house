/**
 * 24/7 CLMM pool indexer — The Graph subgraph → Supabase.
 *
 * The web UI never talks to the subgraph. It only reads /api/clmm/pools (Supabase).
 * Run this on a VPS, Railway, Render, or locally with pm2:
 *
 *   node script.js              # loop forever (default every 15 min)
 *   node script.js --once       # single sync then exit
 *
 * Env (.env.local): THE_GRAPH_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: SYNC_INTERVAL_MS=900000  FULL_METRICS_SYNC=true
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { syncClmmPoolsToSupabase } from "./lib/clmm-sync.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
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
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const once = process.argv.includes("--once");
const intervalMs = Math.max(60_000, parseInt(process.env.SYNC_INTERVAL_MS ?? "900000", 10) || 900_000);
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
    console.error("Add them to .env.local — see .env.example");
    process.exit(1);
  }

  console.log("CLMM pool indexer");
  console.log(`  Subgraph → Supabase (UI reads Supabase only)`);
  console.log(`  Full metrics: ${fullMetrics ? "yes (all pools)" : "top 1500 by liquidity"}`);
  console.log(`  Mode: ${once ? "once" : `every ${Math.round(intervalMs / 60_000)} min`}`);

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
