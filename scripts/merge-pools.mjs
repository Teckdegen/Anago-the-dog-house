import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(ROOT, "src/lib/capricorn/pools.ts"), "utf8");
const bot = readFileSync(join(ROOT, "bot/pools.js"), "utf8");
const re = /0x[0-9a-fA-F]{40}/g;
const pools = [...new Set([...(ts.match(re) ?? []), ...(bot.match(re) ?? [])].map((a) => a.toLowerCase()))]
  .filter((a) => a !== "0x0000000000000000000000000000000000000000")
  .sort();

const lines = pools.map((a) => `  "${a}",`).join("\n");

writeFileSync(
  join(ROOT, "src/lib/capricorn/pools.ts"),
  `/** Curated Capricorn CL pools — UI list; fee/APY/TVL fetched on-chain. */

export const CAPRICORN_POOL_ADDRESSES = [
${lines}
] as const;

export function stubPoolsFromAddresses(): import("./types").CachedPool[] {
  return CAPRICORN_POOL_ADDRESSES.map((address) => ({
    address: address.toLowerCase() as \`0x\${string}\`,
    token0: "0x0000000000000000000000000000000000000000" as \`0x\${string}\`,
    token1: "0x0000000000000000000000000000000000000000" as \`0x\${string}\`,
    fee: 0,
    tickSpacing: 0,
    protocol: "v3" as const,
  }));
}
`,
);

writeFileSync(
  join(ROOT, "bot/pools.js"),
  `/** Hardcoded Capricorn CL pool addresses (Railway bot). */
export const POOL_ADDRESSES = [
${lines}
];

export const POOL_COUNT = POOL_ADDRESSES.length;
`,
);

const header = readFileSync(join(ROOT, "clmm.sql"), "utf8").split("-- 2. Seed")[0].trim();
const inserts = pools
  .map((a, i) => `  ('${a}', '', '', '', '')${i < pools.length - 1 ? "," : ""}`)
  .join("\n");
writeFileSync(
  join(ROOT, "clmm.sql"),
  `${header}

-- 2. Seed known pool addresses (${pools.length} pools)
insert into public.clmm_pools (address, token0, token1, symbol0, symbol1)
values
${inserts}
on conflict (address) do nothing;
`,
);

console.log(`Merged ${pools.length} pools`);
