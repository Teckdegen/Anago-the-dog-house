import { useCallback, useEffect, useState } from "react";
import { getAddress } from "viem";
import { isPoolRef } from "@/lib/capricorn/addresses";
import { useAccount } from "wagmi";
import {
  fetchPoolLiveState,
  resolvePoolByAddress,
  fetchUserPositions,
  positionMatchesPool,
  fetchPoolMetrics,
  enrichFromCache,
  getMonadPublicClient,
  type CachedPool,
  type PoolLiveState,
  type LpPosition,
  type PoolMetrics,
} from "@/lib/capricorn";

const LIVE_POLL_MS = 8_000;
const METRICS_POLL_MS = 30_000;

export function usePoolAddressParam(poolParam: string | undefined): `0x${string}` | undefined {
  if (!poolParam) return undefined;
  const raw = poolParam.startsWith("0x") ? poolParam : `0x${poolParam}`;
  if (!isPoolRef(raw)) return undefined;
  try {
    return getAddress(raw) as `0x${string}`;
  } catch {
    return undefined;
  }
}

export function usePoolData(poolAddress: `0x${string}` | undefined) {
  const monadClient = getMonadPublicClient();
  const [pool, setPool] = useState<CachedPool | null>(null);
  const [live, setLive] = useState<PoolLiveState | null>(null);
  const [metrics, setMetrics] = useState<PoolMetrics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number>(0);

  useEffect(() => {
    if (!poolAddress) return;
    let cancelled = false;
    setLoadError(null);
    setPool(null);
    setLive(null);

    resolvePoolByAddress(monadClient, poolAddress).then(async (p) => {
      if (cancelled) return;
      if (!p) {
        setLoadError("Pool not found on Monad mainnet.");
        return;
      }
      setPool(p);
      setMetrics(enrichFromCache(p).metrics);
      fetchPoolMetrics(p, monadClient, true).then((m) => {
        if (!cancelled) setMetrics(m);
      });
      const s = await fetchPoolLiveState(monadClient, p);
      if (!cancelled) {
        if (!s) setLoadError("Could not read pool state from chain.");
        else {
          setLive(s);
          setLiveUpdatedAt(Date.now());
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [poolAddress, monadClient]);

  useEffect(() => {
    if (!pool) return;
    const refreshLive = () =>
      fetchPoolLiveState(monadClient, pool).then((s) => {
        if (s) {
          setLive(s);
          setLiveUpdatedAt(Date.now());
        }
      });
    const liveId = setInterval(refreshLive, LIVE_POLL_MS);

    const refreshMetrics = () =>
      fetchPoolMetrics(pool, monadClient, true).then((m) => setMetrics(m));
    const metricsId = setInterval(refreshMetrics, METRICS_POLL_MS);

    return () => {
      clearInterval(liveId);
      clearInterval(metricsId);
    };
  }, [pool, monadClient]);

  return { pool, live, metrics, loadError, liveUpdatedAt, monadClient };
}

export function usePoolPositions(poolAddress: `0x${string}` | undefined, enabled: boolean) {
  const { address } = useAccount();
  const monadClient = getMonadPublicClient();
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [pool, setPool] = useState<CachedPool | null>(null);

  useEffect(() => {
    if (!poolAddress) return;
    resolvePoolByAddress(monadClient, poolAddress).then(setPool);
  }, [poolAddress, monadClient]);

  const load = useCallback(async () => {
    if (!address || !poolAddress) return;
    setLoading(true);
    try {
      const all = await fetchUserPositions(monadClient, address);
      setPositions(all.filter((p) => positionMatchesPool(p, poolAddress, pool)));
    } finally {
      setLoading(false);
    }
  }, [monadClient, address, poolAddress, pool]);

  useEffect(() => {
    if (!enabled || !address) return;
    load();
    const id = setInterval(load, 25_000);
    return () => clearInterval(id);
  }, [enabled, address, load]);

  return { positions, loading, load };
}
