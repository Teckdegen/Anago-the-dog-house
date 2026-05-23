/**
 * Capricorn CL — listens for new pools on-chain, writes to clmm_pools.
 * Railway: root = bot, start = node index.js
 */

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const FACTORY = "0x6B5F564339DbAD6b780249827f2198a841FEB7F3";
const BOT_ROOT = dirname(fileURLToPath(import.meta.url));
const CURSOR_FILE = join(BOT_ROOT, ".indexer-cursor.json");

const ERC20_ABI = ["function symbol() view returns (string)"];
const POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function tickSpacing() view returns (int24)",
  "function liquidity() view returns (uint128)",
];
const FACTORY_ABI = [
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
];

const tokenCache = new Map();
const once = process.argv.includes("--once");
const intervalMs = Math.max(60_000, Number(process.env.SYNC_INTERVAL_MS ?? 300_000) || 300_000);
const scanBlocks = Number(process.env.INDEXER_SCAN_BLOCKS ?? 50_000);

function ts() {
  return new Date().toISOString();
}

function getProvider() {
  const url = process.env.RPC_URL;
  if (!url) throw new Error("RPC_URL not set");
  return new ethers.JsonRpcProvider(url);
}

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function loadCursor() {
  if (!existsSync(CURSOR_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CURSOR_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveCursor(block) {
  writeFileSync(CURSOR_FILE, JSON.stringify({ lastBlock: block, updatedAt: ts() }));
}

async function getToken(provider, address) {
  const addr = address.toLowerCase();
  if (tokenCache.has(addr)) return tokenCache.get(addr);
  const erc20 = new ethers.Contract(addr, ERC20_ABI, provider);
  const symbol = await erc20.symbol();
  const meta = { symbol };
  tokenCache.set(addr, meta);
  return meta;
}

async function fetchPoolRow(provider, poolAddress) {
  const addr = poolAddress.toLowerCase();
  const pool = new ethers.Contract(addr, POOL_ABI, provider);
  const [t0, t1, fee, tickSpacing, liquidity] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.fee(),
    pool.tickSpacing(),
    pool.liquidity(),
  ]);
  const [tok0, tok1] = await Promise.all([getToken(provider, t0), getToken(provider, t1)]);
  return {
    address: addr,
    token0: t0.toLowerCase(),
    token1: t1.toLowerCase(),
    symbol0: tok0.symbol,
    symbol1: tok1.symbol,
    fee: Number(fee),
    tick_spacing: Number(tickSpacing),
    liquidity: liquidity.toString(),
  };
}

async function discoverPools(provider, fromBlock, toBlock) {
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
  const logs = await factory.queryFilter(factory.filters.PoolCreated(), fromBlock, toBlock);
  const out = new Set();
  for (const log of logs) {
    const pool = log.args?.pool ?? log.args?.[4];
    if (pool) out.add(pool.toLowerCase());
  }
  return [...out];
}

async function listKnownAddresses(supabase) {
  const { data, error } = await supabase.from("clmm_pools").select("address");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.address.toLowerCase()));
}

async function upsertPools(supabase, rows) {
  if (!rows.length) return 0;
  const metricsAt = ts();
  const chunk = 40;
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk).map((r) => ({ ...r, metrics_at: metricsAt }));
    const { error } = await supabase.from("clmm_pools").upsert(batch, { onConflict: "address" });
    if (error) throw new Error(error.message);
    n += batch.length;
  }
  return n;
}

async function sync() {
  const provider = getProvider();
  const supabase = getSupabase();
  const latest = await provider.getBlockNumber();
  const cursor = loadCursor();
  const fromBlock = cursor?.lastBlock
    ? Math.max(0, Number(cursor.lastBlock) + 1)
    : Math.max(0, latest - scanBlocks);

  const known = await listKnownAddresses(supabase);
  const discovered =
    fromBlock <= latest ? await discoverPools(provider, fromBlock, latest) : [];
  const targets = discovered.filter((a) => !known.has(a));

  console.log(`[${ts()}] blocks ${fromBlock}→${latest} · ${targets.length} new pool(s)`);

  const rows = [];
  for (const addr of targets) {
    try {
      rows.push(await fetchPoolRow(provider, addr));
    } catch (e) {
      console.warn(`[${ts()}] skip ${addr}:`, e instanceof Error ? e.message : e);
    }
  }

  const upserted = await upsertPools(supabase, rows);
  saveCursor(latest);
  return { upserted, newPools: targets.length, block: latest };
}

async function tick() {
  try {
    const r = await sync();
    console.log(`[${ts()}] indexed ${r.upserted} pool(s), block ${r.block}`);
  } catch (e) {
    console.error(`[${ts()}]`, e instanceof Error ? e.message : e);
  }
}

const missing = [];
if (!process.env.RPC_URL) missing.push("RPC_URL");
if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (missing.length) {
  console.error("Missing:", missing.join(", "));
  process.exit(1);
}

await tick();
if (!once) {
  setInterval(tick, intervalMs);
  console.log(`[${ts()}] polling every ${Math.round(intervalMs / 60_000)} min`);
}
