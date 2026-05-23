import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PoolDetailView } from "@/components/clmm/PoolDetailView";
import { ClmmLoading } from "@/components/clmm/SwitchToMonadMainnet";
import { clmm } from "@/components/clmm/clmmTheme";
import { usePoolAddressParam, usePoolData } from "@/hooks/usePoolData";

export const Route = createFileRoute("/clmm/pool/$poolAddress/")({
  component: ClmmPoolDetailPage,
});

function ClmmPoolDetailPage() {
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
      <div className="w-full px-5 sm:px-8 lg:px-14 pt-8 pb-20" style={{ background: clmm.bg }}>
        {loadError ? (
          <div
            className="max-w-lg mx-auto rounded-xl p-10 text-center space-y-4"
            style={{ border: `1px solid ${clmm.border}` }}
          >
            <p className="font-mono text-[11px]" style={{ color: clmm.textMuted }}>
              {loadError}
            </p>
            <Link to="/clmm" className="font-grotesk text-[11px] uppercase underline" style={{ color: clmm.accent }}>
              Back to explore
            </Link>
          </div>
        ) : !pool || !live || !metrics ? (
          <ClmmLoading label="Loading pool from Monad…" />
        ) : (
          <PoolDetailView poolAddress={poolAddress} pool={pool} live={live} metrics={metrics} />
        )}
      </div>
    </AppShell>
  );
}
