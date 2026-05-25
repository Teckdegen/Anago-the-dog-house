/**
 * Proxies Monad Blockscout API (avoids browser CORS).
 * GET /api/blockscout?path=/addresses/0x.../tokens
 */

const BS_HOST = "https://monad.blockscout.com/api/v2";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const path = url.searchParams.get("path");
  if (!path || !path.startsWith("/")) {
    return res.status(400).json({ message: "Invalid path" });
  }

  const upstream = new URL(`${BS_HOST}${path}`);
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "path") continue;
    upstream.searchParams.set(key, value);
  }

  const apiKey = process.env.BLOCKSCOUT_API_KEY?.trim();
  const headers = { accept: "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  try {
    const bsRes = await fetch(upstream.toString(), {
      headers,
      signal: AbortSignal.timeout(25_000),
    });
    const json = await bsRes.json();
    return res.status(bsRes.ok ? 200 : bsRes.status).json(json);
  } catch (e) {
    return res.status(500).json({
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
