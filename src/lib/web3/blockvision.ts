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

async function fetchBlockVisionPage(
  address: `0x${string}`,
  cursor?: string,
): Promise<BlockVisionTokensResponse> {
  const path = buildAccountTokensPath(address, cursor);
  const { url, headers } = resolveFetchUrl(path);

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    throw new Error(`BlockVision HTTP ${res.status}`);
  }

  return (await res.json()) as BlockVisionTokensResponse;
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

    const next = json.result?.nextPageCursor?.trim();
    if (!next || batch.length === 0) break;
    cursor = next;
  }

  return all;
}

export { isNativeToken, ZERO as NATIVE_TOKEN_ADDRESS };
