/**
 * Test Uniswap Liquidity API on Monad (mainnet 143 or testnet 10143).
 *
 * Setup:
 *   1. Copy .env.example → .env.local
 *   2. Set UNISWAP_API_KEY=your_key_from_https://dashboard.uniswap.org
 *   3. npm run test:lp-api
 *
 * Options:
 *   --testnet     use chainId 10143 (default: 143 mainnet)
 *   --wallet 0x…  wallet for approval check (default: TEST_WALLET_ADDRESS env)
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const LP_API = "https://liquidity.api.uniswap.org";

/** Known WMON / USDC V3 pool on Monad mainnet */
const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";
const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const WMON_USDC_POOL = "0x659bD0BC4167BA25c62E05656F78043E7eD4a9da";

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

function parseArgs() {
  const args = process.argv.slice(2);
  const testnet = args.includes("--testnet");
  const walletIdx = args.indexOf("--wallet");
  const wallet =
    walletIdx >= 0 ? args[walletIdx + 1] : process.env.TEST_WALLET_ADDRESS ?? "0x0000000000000000000000000000000000000001";
  const chainId = testnet ? 10143 : Number(process.env.UNISWAP_LP_CHAIN_ID ?? 143);
  return { chainId, wallet, testnet };
}

async function lpPost(path, body, apiKey) {
  const res = await fetch(`${LP_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function section(title) {
  console.log(`\n${"─".repeat(60)}\n${title}\n${"─".repeat(60)}`);
}

function printResult(label, { ok, status, json }) {
  console.log(`\n[${ok ? "OK" : "FAIL"}] ${label} (HTTP ${status})`);
  console.log(JSON.stringify(json, null, 2));
}

loadEnvFiles();

const apiKey = process.env.UNISWAP_API_KEY;
const { chainId, wallet, testnet } = parseArgs();

console.log("Uniswap Liquidity API — Monad test");
console.log(`Chain: ${chainId} (${testnet ? "testnet" : "mainnet"})`);
console.log(`API: ${LP_API}`);

if (!apiKey) {
  console.error(`
Missing UNISWAP_API_KEY.

Add to .env.local in project root:
  UNISWAP_API_KEY=your_key_here
  TEST_WALLET_ADDRESS=0xYourWallet   # optional, for approval check

Get a key: https://dashboard.uniswap.org/
`);
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function runTest(label, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`\n[ERROR] ${label}:`, e.message ?? e);
  }
}

await runTest("pool_info by V3 pool address", async () => {
  section("1. pool_info — by pool reference (WMON/USDC)");
  const result = await lpPost(
    "/lp/pool_info",
    {
      protocol: ["V3"],
      chainId,
      poolReferences: [{ poolReferenceIdentifier: WMON_USDC_POOL }],
      pageSize: 5,
      currentPage: 1,
    },
    apiKey,
  );
  printResult("pool_info (reference)", result);
  if (!result.ok) throw new Error("pool_info by reference failed");
  const pools = result.json?.pools ?? [];
  console.log(`\n→ ${pools.length} pool(s) returned`);
  for (const p of pools) {
    console.log(
      `  ${p.poolReferenceIdentifier?.slice(0, 10)}… tick=${p.currentTick} liq=${p.poolLiquidity?.slice(0, 16)}… fee=${p.fee}`,
    );
  }
});

await runTest("pool_info by token pair", async () => {
  section("2. pool_info — by token pair (WMON + USDC)");
  const result = await lpPost(
    "/lp/pool_info",
    {
      protocol: ["V3", "V4"],
      chainId,
      poolParameters: {
        token0Address: WMON,
        token1Address: USDC,
        fee: "3000",
      },
      pageSize: 20,
      currentPage: 1,
    },
    apiKey,
  );
  printResult("pool_info (pair)", result);
  if (!result.ok) throw new Error("pool_info by pair failed");
  console.log(`\n→ ${result.json?.pools?.length ?? 0} pool(s) for WMON/USDC`);
});

await runTest("check_approval CREATE", async () => {
  section("3. check_approval — CREATE (V3 WMON/USDC)");
  const result = await lpPost(
    "/lp/check_approval",
    {
      walletAddress: wallet,
      protocol: "V3",
      chainId,
      action: "CREATE",
      lpTokens: [
        { tokenAddress: WMON, amount: "1000000000000000000" },
        { tokenAddress: USDC, amount: "1000000" },
      ],
      simulateTransaction: true,
      includeGasInfo: true,
      urgency: "NORMAL",
    },
    apiKey,
  );
  printResult("check_approval", result);
  if (!result.ok) throw new Error("check_approval failed");
  const txs = result.json?.transactions ?? [];
  console.log(`\n→ ${txs.length} approval tx(s) needed`);
  for (const t of txs) {
    console.log(`  to ${t.transaction?.to?.slice(0, 12)}… gasFee=${t.gasFee ?? "n/a"}`);
  }
});

await runTest("pool_info paginated V3 list", async () => {
  section("4. pool_info — paginated V3 pools (first page)");
  const result = await lpPost(
    "/lp/pool_info",
    {
      protocol: ["V3"],
      chainId,
      poolParameters: {
        token0Address: WMON,
        token1Address: USDC,
      },
      pageSize: 50,
      currentPage: 1,
    },
    apiKey,
  );
  printResult("pool_info (paginated)", result);
  if (!result.ok) throw new Error("paginated pool_info failed");
  const pools = result.json?.pools ?? [];
  console.log(`\n→ page 1: ${pools.length} pools (pageSize=${result.json?.pageSize})`);
});

console.log(`\n${"═".repeat(60)}`);
console.log(`Done: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}\n`);

if (failed > 0) process.exit(1);
