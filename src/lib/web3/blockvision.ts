/**
 * BlockVision Monad indexing — account token balances
 * @see https://docs.blockvision.org/reference/retrieve-account-tokens
 */

const BV_HOST = "https://api.blockvision.org/v2";

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
  };
};

const ZERO = "0x0000000000000000000000000000000000000000";

/** Browser: VITE_BLOCKVISION_API_KEY. Dev fallback: vite proxy `/bv` + BLOCKVISION_API_KEY in .env.local */
export function getBlockVisionApiKey(): string | undefined {
  const vite = import.meta.env.VITE_BLOCKVISION_API_KEY;
  if (typeof vite === "string" && vite.trim()) return vite.trim();
  return undefined;
}

function isNativeToken(t: BlockVisionAccountToken): boolean {
  const addr = (t.contractAddress ?? "").toLowerCase();
  if (!addr || addr === ZERO) return true;
  if (t.symbol?.toUpperCase() === "MON" && !addr.startsWith("0x")) return true;
  return false;
}

function parseBalanceRaw(balance: string, decimals: number): bigint {
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

export async function fetchBlockVisionAccountTokens(
  address: `0x${string}`,
): Promise<BlockVisionAccountToken[]> {
  const apiKey = getBlockVisionApiKey();
  const useDevProxy = import.meta.env.DEV && !apiKey;

  const path = `/monad/account/tokens?address=${encodeURIComponent(address)}`;
  const url = useDevProxy ? `/bv${path}` : `${BV_HOST}${path}`;

  const headers: HeadersInit = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(`BlockVision HTTP ${res.status}`);
  }

  const json = (await res.json()) as BlockVisionTokensResponse;
  if (json.code !== 0) {
    throw new Error(json.reason || json.message || `BlockVision error ${json.code}`);
  }

  return json.result?.data ?? [];
}

export { parseBalanceRaw, isNativeToken, ZERO as NATIVE_TOKEN_ADDRESS };
