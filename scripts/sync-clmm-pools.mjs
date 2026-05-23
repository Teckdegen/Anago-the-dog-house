/**
 * Builds seedPools.generated.ts from DexScreener (Uniswap V3/V4 on Monad).
 * No factory log scan — Monad RPC limits getLogs to 100 blocks.
 *
 * Usage: npm run sync:pools
 */

import { createPublicClient, http } from "viem";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src/lib/uniswap/seedPools.generated.ts");

const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";
const RPC = process.env.MONAD_RPC_URL || "https://rpc.monad.xyz";
const DEX_API = "https://api.dexscreener.com/latest/dex/tokens";

const monad = {
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const client = createPublicClient({ chain: monad, transport: http(RPC) });

const POOL_ABI = [
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ type: "uint24" }] },
  { type: "function", name: "tickSpacing", stateMutability: "view", inputs: [], outputs: [{ type: "int24" }] },
];

function uniswapProtocol(p) {
  if (p.chainId !== "monad" || p.dexId !== "uniswap" || !p.pairAddress) return null;
  if (p.labels?.includes("v4")) return "v4";
  if (p.labels?.includes("v3")) return "v3";
  return null;
}

async function fetchTokenPairs(addr) {
  const res = await fetch(`${DEX_API}/${addr}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const j = await res.json();
  return j.pairs ?? [];
}

async function discoverDex() {
  const map = new Map();
  const queue = new Set([WMON.toLowerCase()]);
  const done = new Set();

  while (queue.size > 0 && done.size < 50) {
    const t = [...queue].find((x) => !done.has(x));
    if (!t) break;
    done.add(t);
    console.log(`DexScreener token ${done.size}/50 · ${map.size} pools`);
    const pairs = await fetchTokenPairs(t);
    for (const p of pairs) {
      const protocol = uniswapProtocol(p);
      if (!protocol) continue;
      const a = p.baseToken.address;
      const b = p.quoteToken.address;
      const [t0, t1] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
      map.set(p.pairAddress.toLowerCase(), {
        address: p.pairAddress,
        token0: t0,
        token1: t1,
        fee: 3000,
        tickSpacing: protocol === "v4" ? 0 : 60,
        protocol,
      });
      queue.add(t0.toLowerCase());
      queue.add(t1.toLowerCase());
    }
  }
  return [...map.values()];
}

async function enrich(pools) {
  const out = [];
  for (const pool of pools) {
    if (pool.protocol === "v4") {
      out.push(pool);
      continue;
    }
    try {
      const [fee, tickSpacing] = await Promise.all([
        client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "fee" }),
        client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "tickSpacing" }),
      ]);
      out.push({ ...pool, fee: Number(fee), tickSpacing: Number(tickSpacing) });
    } catch {
      out.push(pool);
    }
  }
  return out;
}

const FACTORY = "0x204faca1764b154221e35c0d20abb3c525710498";
const FACTORY_START = 75_000_000n;
const LOG_CHUNK = 100n;
const POOL_CREATED = {
  type: "event",
  name: "PoolCreated",
  inputs: [
    { name: "token0", type: "address", indexed: true },
    { name: "token1", type: "address", indexed: true },
    { name: "fee", type: "uint24", indexed: true },
    { name: "tickSpacing", type: "int24", indexed: false },
    { name: "pool", type: "address", indexed: false },
  ],
};

async function scanFactory(fromBlock, toBlock) {
  const map = new Map();
  let cursor = fromBlock;
  let chunks = 0;
  while (cursor <= toBlock && chunks < 3000) {
    const end = cursor + LOG_CHUNK - 1n > toBlock ? toBlock : cursor + LOG_CHUNK - 1n;
    if (chunks % 50 === 0) console.log(`Factory blocks ${cursor}–${end} · ${map.size} pools`);
    try {
      const logs = await client.getLogs({
        address: FACTORY,
        event: POOL_CREATED,
        fromBlock: cursor,
        toBlock: end,
      });
      for (const log of logs) {
        const { token0, token1, fee, tickSpacing, pool } = log.args;
        if (!pool) continue;
        map.set(pool.toLowerCase(), {
          address: pool,
          token0,
          token1,
          fee: Number(fee),
          tickSpacing: Number(tickSpacing),
          protocol: "v3",
        });
      }
    } catch (e) {
      console.warn("Factory chunk failed", cursor, end, e.message);
      break;
    }
    cursor = end + 1n;
    chunks++;
  }
  return [...map.values()];
}

function mergeByAddress(a, b) {
  const map = new Map();
  for (const p of [...a, ...b]) map.set(p.address.toLowerCase(), p);
  return [...map.values()];
}

const latest = await client.getBlockNumber();
console.log("DexScreener discovery…");
let pools = await discoverDex();
console.log(`Factory scan from ${FACTORY_START}…`);
const factoryPools = await scanFactory(FACTORY_START, latest);
pools = mergeByAddress(pools, factoryPools);
if (pools.length === 0) {
  console.error("No Uniswap V3/V4 pools from DexScreener");
  process.exit(1);
}
console.log(`Found ${pools.length} pools — enriching on-chain…`);
pools = await enrich(pools);

const body = `/**
 * AUTO-GENERATED — npm run sync:pools (DexScreener Uniswap V3/V4 on Monad)
 * ${new Date().toISOString()} · ${pools.length} pools
 */

import type { CachedPool } from "./types";

export const SEED_POOLS_UPDATED_AT = ${Date.now()};
export const SEED_POOLS_LAST_INDEXED_BLOCK = "${latest}";

export const SEED_POOLS: readonly CachedPool[] = ${JSON.stringify(pools, null, 2)} as const;
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body);
console.log(`Wrote ${OUT} (${pools.length} pools)`);
