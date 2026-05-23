import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PoolDetailView } from "@/components/clmm/PoolDetailView";
import { PositionCards } from "@/components/clmm/PositionCards";
import { ClmmLoading, ClmmTxGate } from "@/components/clmm/SwitchToMonadMainnet";
import { SwapPanel } from "@/components/clmm/SwapPanel";
import { clmm } from "@/components/clmm/clmmTheme";
import { usePoolAddressParam, usePoolData, usePoolPositions } from "@/hooks/usePoolData";

export const Route = createFileRoute("/clmm/pool/$poolAddress/")({
  component: ClmmPoolDetailPage,
});

type Panel = "overview" | "swap" | "positions";

function ClmmPoolDetailPage() {
  const { poolAddress: poolParam } = Route.useParams();
  const poolAddress = usePoolAddressParam(poolParam);
  const { pool, live, metrics, loadError, liveUpdatedAt } = usePoolData(poolAddress);
  const [panel, setPanel] = useState<Panel>("overview");
  const { positions, loading: loadingPos } = usePoolPositions(poolAddress, panel === "positions");

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
          <ClmmLoading label="Loading pool from Monad…" />
        ) : (
          <>
            <PoolDetailView
              poolAddress={poolAddress}
              live={live}
              metrics={metrics}
              liveUpdatedAt={liveUpdatedAt}
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
