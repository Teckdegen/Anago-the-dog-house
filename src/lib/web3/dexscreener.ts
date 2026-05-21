/**
 * DexScreener API integration for token details (logos, prices, etc.)
 * Falls back gracefully when tokens aren't listed (testnet)
 */

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type TokenData = {
  address: string;
  name: string;
  symbol: string;
  logoURI: string | null;
  priceUsd: number | null;
};

const cache = new Map<string, { data: TokenData; timestamp: number }>();

/**
 * Fetch token details from DexScreener by address
 */
export async function fetchTokenFromDexScreener(address: string): Promise<TokenData | null> {
  const key = address.toLowerCase();
  
  // Check cache
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(`${DEXSCREENER_API}/tokens/${address}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!res.ok) return null;
    
    const json = await res.json();
    const pairs = json?.pairs;
    
    if (!pairs || pairs.length === 0) return null;

    // Get the most liquid pair
    const pair = pairs[0];
    const isBase = pair.baseToken?.address?.toLowerCase() === key;
    const token = isBase ? pair.baseToken : pair.quoteToken;
    const priceUsd = isBase ? parseFloat(pair.priceUsd || "0") : (1 / parseFloat(pair.priceUsd || "1"));

    const data: TokenData = {
      address: key,
      name: token?.name || "",
      symbol: token?.symbol || "",
      logoURI: pair.info?.imageUrl || null,
      priceUsd: priceUsd > 0 ? priceUsd : null,
    };

    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/**
 * Get token logo URL — tries DexScreener first, falls back to null
 */
export async function getTokenLogo(address: string): Promise<string | null> {
  const data = await fetchTokenFromDexScreener(address);
  return data?.logoURI || null;
}

/**
 * Get token price in USD — returns null if not available
 */
export async function getTokenPriceUsd(address: string): Promise<number | null> {
  const data = await fetchTokenFromDexScreener(address);
  return data?.priceUsd || null;
}

/**
 * Batch fetch multiple token prices
 */
export async function batchGetTokenPrices(addresses: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  // DexScreener supports comma-separated addresses
  const unique = [...new Set(addresses.map(a => a.toLowerCase()))];
  
  await Promise.all(
    unique.map(async (addr) => {
      const price = await getTokenPriceUsd(addr);
      if (price !== null) prices.set(addr, price);
    })
  );

  return prices;
}
