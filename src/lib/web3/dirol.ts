/**
 * Dirol token registry — primary source for Monad token metadata + logos.
 * @see https://api.dirol.io/api/v1/tokens?search={address}
 */

const DIROL_API = "https://api.dirol.io/api/v1/tokens";
const CACHE_TTL = 5 * 60 * 1000;

export type DirolToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
  isVerified?: boolean;
};

const cache = new Map<string, { data: DirolToken; timestamp: number }>();

export async function fetchTokenFromDirol(address: string): Promise<DirolToken | null> {
  const key = address.toLowerCase();
  if (!key || key === "0x0000000000000000000000000000000000000000") return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(`${DIROL_API}?search=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const tokens = (json?.tokens ?? []) as Array<{
      address?: string;
      symbol?: string;
      name?: string;
      decimals?: number;
      logoURI?: string;
      isVerified?: boolean;
    }>;

    if (!tokens.length) return null;

    const match =
      tokens.find((t) => t.address?.toLowerCase() === key) ?? tokens[0];

    const data: DirolToken = {
      address: key,
      symbol: match.symbol?.trim() || "",
      name: match.name?.trim() || match.symbol?.trim() || "",
      decimals: typeof match.decimals === "number" ? match.decimals : 18,
      logoURI: match.logoURI?.trim() || null,
      isVerified: match.isVerified,
    };

    if (data.symbol || data.logoURI) {
      cache.set(key, { data, timestamp: Date.now() });
    }

    return data.symbol || data.logoURI ? data : null;
  } catch {
    return null;
  }
}
