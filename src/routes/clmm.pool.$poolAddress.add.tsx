import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAddress, isAddress } from "viem";
import { usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { AddLiquidityWizard } from "@/components/clmm/AddLiquidityWizard";
import { ClmmLoading, ClmmTxGate } from "@/components/clmm/SwitchToMonadMainnet";
import { clmm } from "@/components/clmm/clmmTheme";
import {
  fetchPoolLiveState,
  resolvePoolByAddress,
  fetchPoolMetrics,
  enrichFromCache,
  type CachedPool,
  type PoolLiveState,
} from "@/lib/uniswap";

export const Route = createFileRoute("/clmm/pool/$poolAddress/add")({
  component: AddLiquidityPage,
});

function AddLiquidityPage() {
  const { poolAddress: poolParam } = Route.useParams();
  const publicClient = usePublicClient();
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const metrics = pool ? enrichFromCache(pool).metrics : null;

  useEffect(() => {
    if (!publicClient || !poolAddress) return;
    let cancelled = false;
    setLoadError(null);
    resolvePoolByAddress(publicClient, poolAddress).then(async (p) => {
      if (cancelled) return;
      if (!p) {
        setLoadError("Pool not found on Monad.");
        return;
      }
      setPool(p);
      fetchPoolMetrics(p, publicClient);
      const s = await fetchPoolLiveState(publicClient, p);
      if (!cancelled) {
        if (!s) setLoadError("Could not read pool state.");
        else setLive(s);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [publicClient, poolAddress]);

  if (!poolAddress) {
    return (
      <AppShell>
        <p className="text-center pt-20 font-mono text-[11px]" style={{ color: clmm.textMuted }}>
          Invalid pool
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
            <Link to="/clmm/pool/$poolAddress" params={{ poolAddress }} className="font-grotesk text-[11px] uppercase underline" style={{ color: clmm.accent }}>
              Back to pool
            </Link>
          </div>
        ) : !pool || !live || !metrics ? (
          <ClmmLoading label="Loading pool…" />
        ) : (
          <ClmmTxGate>
            <AddLiquidityWizard poolAddress={poolAddress} live={live} metrics={metrics} />
          </ClmmTxGate>
        )}
      </div>
    </AppShell>
  );
}
