import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { AddLiquidityPanel } from "./AddLiquidityPanel";
import { PoolPriceChart } from "./PoolPriceChart";
import { ClmmTxGate } from "@/components/clmm/SwitchToMonadMainnet";
import { feeToPercent, type PoolLiveState } from "@/lib/uniswap";
import type { PoolMetrics } from "@/lib/uniswap/poolMetrics";
import { clmm } from "./clmmTheme";

type Step = 1 | 2;

export function AddLiquidityWizard({
  poolAddress,
  live,
  metrics,
}: {
  poolAddress: `0x${string}`;
  live: PoolLiveState;
  metrics: PoolMetrics;
}) {
  const [step, setStep] = useState<Step>(1);
  const strategy = `Spot · ${feeToPercent(live.pool.fee)}`;

  return (
    <div className="max-w-[1200px] mx-auto">
      <Link
        to="/clmm/pool/$poolAddress"
        params={{ poolAddress }}
        className="inline-flex items-center gap-2 font-mono text-[10px] mb-6 hover:underline"
        style={{ color: clmm.textMuted }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to pool
      </Link>

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        <aside className="space-y-6">
          <StepItem n={1} label="Select strategy and fee" done={step > 1} active={step === 1} />
          <StepItem n={2} label="Set range and deposit" done={false} active={step === 2} />
          <div className="rounded-xl p-4 hidden lg:block" style={{ border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}>
            <p className="font-grotesk text-[10px] uppercase mb-2" style={{ color: clmm.textMuted }}>
              Learn more
            </p>
            <ul className="font-mono text-[9px] space-y-2" style={{ color: clmm.textDim }}>
              <li>Wide range = less active management</li>
              <li>Approvals go to Position Manager</li>
              <li>Fees accrue to your LP NFT</li>
            </ul>
          </div>
        </aside>

        <div className="space-y-5">
          {step === 1 && (
            <div className="rounded-2xl p-6" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
              <h2 className="font-grotesk text-[18px] mb-2" style={{ color: clmm.text }}>
                Select strategy
              </h2>
              <p className="font-mono text-[11px] mb-6" style={{ color: clmm.textMuted }}>
                {metrics.symbol0} / {metrics.symbol1} · {metrics.displayId}
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full text-left rounded-xl p-4 mb-3 transition"
                style={{
                  border: `2px solid ${clmm.borderStrong}`,
                  background: clmm.purpleSolid,
                }}
              >
                <p className="font-grotesk text-[14px]" style={{ color: clmm.text }}>
                  Spot — full range style
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: clmm.textMuted }}>
                  Fee tier {feeToPercent(live.pool.fee)} · wide tick band around current price
                </p>
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full rounded-full py-3 font-grotesk text-[11px] uppercase mt-4"
                style={{ background: clmm.purpleSolid, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <>
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}
              >
                <span className="font-grotesk text-[13px]" style={{ color: clmm.text }}>
                  {strategy}
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="font-mono text-[10px] px-3 py-1 rounded-full"
                  style={{ border: `1px solid ${clmm.border}`, color: clmm.accent }}
                >
                  Modify
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <PoolPriceChart
                  livePrice={live.price}
                  priceUsd={metrics.priceUsd}
                  priceChange24h={metrics.priceChange24h}
                  symbol0={metrics.symbol0}
                  symbol1={metrics.symbol1}
                  volume24hUsd={metrics.volume24hUsd}
                />
                <div className="rounded-xl p-4" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
                  <p className="font-grotesk text-[11px] uppercase mb-3" style={{ color: clmm.textMuted }}>
                    Price range (auto)
                  </p>
                  <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                    <div className="rounded-lg p-3" style={{ background: clmm.purpleBg }}>
                      <span style={{ color: clmm.textDim }}>Min tick band</span>
                      <p className="mt-1" style={{ color: clmm.text }}>
                        ~{live.tick - live.pool.tickSpacing * 80}
                      </p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: clmm.purpleBg }}>
                      <span style={{ color: clmm.textDim }}>Max tick band</span>
                      <p className="mt-1" style={{ color: clmm.text }}>
                        ~{live.tick + live.pool.tickSpacing * 80}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-[9px] mt-3" style={{ color: clmm.textDim }}>
                    Wide range mint via NPM — centered on tick {live.tick}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl p-6" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
                <h3 className="font-grotesk text-[14px] uppercase mb-4" style={{ color: clmm.text }}>
                  Deposit liquidity
                </h3>
                <ClmmTxGate>
                  <AddLiquidityPanel live={live} />
                </ClmmTxGate>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepItem({
  n,
  label,
  done,
  active,
}: {
  n: number;
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono text-[11px]"
        style={{
          background: done ? clmm.green : active ? clmm.purpleSolid : "transparent",
          border: `1px solid ${done ? clmm.green : clmm.border}`,
          color: done ? "#0a0a0a" : clmm.text,
        }}
      >
        {done ? <Check className="w-4 h-4" /> : n}
      </div>
      <p className="font-mono text-[10px] pt-1" style={{ color: active ? clmm.text : clmm.textDim }}>
        {label}
      </p>
    </div>
  );
}
