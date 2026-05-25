/**
 * Monad Blockscout — token metadata + wallet token balances (no RPC).
 * @see https://docs.blockscout.com/api-reference/tokens/retrieve-detailed-information-about-a-specific-token
 */

const BS_HOST = "https://monad.blockscout.com/api/v2";

export type BlockscoutTokenMeta = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string | null;
  priceUsd: number | null;
};

type BlockscoutTokenResponse = {
  address_hash?: string;
  name?: string | null;
  symbol?: string | null;
  decimals?: string | null;
  icon_url?: string | null;
  exchange_rate?: string | null;
};

type BlockscoutAddressTokenItem = {
  token?: {
    address_hash?: string;
    name?: string | null;
    symbol?: string | null;
    decimals?: string | null;
    icon_url?: string | null;
    exchange_rate?: string | null;
  };
  value?: string | null;
};

type BlockscoutAddressTokensResponse = {
  items?: BlockscoutAddressTokenItem[];
  next_page_params?: Record<string, string | number | null> | null;
};

function resolveFetchUrl(path: string): string {
  if (import.meta.env.DEV) {
    return `/bs${path}`;
  }
  const qs = new URLSearchParams({ path });
  return `/api/blockscout?${qs.toString()}`;
}

async function fetchBlockscoutJson<T>(path: string): Promise<T> {
  const res = await fetch(resolveFetchUrl(path), {
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    throw new Error(`Blockscout HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchBlockscoutTokenMeta(
  address: `0x${string}`,
): Promise<BlockscoutTokenMeta | null> {
  try {
    const json = await fetchBlockscoutJson<BlockscoutTokenResponse>(
      `/tokens/${address.toLowerCase()}`,
    );
    const rate = json.exchange_rate ? parseFloat(json.exchange_rate) : NaN;
    const decimals = json.decimals ? parseInt(json.decimals, 10) : 18;
    return {
      address,
      name: json.name?.trim() || json.symbol?.trim() || address.slice(0, 6),
      symbol: json.symbol?.trim() || address.slice(2, 6).toUpperCase(),
      decimals: Number.isFinite(decimals) ? decimals : 18,
      logoURI: json.icon_url?.trim() || null,
      priceUsd: Number.isFinite(rate) && rate > 0 ? rate : null,
    };
  } catch {
    return null;
  }
}

export type BlockscoutWalletToken = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  balanceHuman: string;
  logoURI: string | null;
  priceUsd: number | null;
};

function parseHumanBalance(value: string | null | undefined, decimals: number): bigint {
  const s = value?.trim() ?? "";
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

export async function fetchBlockscoutAddressTokens(
  address: `0x${string}`,
): Promise<BlockscoutWalletToken[]> {
  const all: BlockscoutWalletToken[] = [];
  let nextParams: Record<string, string | number | null> | null | undefined = undefined;

  for (let page = 0; page < 30; page++) {
    const qs = new URLSearchParams();
    if (nextParams) {
      for (const [k, v] of Object.entries(nextParams)) {
        if (v != null && v !== "") qs.set(k, String(v));
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const json = await fetchBlockscoutJson<BlockscoutAddressTokensResponse>(
      `/addresses/${address.toLowerCase()}/tokens${suffix}`,
    );

    for (const item of json.items ?? []) {
      const t = item.token;
      const addr = t?.address_hash?.toLowerCase();
      if (!addr || !/^0x[a-f0-9]{40}$/.test(addr)) continue;

      const decimals = t?.decimals ? parseInt(String(t.decimals), 10) : 18;
      const balance = parseHumanBalance(item.value, decimals);
      if (balance <= 0n) continue;

      const rate = t?.exchange_rate ? parseFloat(String(t.exchange_rate)) : NaN;
      all.push({
        address: addr as `0x${string}`,
        name: t?.name?.trim() || t?.symbol?.trim() || "Token",
        symbol: t?.symbol?.trim() || addr.slice(2, 6).toUpperCase(),
        decimals: Number.isFinite(decimals) ? decimals : 18,
        balanceHuman: item.value?.trim() || "0",
        logoURI: t?.icon_url?.trim() || null,
        priceUsd: Number.isFinite(rate) && rate > 0 ? rate : null,
      });
    }

    nextParams = json.next_page_params;
    if (!nextParams || Object.keys(nextParams).length === 0) break;
  }

  return all;
}
