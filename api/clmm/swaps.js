/** Recent Swap events for a Capricorn CL pool (on-chain logs). */

import { fetchPoolSwaps } from "../../lib/pool-swaps.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const pool = (url.searchParams.get("pool") ?? "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(pool)) {
    return res.status(400).json({ error: "Invalid pool address" });
  }

  const limit = parseInt(url.searchParams.get("limit") ?? "40", 10) || 40;
  const decimals0 = url.searchParams.get("decimals0");
  const decimals1 = url.searchParams.get("decimals1");

  try {
    const result = await fetchPoolSwaps(pool, {
      limit,
      decimals0: decimals0 != null ? parseInt(decimals0, 10) : undefined,
      decimals1: decimals1 != null ? parseInt(decimals1, 10) : undefined,
      rpcUrl: process.env.RPC_URL ?? process.env.VITE_MONAD_RPC_URL,
    });
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/clmm/swaps]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
      swaps: [],
    });
  }
}
