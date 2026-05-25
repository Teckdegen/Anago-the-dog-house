/**
 * BlockVision Monad indexing — account token balances
 * @see https://docs.blockvision.org/reference/monad-indexing-api
 */

const BV_HOST = "https://api.blockvision.org/v2";
const PAGE_LIMIT = 50;

export type BlockVisionAccountToken = {
  contractAddress: string;
  name: string;
  imageURL?: string;
  symbol: string;
  price?: string;
  decimal: number;
  balance: string;
  verified?: boolean;
};

type BlockVisionTokensResponse = {
  code: number;
  reason?: string;
  message?: string;
  result?: {
    data?: BlockVisionAccountToken[];
    total?: number;
    usdValue?: number;
    nextPageCursor?: string;
  };
};

const ZERO = "0x0000000000000000000000000000000000000000";
const PLACEHOLDER_KEYS = new Set(["your_blockvision_api_key", "your_key_here", ""]);

/** Client-side key (optional). Prefer server proxy in production. */
export function getBlockVisionApiKey(): string | undefined {
  const vite = import.meta.env.VITE_BLOCKVISION_API_KEY;
  if (typeof vite === "string" && vite.trim() && !PLACEHOLDER_KEYS.has(vite.trim())) {
    return vite.trim();
  }
  return undefined;
}

export function isBlockVisionAvailable(): boolean {
  if (import.meta.env.DEV) return true;
  return !!getBlockVisionApiKey() || true;
}

function buildAccountTokensPath(address: string, cursor?: string): string {
  const qs = new URLSearchParams({ address, limit: String(PAGE_LIMIT) });
  if (cursor) qs.set("cursor", cursor);
  return `/monad/account/tokens?${qs.toString()}`;
}

export type BlockVisionTrade = {
  txHash: string;
  sender: string;
  type: string;
  dex: string;
  timestamp: number;
  poolAddress: string;
  price: string;
  token0Info: {
    token: string;
    amount: string;
    amountUSD: string;
    decimal: number;
    name: string;
    symbol: string;
    image?: string;
    verified?: boolean;
  };
  token1Info: {
    token: string;
    amount: string;
    amountUSD: string;
    decimal: number;
    name: string;
    symbol: string;
    image?: string;
    verified?: boolean;
  };
};

type BlockVisionTradesResponse = {
  code: number;
  reason?: string;
  message?: string;
  result?: {
    data?: BlockVisionTrade[];
    nextPageCursor?: string | number;
  };
};

function buildTokenTradesPath(
  contractAddress: string,
  opts?: { cursor?: string; limit?: number; poolAddress?: string },
): string {
  const qs = new URLSearchParams({
    contractAddress,
    type: "buy,sell",
    limit: String(Math.min(50, opts?.limit ?? 50)),
  });
  if (opts?.cursor) qs.set("cursor", opts.cursor);
  return `/monad/token/trades?${qs.toString()}`;
}

/** Dev: vite `/bv` proxy. Prod: `/api/blockvision` serverless proxy. */
function resolveFetchUrl(path: string): { url: string; headers: HeadersInit } {
  const apiKey = getBlockVisionApiKey();
  const headers: HeadersInit = {};

  if (import.meta.env.DEV) {
    return { url: `/bv${path}`, headers: apiKey ? { "x-api-key": apiKey } : headers };
  }

  const pathUrl = new URL(path, "http://local");
  const proxyQs = new URLSearchParams({ path: pathUrl.pathname });
  for (const [k, v] of pathUrl.searchParams.entries()) {
    proxyQs.set(k, v);
  }

  return { url: `/api/blockvision?${proxyQs.toString()}`, headers };
}

function isNativeToken(t: BlockVisionAccountToken): boolean {
  const addr = (t.contractAddress ?? "").toLowerCase();
  if (!addr || addr === ZERO) return true;
  if (t.symbol?.toUpperCase() === "MON" && !addr.startsWith("0x")) return true;
  return false;
}

