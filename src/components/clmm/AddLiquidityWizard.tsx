import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { AddLiquidityPanel } from "./AddLiquidityPanel";
import { ClmmTxGate } from "@/components/clmm/SwitchToMonadMainnet";
import { TokenIcon } from "@/components/TokenIcon";
import { feeToPercent, type PoolLiveState } from "@/lib/capricorn";
import type { PoolMetrics } from "@/lib/capricorn/poolMetrics";
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
  const feeLabel = feeToPercent(live.pool.fee);

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-8">
        <h1 className="font-grotesk text-[28px] sm:text-[32px] font-medium" style={{ color: clmm.text }}>
          New position
        </h1>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        <aside>
          <div
            className="rounded-2xl p-5 space-y-0"
            style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}
          >
            <StepItem n={1} label="Select token pair and fees" done={step > 1} active={step === 1} />
            <div className="w-px h-6 ml-[13px]" style={{ background: clmm.border }} />
            <StepItem n={2} label="Set price range and deposit amounts" done={false} active={step === 2} />
          </div>
        </aside>

        <div>
          {step === 1 && (
            <div
              className="rounded-2xl p-6 sm:p-8"
              style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}
            >
              <section className="mb-8">
                <h2 className="font-grotesk text-[16px] mb-1" style={{ color: clmm.text }}>
                  Select pair
                </h2>
                <p className="font-mono text-[11px] mb-4 max-w-xl" style={{ color: clmm.textMuted }}>
                  Choose the tokens you want to provide liquidity for on Monad mainnet.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <TokenSelect label={metrics.symbol0} address={live.pool.token0} logo={metrics.logo0} />
                  <TokenSelect label={metrics.symbol1} address={live.pool.token1} logo={metrics.logo1} />
                </div>
              </section>

              <section className="mb-8">
                <h2 className="font-grotesk text-[16px] mb-1" style={{ color: clmm.text }}>
                  Fee tier
                </h2>
                <p className="font-mono text-[11px] mb-4 max-w-xl" style={{ color: clmm.textMuted }}>
                  The amount earned providing liquidity. Choose a tier that suits your strategy.
                </p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full text-left rounded-2xl px-5 py-4 flex items-center justify-between gap-4 transition hover:bg-[rgba(155,127,212,0.06)]"
                  style={{ border: `1px solid ${clmm.borderStrong}`, background: clmm.purpleBg }}
                >
                  <div>
                    <p className="font-grotesk text-[15px]" style={{ color: clmm.text }}>
                      {feeLabel} fee tier
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="font-mono text-[9px] px-2 py-0.5 rounded-md"
                        style={{ background: clmm.purpleBgHover, color: clmm.accent }}
                      >
                        V4 pool
                      </span>
                      <span className="font-mono text-[10px]" style={{ color: clmm.textDim }}>
                        The % you will earn in fees
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px]" style={{ color: clmm.textMuted }}>
                    More ▾
                  </span>
                </button>
              </section>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl font-grotesk text-[13px] uppercase tracking-wider transition hover:opacity-90"
                style={{ background: clmm.text, color: clmm.bg }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Link
                to="/clmm/pool/$poolAddress"
                params={{ poolAddress }}
                className="inline-flex items-center gap-2 font-mono text-[10px] hover:underline"
                style={{ color: clmm.textMuted }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to pool
              </Link>

              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}
              >
                <span className="font-grotesk text-[13px]" style={{ color: clmm.text }}>
                  {metrics.symbol0}/{metrics.symbol1} · {feeLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="font-mono text-[10px] px-3 py-1 rounded-full"
                  style={{ border: `1px solid ${clmm.border}`, color: clmm.accent }}
                >
                  Edit
                </button>
              </div>

              <div
                className="rounded-2xl p-6 sm:p-8"
                style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}
              >
                <h3 className="font-grotesk text-[16px] mb-4" style={{ color: clmm.text }}>
                  Set price range and deposit amounts
                </h3>
                <div className="grid sm:grid-cols-2 gap-3 font-mono text-[11px] mb-6">
                  <div className="rounded-xl p-4" style={{ background: clmm.purpleBg }}>
                    <span style={{ color: clmm.textDim }}>Min tick</span>
                    <p className="mt-1" style={{ color: clmm.text }}>
                      ~{live.tick - live.pool.tickSpacing * 80}
                    </p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: clmm.purpleBg }}>
                    <span style={{ color: clmm.textDim }}>Max tick</span>
                    <p className="mt-1" style={{ color: clmm.text }}>
                      ~{live.tick + live.pool.tickSpacing * 80}
                    </p>
                  </div>
                </div>
                <ClmmTxGate>
                  <AddLiquidityPanel live={live} />
                </ClmmTxGate>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TokenSelect({
  label,
  address,
  logo,
}: {
  label: string;
  address: `0x${string}`;
  logo: string | null;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl px-4 py-4"
      style={{ border: `1px solid ${clmm.border}`, background: clmm.bg }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <TokenIcon address={address} symbol={label} size={32} logoUrl={logo} />
        <span className="font-grotesk text-[16px]" style={{ color: clmm.text }}>
          {label}
        </span>
      </div>
      <span className="font-mono text-[10px]" style={{ color: clmm.textDim }}>
        ▾
      </span>
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
    <div className="flex gap-3 items-start py-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono text-[11px]"
        style={{
          background: done ? clmm.green : active ? clmm.text : "transparent",
          border: `1px solid ${done ? clmm.green : active ? clmm.text : clmm.border}`,
          color: done || active ? clmm.bg : clmm.textDim,
        }}
      >
        {done ? <Check className="w-4 h-4" style={{ color: clmm.bg }} /> : n}
      </div>
      <p
        className="font-mono text-[10px] leading-snug pt-1"
        style={{ color: active ? clmm.text : clmm.textDim }}
      >
        {label}
      </p>
    </div>
  );
}
