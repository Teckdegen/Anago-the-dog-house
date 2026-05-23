import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AddLiquidityWizard } from "@/components/clmm/AddLiquidityWizard";
import { ClmmLoading, ClmmTxGate } from "@/components/clmm/SwitchToMonadMainnet";
import { clmm } from "@/components/clmm/clmmTheme";
import { usePoolAddressParam, usePoolData } from "@/hooks/usePoolData";

export const Route = createFileRoute("/clmm/pool/$poolAddress/add")({
  component: ClmmAddLiquidityPage,
});

function ClmmAddLiquidityPage() {
  const { poolAddress: poolParam } = Route.useParams();
  const poolAddress = usePoolAddressParam(poolParam);
  const { pool, live, metrics, loadError } = usePoolData(poolAddress);

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
      <div className="w-full px-5 sm:px-8 lg:px-14 pt-8 pb-20 min-h-screen" style={{ background: clmm.bg }}>
        <ClmmTxGate>
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
            <AddLiquidityWizard poolAddress={poolAddress} live={live} metrics={metrics} />
          )}
        </ClmmTxGate>
      </div>
    </AppShell>
  );
}