export function parseBalanceRaw(balance: string, decimals: number): bigint {
  const s = balance?.trim() ?? "";
  if (!s || s === "0") return 0n;

  if (s.includes(".")) {
    const [whole, frac = ""] = s.split(".");
    const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
    try {
      return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
    } catch {
      return 0n;
    }
  }

  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

export function blockVisionTokenToAddress(t: BlockVisionAccountToken): `0x${string}` {
  if (isNativeToken(t)) return ZERO as `0x${string}`;
  const addr = t.contractAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return ZERO as `0x${string}`;
  return addr as `0x${string}`;
}

async function fetchBlockVisionJson<T>(path: string): Promise<T> {
  const { url, headers } = resolveFetchUrl(path);
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    throw new Error(`BlockVision HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function fetchBlockVisionPage(
  address: `0x${string}`,
  cursor?: string,
): Promise<BlockVisionTokensResponse> {
  return fetchBlockVisionJson<BlockVisionTokensResponse>(buildAccountTokensPath(address, cursor));
}

export async function fetchBlockVisionAccountTokens(
  address: `0x${string}`,
): Promise<BlockVisionAccountToken[]> {
  const all: BlockVisionAccountToken[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 40; page++) {
    const json = await fetchBlockVisionPage(address, cursor);
    if (json.code !== 0) {
      throw new Error(json.reason || json.message || `BlockVision error ${json.code}`);
    }

    const batch = json.result?.data ?? [];
    all.push(...batch);

    const nextRaw = json.result?.nextPageCursor;
    const next =
      nextRaw == null || nextRaw === "" ? "" : String(nextRaw).trim();
    if (!next || batch.length === 0) break;
    cursor = next;
  }

  return all;
}

/** Paginated DEX trades for a token contract; filter client-side by pool address. */
export async function fetchBlockVisionTokenTrades(
  contractAddress: `0x${string}`,
  options?: { poolAddress?: `0x${string}`; limit?: number },
): Promise<BlockVisionTrade[]> {
  const pool = options?.poolAddress?.toLowerCase();
  const max = options?.limit ?? 50;
  const all: BlockVisionTrade[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 8 && all.length < max; page++) {
    const path = buildTokenTradesPath(contractAddress, { cursor, limit: 50 });
    const json = await fetchBlockVisionJson<BlockVisionTradesResponse>(path);
    if (json.code !== 0) {
      throw new Error(json.reason || json.message || `BlockVision error ${json.code}`);
    }

    const batch =
      json.result?.data ??
      (json as { data?: BlockVisionTrade[] }).data ??
      [];
    for (const t of batch) {
      if (pool && t.poolAddress?.toLowerCase() !== pool) continue;
      all.push(t);
      if (all.length >= max) break;
    }

    const nextRaw =
      json.result?.nextPageCursor ?? (json as { nextPageCursor?: string | number }).nextPageCursor;
    const next =
      nextRaw == null || nextRaw === "" ? "" : String(nextRaw).trim();
    if (!next || batch.length === 0) break;
    cursor = next;
  }

  return all;
}

/** Trades for a CLMM pool (queries both pool tokens, dedupes by tx hash). */
export async function fetchBlockVisionPoolTrades(
  poolAddress: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  limit = 40,
): Promise<BlockVisionTrade[]> {
  const [a, b] = await Promise.all([
    fetchBlockVisionTokenTrades(token0, { poolAddress, limit }).catch(() => [] as BlockVisionTrade[]),
    fetchBlockVisionTokenTrades(token1, { poolAddress, limit }).catch(() => [] as BlockVisionTrade[]),
  ]);

  const seen = new Set<string>();
  const merged: BlockVisionTrade[] = [];
  for (const t of [...a, ...b].sort((x, y) => y.timestamp - x.timestamp)) {
    const key = t.txHash?.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(t);
    if (merged.length >= limit) break;
  }
  return merged;
}

export { isNativeToken, ZERO as NATIVE_TOKEN_ADDRESS };
