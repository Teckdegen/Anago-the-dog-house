import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { fetchTokenFromDexScreener } from "./dexscreener";

export type RemoteTokenMeta = {
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
};

const globalCache = new Map<string, RemoteTokenMeta>();

/** Dirol → DexScreener → on-chain metadata for a set of token addresses. */
export function useRemoteTokenMeta(addresses: (string | undefined | null)[]) {
  const publicClient = usePublicClient();
  const unique = useMemo(
    () => [...new Set(addresses.filter(Boolean).map((a) => a!.toLowerCase()))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addresses.join("|")],
  );

  const [map, setMap] = useState<Record<string, RemoteTokenMeta>>(() => {
    const initial: Record<string, RemoteTokenMeta> = {};
    for (const a of unique) {
      const hit = globalCache.get(a);
      if (hit) initial[a] = hit;
    }
    return initial;
  });

  useEffect(() => {
    if (!unique.length) return;

    let cancelled = false;
    const missing = unique.filter((a) => !globalCache.has(a));
    if (!missing.length) {
      const next: Record<string, RemoteTokenMeta> = {};
      for (const a of unique) {
        const hit = globalCache.get(a);
        if (hit) next[a] = hit;
      }
      setMap(next);
      return;
    }

    void Promise.all(
      missing.map(async (addr) => {
        const data = await fetchTokenFromDexScreener(addr, publicClient);
        if (!data?.symbol && !data?.logoURI) return null;
        const meta: RemoteTokenMeta = {
          symbol: data.symbol || addr.slice(0, 6),
          name: data.name || data.symbol || "",
          decimals: data.decimals ?? 18,
          logoURI: data.logoURI,
        };
        globalCache.set(addr, meta);
        return { addr, meta };
      }),
    ).then((results) => {
      if (cancelled) return;
      setMap((prev) => {
        const next = { ...prev };
        for (const a of unique) {
          const hit = globalCache.get(a);
          if (hit) next[a] = hit;
        }
        for (const r of results) {
          if (r) next[r.addr] = r.meta;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [unique, publicClient]);

  return (addr: string | undefined | null): RemoteTokenMeta | undefined => {
    if (!addr) return undefined;
    return map[addr.toLowerCase()];
  };
}
