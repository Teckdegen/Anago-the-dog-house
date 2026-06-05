import { useEffect, useState } from "react";
import { fetchDexTokenProfile, type DexTokenProfile } from "./dexscreenerProfile";

const globalCache = new Map<string, DexTokenProfile | null>();

/** DexScreener bio + socials for a token (no price). */
export function useDexTokenProfile(address: string | undefined | null) {
  const key = address?.toLowerCase() ?? "";
  const [profile, setProfile] = useState<DexTokenProfile | null>(() =>
    key ? (globalCache.get(key) ?? null) : null,
  );
  const [loading, setLoading] = useState(() => !!key && !globalCache.has(key));

  useEffect(() => {
    if (!key) {
      setProfile(null);
      setLoading(false);
      return;
    }

    if (globalCache.has(key)) {
      setProfile(globalCache.get(key) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchDexTokenProfile(key).then((data) => {
      if (cancelled) return;
      globalCache.set(key, data);
      setProfile(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { profile, loading };
}
