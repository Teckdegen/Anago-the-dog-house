/**
 * Proxies Zerion API (Basic auth with ZERION_API_KEY).
 * GET /api/zerion?path=/v1/fungibles/by-implementation&implementation=monad:0x...
 */

const ZERION_HOST = "https://api.zerion.io";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ZERION_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      errors: [{ title: "ZERION_API_KEY not configured on server" }],
    });
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const path = url.searchParams.get("path");
  if (!path || !path.startsWith("/v1/")) {
    return res.status(400).json({ errors: [{ title: "Invalid path" }] });
  }

  const upstream = new URL(`${ZERION_HOST}${path}`);
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "path") continue;
    upstream.searchParams.set(key, value);
  }

  try {
    const auth = Buffer.from(`${apiKey}:`).toString("base64");
    const zRes = await fetch(upstream.toString(), {
      headers: {
        accept: "application/json",
        authorization: `Basic ${auth}`,
      },
      signal: AbortSignal.timeout(25_000),
    });
    const json = await zRes.json();
    return res.status(zRes.ok ? 200 : zRes.status).json(json);
  } catch (e) {
    return res.status(500).json({
      errors: [{ title: e instanceof Error ? e.message : String(e) }],
    });
  }
}
