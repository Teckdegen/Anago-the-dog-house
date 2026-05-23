import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getAddress, isAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PoolDetailView } from "@/components/clmm/PoolDetailView";
import { PositionCards } from "@/components/clmm/PositionCards";
import { ClmmLoading, ClmmTxGate } from "@/components/clmm/SwitchToMonadMainnet";
import { clmm } from "@/components/clmm/clmmTheme";
import {
  fetchPoolLiveState,
  resolvePoolByAddress,
  fetchUserPositions,
  positionMatchesPool,
  fetchPoolMetrics,
  enrichFromCache,
  type CachedPool,
  type PoolLiveState,
  type LpPosition,
  type PoolMetrics,
} from "@/lib/uniswap";
import { SwapPanel } from "@/components/clmm/SwapPanel";

export const Route = createFileRoute("/clmm/pool/$poolAddress")({
  component: ClmmPoolPage,
});

type Panel = "overview" | "swap" | "positions";

const LIVE_POLL_MS = 12_000;
const POSITION_POLL_MS = 25_000;

function ClmmPoolPage() {
  const { poolAddress: poolParam } = Route.useParams();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const poolAddress = (() => {
    if (!poolParam || !isAddress(poolParam)) return undefined;
    try {
      return getAddress(poolParam) as `0x${string}`;
    } catch {
      return undefined;
    }
  })();

  const [pool, setPool] = useState<CachedPool | null>(null);
  const [live, setLive] = useState<PoolLiveState | null>(null);
  const [metrics, setMetrics] = useState<PoolMetrics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("overview");
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);

  useEffect(() => {
    if (!publicClient || !poolAddress) return;
    let cancelled = false;
    setLoadError(null);
    setPool(null);
    setLive(null);

    resolvePoolByAddress(publicClient, poolAddress).then(async (p) => {
      if (cancelled) return;
      if (!p) {
        setLoadError("Pool not found on Monad — check the address or switch to mainnet (143).");
        return;
      }
      setPool(p);
      setMetrics(enrichFromCache(p).metrics);
      fetchPoolMetrics(p, publicClient).then((m) => {
        if (!cancelled) setMetrics(m);
      });
      const s = await fetchPoolLiveState(publicClient, p);
      if (!cancelled) {
        if (!s) setLoadError("Could not read pool state from chain.");
        else setLive(s);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [publicClient, poolAddress]);

  useEffect(() => {
    if (!publicClient || !pool) return;
    const tick = () =>
      fetchPoolLiveState(publicClient, pool).then((s) => s && setLive(s));
    tick();
    const id = setInterval(tick, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [publicClient, pool]);

  const loadPositions = useCallback(async () => {
    if (!publicClient || !address || !poolAddress) return;
    setLoadingPos(true);
    try {
      const all = await fetchUserPositions(publicClient, address);
      setPositions(all.filter((p) => positionMatchesPool(p, poolAddress)));
    } finally {
      setLoadingPos(false);
    }
  }, [publicClient, address, poolAddress]);

  useEffect(() => {
    if (panel !== "positions" || !address) return;
    loadPositions();
    const id = setInterval(loadPositions, POSITION_POLL_MS);
    return () => clearInterval(id);
  }, [panel, address, loadPositions]);

  if (!poolAddress) {
    return (
      <AppShell>
        <p className="text-center pt-20 font-mono text-[11px]" style={{ color: clmm.textMuted }}>
          Invalid pool address
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        {loadError ? (
          <div className="max-w-lg mx-auto rounded-xl p-10 text-center space-y-4" style={{ border: `1px solid ${clmm.border}` }}>
            <p className="font-mono text-[11px]" style={{ color: clmm.textMuted }}>{loadError}</p>
            <Link to="/clmm" className="font-grotesk text-[11px] uppercase underline" style={{ color: clmm.accent }}>
              Back to explore
            </Link>
          </div>
        ) : !pool || !live || !metrics ? (
          <ClmmLoading label="Loading pool…" />
        ) : (
          <>
            <PoolDetailView
              poolAddress={poolAddress}
              live={live}
              metrics={metrics}
              onTrade={() => setPanel("swap")}
              onPositions={() => setPanel("positions")}
            />

            {panel === "swap" && (
              <div className="mt-6 rounded-2xl p-5 max-w-xl" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
                <ClmmTxGate>
                  <SwapPanel pool={pool} live={live} onClose={() => setPanel("overview")} />
                </ClmmTxGate>
              </div>
            )}

            {panel === "positions" && (
              <div className="mt-6 rounded-2xl p-5 sm:p-8" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
                <p className="font-grotesk text-[13px] uppercase mb-4" style={{ color: clmm.text }}>
                  My positions in this pool
                </p>
                <PositionCards positions={positions} loading={loadingPos} layout="grid" />
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
