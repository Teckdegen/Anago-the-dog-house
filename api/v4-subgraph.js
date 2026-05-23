/**
 * Vercel serverless — proxies GraphQL to Uniswap V4 Monad subgraph (browser-safe).
 */

const SUBGRAPH_ID = "3kaAG19ytkGfu8xD7YAAZ3qAQ3UDJRkmKH2kHUuyGHah";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return res.status(503).json({
      errors: [{ message: "THE_GRAPH_API_KEY not configured on Vercel" }],
    });
  }

  const { query, variables } = req.body ?? {};
  if (!query || typeof query !== "string") {
    return res.status(400).json({ errors: [{ message: "Missing query" }] });
  }

  try {
    const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${SUBGRAPH_ID}`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = await upstream.json();
    return res.status(upstream.ok ? 200 : upstream.status).json(json);
  } catch (e) {
    return res.status(500).json({
      errors: [{ message: e instanceof Error ? e.message : String(e) }],
    });
  }
}
