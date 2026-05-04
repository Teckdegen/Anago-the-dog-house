import { useEffect, useState } from "react";

/**
 * Static fallback prices — used when CoinGecko is unavailable.
 * Keys are lowercased token addresses. address(0) = native MON.
 */
export const PRICE_MAP: Record<number, Record<string, number>> = {
  10143: {
    "0x0000000000000000000000000000000000000000": 0, // overwritten by live fetch
  },
};

// ── Live MON price from CoinGecko ────────────────────────────────────────
let cachedMonPrice = 0;
let lastFetch = 0;

export async function fetchMonPrice(): Promise<number> {
  const now = Date.now();
  if (now - lastFetch < 60_000 && cachedMonPrice > 0) return cachedMonPrice;
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd",
    );
    const d = await r.json();
    if (d?.monad?.usd) {
      cachedMonPrice = d.monad.usd;
      lastFetch = now;
      PRICE_MAP[10143]["0x0000000000000000000000000000000000000000"] = cachedMonPrice;
    }
  } catch {
    // silently fall back to cached / 0
  }
  return cachedMonPrice;
}

export function useMonPrice(): number {
  const [price, setPrice] = useState(cachedMonPrice);
  useEffect(() => {
    fetchMonPrice().then(setPrice);
    const id = setInterval(() => fetchMonPrice().then(setPrice), 60_000);
    return () => clearInterval(id);
  }, []);
  return price;
}

export function useTokenPriceUsd(chainId: number, token: string): number {
  const monPrice = useMonPrice();
  const lower = token.toLowerCase();
  if (lower === "0x0000000000000000000000000000000000000000") return monPrice;
  const map = PRICE_MAP[chainId] ?? {};
  return (
    map[token] ??
    map[lower] ??
    Object.entries(map).find(([k]) => k.toLowerCase() === lower)?.[1] ??
    0
  );
}

export function bigintToUsd(amount: bigint, decimals: number, priceUsd: number): number {
  if (priceUsd === 0 || amount === 0n) return 0;
  const whole = Number(amount) / 10 ** decimals;
  return whole * priceUsd;
}
