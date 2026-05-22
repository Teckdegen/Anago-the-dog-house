import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { AddLiquidityWizard } from "@/components/clmm/AddLiquidityWizard";
import { ClmmNetworkGate } from "@/components/clmm/SwitchToMonadMainnet";
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
  const poolAddress = isAddress(poolParam) ? (poolParam as `0x${string}`) : undefined;

  const [pool, setPool] = useState<CachedPool | null>(null);
  const [live, setLive] = useState<PoolLiveState | null>(null);
  const metrics = pool ? enrichFromCache(pool).metrics : null;

  useEffect(() => {
    if (!publicClient || !poolAddress) return;
    resolvePoolByAddress(publicClient, poolAddress).then(async (p) => {
      if (!p) return;
      setPool(p);
      fetchPoolMetrics(p, publicClient);
      const s = await fetchPoolLiveState(publicClient, p);
      if (s) setLive(s);
    });
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
      <ClmmNetworkGate>
      <div className="px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        {!pool || !live || !metrics ? (
          <div className="max-w-lg mx-auto rounded-xl p-10 text-center animate-pulse" style={{ border: `1px solid ${clmm.border}` }}>
            <p className="font-mono text-[11px]" style={{ color: clmm.textMuted }}>Loading pool…</p>
          </div>
        ) : (
          <AddLiquidityWizard poolAddress={poolAddress} live={live} metrics={metrics} />
        )}
      </div>
      </ClmmNetworkGate>
    </AppShell>
  );
}
