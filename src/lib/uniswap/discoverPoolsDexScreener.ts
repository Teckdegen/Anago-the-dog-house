import type { PublicClient } from "viem";
import { UNISWAP_V3 } from "./addresses";
import { POOL_ABI } from "./abis";
import type { CachedPool, PoolProtocol } from "./types";

const DEX_API = "https://api.dexscreener.com/latest/dex/tokens";

type DexPair = {
  chainId?: string;
  dexId?: string;
  labels?: string[];
  pairAddress?: string;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
};

function uniswapProtocol(p: DexPair): PoolProtocol | null {
  if (p.chainId !== "monad") return null;
  if (p.dexId !== "uniswap") return null;
  if (!p.pairAddress || !p.baseToken?.address || !p.quoteToken?.address) return null;
  if (p.labels?.includes("v4")) return "v4";
  if (p.labels?.includes("v3")) return "v3";
  return null;
}

function sortTokens(a: string, b: string): [`0x${string}`, `0x${string}`] {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al < bl ? [a as `0x${string}`, b as `0x${string}`] : [b as `0x${string}`, a as `0x${string}`];
}

async function fetchPairsForToken(token: string): Promise<DexPair[]> {
  try {
    const res = await fetch(`${DEX_API}/${token}`, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.pairs ?? []) as DexPair[];
  } catch {
    return [];
  }
}

function pairToCached(p: DexPair): CachedPool | null {
  const protocol = uniswapProtocol(p);
  if (!protocol) return null;
  const a = p.baseToken!.address!;
  const b = p.quoteToken!.address!;
  const [token0, token1] = sortTokens(a, b);
  return {
    address: p.pairAddress as `0x${string}`,
    token0,
    token1,
    fee: 3000,
    tickSpacing: protocol === "v4" ? 0 : 60,
    protocol,
  };
}

/** Discover Uniswap V3/V4 pools on Monad via DexScreener (no factory log scan). */
export async function discoverPoolsFromDexScreener(
  onProgress?: (msg: string) => void,
): Promise<CachedPool[]> {
  const map = new Map<string, CachedPool>();
  const tokenQueue = new Set<string>([UNISWAP_V3.wmon.toLowerCase()]);
  const scannedTokens = new Set<string>();
  const maxTokens = 50;

  while (tokenQueue.size > 0 && scannedTokens.size < maxTokens) {
    const token = [...tokenQueue].find((t) => !scannedTokens.has(t));
    if (!token) break;
    scannedTokens.add(token);
    onProgress?.(`DexScreener · ${scannedTokens.size}/${maxTokens} tokens · ${map.size} pools`);

    const pairs = await fetchPairsForToken(token);
    for (const p of pairs) {
      const pool = pairToCached(p);
      if (!pool) continue;
      map.set(pool.address.toLowerCase(), pool);
      tokenQueue.add(pool.token0.toLowerCase());
      tokenQueue.add(pool.token1.toLowerCase());
    }
  }

  return [...map.values()];
}

/** Fill fee + tickSpacing from pool contracts (batched). */
export async function enrichPoolsOnChain(
  client: PublicClient,
  pools: CachedPool[],
  onProgress?: (msg: string) => void,
): Promise<CachedPool[]> {
  const out: CachedPool[] = [];
  const batch = 8;
  for (let i = 0; i < pools.length; i += batch) {
    const slice = pools.slice(i, i + batch);
    onProgress?.(`On-chain enrich ${i + slice.length}/${pools.length}`);
    const enriched = await Promise.all(
      slice.map(async (pool) => {
        if (pool.protocol === "v4") return pool;
        try {
          const [fee, tickSpacing] = await Promise.all([
            client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "fee" }),
            client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "tickSpacing" }),
          ]);
          return {
            ...pool,
            fee: Number(fee),
            tickSpacing: Number(tickSpacing),
          };
        } catch {
          return pool;
        }
      }),
    );
    out.push(...enriched);
  }
  return out;
}
