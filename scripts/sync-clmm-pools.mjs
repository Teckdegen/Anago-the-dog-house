/**
 * Builds seedPools.generated.ts from the Uniswap V4 Monad subgraph.
 *
 * Setup:
 *   1. Copy .env.example → .env.local
 *   2. Set THE_GRAPH_API_KEY=your_key_from_https://thegraph.com/studio/apikeys/
 *   3. npm run sync:pools
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src/lib/uniswap/seedPools.generated.ts");

const SUBGRAPH_ID = "3kaAG19ytkGfu8xD7YAAZ3qAQ3UDJRkmKH2kHUuyGHah";
const POOL_MANAGER = "0x188d586ddcf52439676ca21a244753fa19f9ea8e";
const PAGE_SIZE = 1000;

function loadEnvFiles() {
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

loadEnvFiles();

const apiKey = process.env.THE_GRAPH_API_KEY;
if (!apiKey || apiKey === "your_key_here") {
  console.error(`
Missing THE_GRAPH_API_KEY.

Add to .env.local:
  THE_GRAPH_API_KEY=your_key_here

Get a key: https://thegraph.com/studio/apikeys/
Subgraph: https://gateway.thegraph.com/api/[api-key]/subgraphs/id/${SUBGRAPH_ID}
`);
  process.exit(1);
}

const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${SUBGRAPH_ID}`;

async function gql(query, variables) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`);
  }
  return json.data;
}

const POOLS_PAGE = `
  query V4PoolsPage($skip: Int!, $first: Int!) {
    poolManager(id: "${POOL_MANAGER}") { poolCount txCount totalVolumeUSD }
    pools(first: $first, skip: $skip, orderBy: liquidity, orderDirection: desc) {
      id
      feeTier
      tickSpacing
      token0 { id symbol }
      token1 { id symbol }
      totalValueLockedUSD
      volumeUSD
    }
  }
`;

function toPool(p) {
  const id = p.id.startsWith("0x") ? p.id : `0x${p.id}`;
  return {
    address: id.toLowerCase(),
    token0: p.token0.id.toLowerCase(),
    token1: p.token1.id.toLowerCase(),
    fee: Number(p.feeTier),
    tickSpacing: Number(p.tickSpacing),
    protocol: "v4",
  };
}

const all = [];
let skip = 0;
let expected = 0;

while (true) {
  console.log(`Subgraph page skip=${skip}…`);
  const data = await gql(POOLS_PAGE, { skip, first: PAGE_SIZE });
  if (!expected && data.poolManager) {
    expected = Number(data.poolManager.poolCount);
    console.log(`PoolManager reports ${expected} pools`);
  }
  const page = data.pools ?? [];
  if (page.length === 0) break;
  all.push(...page.map(toPool));
  skip += PAGE_SIZE;
  console.log(`Loaded ${all.length}${expected ? ` / ${expected}` : ""}`);
  if (page.length < PAGE_SIZE) break;
  if (expected > 0 && all.length >= expected) break;
}

if (all.length === 0) {
  console.error("Subgraph returned zero pools");
  process.exit(1);
}

const now = Date.now();
const body = `/**
 * AUTO-GENERATED — npm run sync:pools (Uniswap V4 Monad subgraph)
 * ${new Date().toISOString()} · ${all.length} pools
 * Subgraph: ${SUBGRAPH_ID}
 */

import type { CachedPool } from "./types";

export const SEED_POOLS_UPDATED_AT = ${now};
export const SEED_POOLS_LAST_INDEXED_BLOCK = "${Math.floor(now / 1000)}";

export const SEED_POOLS: readonly CachedPool[] = ${JSON.stringify(all, null, 2)} as const;
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body);
console.log(`Wrote ${OUT} (${all.length} pools)`);
