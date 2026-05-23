/**
 * Proxies BlockVision Monad API (keeps BLOCKVISION_API_KEY server-side on Vercel).
 * GET /api/blockvision?path=/monad/account/tokens&address=0x...&cursor=...&limit=50
 */

const BV_HOST = "https://api.blockvision.org/v2";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey =
    process.env.BLOCKVISION_API_KEY ||
    process.env.VITE_BLOCKVISION_API_KEY;

  if (!apiKey || apiKey === "your_blockvision_api_key") {
    return res.status(503).json({
      code: -1,
      message: "BLOCKVISION_API_KEY not configured on server",
    });
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const path = url.searchParams.get("path");
  if (!path || !path.startsWith("/monad/")) {
    return res.status(400).json({ code: -1, message: "Invalid path" });
  }

  const upstream = new URL(`${BV_HOST}${path}`);
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "path") continue;
    upstream.searchParams.set(key, value);
  }

  try {
    const bvRes = await fetch(upstream.toString(), {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(25_000),
    });
    const json = await bvRes.json();
    return res.status(bvRes.ok ? 200 : bvRes.status).json(json);
  } catch (e) {
    return res.status(500).json({
      code: -1,
      message: e instanceof Error ? e.message : String e,
    });
  }
}
