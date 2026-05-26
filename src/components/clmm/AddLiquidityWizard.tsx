import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AddLiquidityPanel } from "./AddLiquidityPanel";
import { ClmmTxGate } from "@/components/clmm/SwitchToMonadMainnet";
import { PoolPairLogos } from "@/components/clmm/PoolPairLogos";
import {
  feeToPercent,
  tickRangeForPreset,
  type PoolLiveState,
  type RangePreset,
} from "@/lib/capricorn";
import type { PoolMetrics } from "@/lib/capricorn/poolMetrics";
import { clmm } from "./clmmTheme";

export function AddLiquidityWizard({
  poolAddress,
  live,
  metrics,
}: {
  poolAddress: `0x${string}`;
  live: PoolLiveState;
  metrics: PoolMetrics;
}) {
  const feeLabel = feeToPercent(live.pool.fee);
  const [rangePreset, setRangePreset] = useState<RangePreset>("10");

  const { tickLower, tickUpper } = useMemo(
    () =>
      tickRangeForPreset(live.tick, live.pool.tickSpacing, rangePreset, {
        sqrtPriceX96: live.sqrtPriceX96,
        decimals0: live.token0Decimals,
        decimals1: live.token1Decimals,
      }),
    [
      live.tick,
      live.sqrtPriceX96,
      live.token0Decimals,
      live.token1Decimals,
      live.pool.tickSpacing,
      rangePreset,
    ],
  );

  return (
    <div className="max-w-[520px] mx-auto">
      <Link
        to="/clmm/pool/$poolAddress"
        params={{ poolAddress }}
        className="inline-flex items-center gap-2 font-mono text-[10px] hover:underline mb-6"
        style={{ color: clmm.textMuted }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to pool
      </Link>

      <h1 className="font-grotesk text-[26px] sm:text-[30px] font-medium mb-6" style={{ color: clmm.text }}>
        Create Position
      </h1>

      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-6"
        style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}
      >
        <PoolPairLogos
          token0={live.pool.token0}
          token1={live.pool.token1}
          symbol0={metrics.symbol0}
          symbol1={metrics.symbol1}
          logo0={metrics.logo0 ?? metrics.pairImageUrl}
          logo1={metrics.logo1 ?? metrics.pairImageUrl}
          size={36}
        />
        <div className="min-w-0">
          <p className="font-grotesk text-[16px]" style={{ color: clmm.text }}>
            {metrics.symbol0} / {metrics.symbol1}
          </p>
          <p className="font-mono text-[10px]" style={{ color: clmm.textDim }}>
            {feeLabel} fee · Capricorn CL
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 sm:p-6"
        style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}
      >
        <ClmmTxGate>
          <AddLiquidityPanel
            live={live}
            tickLower={tickLower}
            tickUpper={tickUpper}
            rangePreset={rangePreset}
            onRangePresetChange={setRangePreset}
            logo0={metrics.logo0 ?? metrics.pairImageUrl}
            logo1={metrics.logo1 ?? metrics.pairImageUrl}
            token0Usd={metrics.priceUsd}
          />
        </ClmmTxGate>
      </div>
    </div>
  );
}
