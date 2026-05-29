/**
 * Dirol API (primary) → DexScreener (logo/price fallback) → on-chain metadata
 */

import type { PublicClient } from "viem";
import { fetchTokenFromDirol } from "./dirol";
import { fetchZerionTokenMeta, fetchZerionTokenPrices } from "./zerion";
import { fetchTokenBasicsFromChain, fetchTokenLogoFromChain } from "./tokenOnChain";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";
const CACHE_TTL = 5 * 60 * 1000;

export type TokenData = {
  address: string;
  name: string;
  symbol: string;
  decimals: number | null;
  logoURI: string | null;
  priceUsd: number | null;
};

const cache = new Map<string, { data: TokenData; timestamp: number }>();

async function fetchTokenFromDexScreenerOnly(address: string): Promise<TokenData | null> {
  const key = address.toLowerCase();

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

    const monadPair =
      pairs.find((p: { chainId?: string }) => p.chainId === "monad" || p.chainId === "monad-testnet") ??
      pairs[0];
    const pair = monadPair;
    const isBase = pair.baseToken?.address?.toLowerCase() === key;
    const token = isBase ? pair.baseToken : pair.quoteToken;
    const priceUsd = isBase ? parseFloat(pair.priceUsd || "0") : (1 / parseFloat(pair.priceUsd || "1"));

    const data: TokenData = {
      address: key,
      name: token?.name || "",
      symbol: token?.symbol || "",
      decimals: null,
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
 * Dirol first, DexScreener logo/price fallback, then on-chain + Zerion.
 */
export async function fetchTokenFromDexScreener(
  address: string,
  publicClient?: PublicClient | null,
): Promise<TokenData | null> {
  const key = address.toLowerCase();
  const [dirol, dex] = await Promise.all([
    fetchTokenFromDirol(address).catch(() => null),
    fetchTokenFromDexScreenerOnly(address),
  ]);

  const addr = key as `0x${string}`;
  const zerion = await fetchZerionTokenMeta(key).catch(() => null);

  const hasLogo = !!(dirol?.logoURI || dex?.logoURI || zerion?.logoURI);
  const hasSymbol = !!(dirol?.symbol || dex?.symbol || zerion?.symbol);

  if (hasLogo && hasSymbol && dirol?.logoURI && dirol.symbol) {
    const complete: TokenData = {
      address: key,
      name: dirol.name || dex?.name || zerion?.name || "",
      symbol: dirol.symbol,
      decimals: dirol.decimals,
      logoURI: dirol.logoURI,
      priceUsd: dex?.priceUsd ?? zerion?.priceUsd ?? null,
    };
    cache.set(key, { data: complete, timestamp: Date.now() });
    return complete;
  }

  if (!publicClient || key === "0x0000000000000000000000000000000000000000") {
    const merged: TokenData = {
      address: key,
      name: dirol?.name || dex?.name || zerion?.name || "",
      symbol: dirol?.symbol || dex?.symbol || zerion?.symbol || key.slice(0, 6),
      decimals: dirol?.decimals ?? null,
      logoURI: dirol?.logoURI ?? dex?.logoURI ?? zerion?.logoURI ?? null,
      priceUsd: dex?.priceUsd ?? zerion?.priceUsd ?? null,
    };
    if (merged.symbol || merged.logoURI) {
      cache.set(key, { data: merged, timestamp: Date.now() });
      return merged;
    }
    return dex;
  }

  const [logoURI, basics] = await Promise.all([
    dirol?.logoURI || dex?.logoURI || zerion?.logoURI
      ? Promise.resolve(dirol?.logoURI ?? dex?.logoURI ?? zerion?.logoURI ?? null)
      : fetchTokenLogoFromChain(addr, publicClient),
    dirol?.symbol && dirol?.name
      ? Promise.resolve(null)
      : !dex?.symbol || !dex?.name
        ? zerion
          ? Promise.resolve({ name: zerion.name, symbol: zerion.symbol, decimals: 18 })
          : fetchTokenBasicsFromChain(addr, publicClient)
        : Promise.resolve(null),
  ]);

  const merged: TokenData = {
    address: key,
    name: dirol?.name || dex?.name || basics?.name || zerion?.name || "",
    symbol: dirol?.symbol || dex?.symbol || basics?.symbol || zerion?.symbol || key.slice(0, 6),
    decimals: dirol?.decimals ?? basics?.decimals ?? null,
    logoURI: logoURI ?? dirol?.logoURI ?? dex?.logoURI ?? zerion?.logoURI ?? null,
    priceUsd: dex?.priceUsd ?? zerion?.priceUsd ?? null,
  };

  if (merged.symbol || merged.logoURI) {
    cache.set(key, { data: merged, timestamp: Date.now() });
    return merged;
  }

  return dex;
}

export async function getTokenLogo(
  address: string,
  publicClient?: PublicClient | null,
): Promise<string | null> {
  const data = await fetchTokenFromDexScreener(address, publicClient);
  return data?.logoURI || null;
}

export async function getTokenPriceUsd(address: string): Promise<number | null> {
  const zerion = await fetchZerionTokenMeta(address).catch(() => null);
  if (zerion?.priceUsd != null && zerion.priceUsd > 0) return zerion.priceUsd;
  const data = await fetchTokenFromDexScreenerOnly(address);
  return data?.priceUsd || null;
}

export type PairDexData = {
  pairAddress: string;
  imageUrl: string | null;
  baseSymbol: string;
  quoteSymbol: string;
};

const pairCache = new Map<string, { data: PairDexData; timestamp: number }>();

/** DexScreener pair lookup — pool/pair image for CLMM pool pages */
export async function fetchPairFromDexScreener(
  pairAddress: string,
): Promise<PairDexData | null> {
  const key = pairAddress.toLowerCase();
  const cached = pairCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  try {
    const res = await fetch(`${DEXSCREENER_API}/pairs/monad/${key}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const pair = json?.pair ?? json?.pairs?.[0];
    if (!pair) return null;

    const data: PairDexData = {
      pairAddress: key,
      imageUrl: pair.info?.imageUrl ?? null,
      baseSymbol: pair.baseToken?.symbol ?? "",
      quoteSymbol: pair.quoteToken?.symbol ?? "",
    };
    pairCache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}

export async function batchGetTokenPrices(addresses: string[]): Promise<Map<string, number>> {
  const zerionPrices = await fetchZerionTokenPrices(addresses).catch(() => new Map<string, number>());

  const prices = new Map<string, number>(zerionPrices);
  const missing = addresses
    .map((a) => a.toLowerCase())
    .filter((a) => !prices.has(a));

  await Promise.all(
    [...new Set(missing)].map(async (addr) => {
      const price = await getTokenPriceUsd(addr);
      if (price !== null) prices.set(addr, price);
    }),
  );

  return prices;
}
