import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { TokenIcon } from "@/components/TokenIcon";
import { formatApr, formatUsdCompact, truncateAddress, type PoolMetrics } from "@/lib/uniswap/poolMetrics";
import { feeToPercent, type PoolLiveState } from "@/lib/uniswap";
import { PoolPriceChart } from "./PoolPriceChart";
import { clmm } from "./clmmTheme";

function formatPrice(price: number): string {
  if (price <= 0) return "—";
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(6);
  return price.toFixed(4);
}

function secondsAgo(ts: number): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function PoolDetailView({
  poolAddress,
  live,
  metrics,
  liveUpdatedAt,
  onTrade,
  onPositions,
}: {
  poolAddress: `0x${string}`;
  live: PoolLiveState;
  metrics: PoolMetrics;
  liveUpdatedAt?: number;
  onTrade: () => void;
  onPositions: () => void;
}) {
  const m = metrics;
  const priceLabel = formatPrice(live.price);

  return (
    <div className="space-y-4">
      <Link
        to="/clmm"
        className="inline-flex items-center gap-2 font-mono text-[10px] hover:underline"
        style={{ color: clmm.textMuted }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Explore pools
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex">
            <TokenIcon address={live.pool.token0} symbol={live.token0Symbol} size={40} logoUrl={m.logo0} />
            <div className="absolute -right-2 top-3">
              <TokenIcon address={live.pool.token1} symbol={live.token1Symbol} size={40} logoUrl={m.logo1} />
            </div>
          </div>
          <div>
            <h1 className="font-grotesk text-[22px] font-medium" style={{ color: clmm.text }}>
              {m.symbol0} / {m.symbol1}
            </h1>
            <p className="font-mono text-[10px]" style={{ color: clmm.textDim }}>
              {m.displayId} · {feeToPercent(live.pool.fee)} · Uniswap V4
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onTrade} className="px-4 py-2 rounded-full font-grotesk text-[10px] uppercase" style={{ border: `1px solid ${clmm.border}`, color: clmm.text }}>
            Swap
          </button>
          <button type="button" onClick={onPositions} className="px-4 py-2 rounded-full font-grotesk text-[10px] uppercase" style={{ border: `1px solid ${clmm.border}`, color: clmm.textMuted }}>
            Positions
          </button>
          <Link to="/clmm/pool/$poolAddress/add" params={{ poolAddress }} className="px-5 py-2 rounded-full font-grotesk text-[10px] uppercase" style={{ background: clmm.purpleSolid, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }}>
            Add liquidity
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <PoolPriceChart livePrice={live.price} priceUsd={m.priceUsd} priceChange24h={m.priceChange24h} symbol0={m.symbol0} symbol1={m.symbol1} volume24hUsd={m.volume24hUsd} />
        <PoolLivePanel live={live} liveUpdatedAt={liveUpdatedAt} symbol0={m.symbol0} symbol1={m.symbol1} />
      </div>

      <StatsBar metrics={m} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <InfoCard label="Pool address" value={truncateAddress(poolAddress)} href={`https://monadexplorer.com/address/${poolAddress}`} />
        <InfoCard label="Market ID" value={m.displayId} />
        <InfoCard label={m.symbol0} value={truncateAddress(live.pool.token0)} href={`https://monadexplorer.com/address/${live.pool.token0}`} />
        <InfoCard label={m.symbol1} value={truncateAddress(live.pool.token1)} href={`https://monadexplorer.com/address/${live.pool.token1}`} />
      </div>

      <div className="rounded-xl p-5" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
        <p className="font-grotesk text-[11px] uppercase tracking-wider mb-4" style={{ color: clmm.textMuted }}>Market info</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3 font-mono text-[11px]">
          <InfoRow label="On-chain price" value={`1 ${live.token0Symbol} ≈ ${priceLabel} ${live.token1Symbol}`} />
          <InfoRow label="Current tick" value={String(live.tick)} />
          <InfoRow label="Tick spacing" value={String(live.pool.tickSpacing)} />
          <InfoRow label="Active liquidity" value={live.liquidity.toString()} />
          <InfoRow label="Fee tier" value={feeToPercent(live.pool.fee)} />
          <InfoRow label="Pool APR (est.)" value={formatApr(m.aprPercent)} />
          <InfoRow label="TVL" value={formatUsdCompact(m.tvlUsd)} />
          <InfoRow label="Volume 24h" value={formatUsdCompact(m.volume24hUsd)} />
        </div>
      </div>

      <p className="font-mono text-[9px]" style={{ color: clmm.textDim }}>
        On-chain price & tick refresh every 8s ({secondsAgo(liveUpdatedAt ?? 0)}) · TVL/volume from Uniswap V4 subgraph every 30s
      </p>
    </div>
  );
}

function PoolLivePanel({ live, liveUpdatedAt, symbol0, symbol1 }: { live: PoolLiveState; liveUpdatedAt?: number; symbol0: string; symbol1: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col min-h-[220px] font-mono text-[10px]" style={{ border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}>
      <p className="uppercase text-[9px] mb-3" style={{ color: clmm.textDim }}>Live on-chain · Monad</p>
      <div className="space-y-3 flex-1">
        <LiveRow label="Mid price" value={`${formatPrice(live.price)} ${symbol1}/${symbol0}`} />
        <LiveRow label="Current tick" value={String(live.tick)} />
        <LiveRow label="sqrtPriceX96" value={`${live.sqrtPriceX96.toString().slice(0, 22)}…`} />
        <LiveRow label="Liquidity" value={live.liquidity.toString()} />
        <LiveRow label="Last update" value={secondsAgo(liveUpdatedAt ?? 0)} />
      </div>
    </div>
  );
}

function LiveRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: clmm.textDim }}>{label}</span>
      <p className="mt-0.5 break-all" style={{ color: clmm.text }}>{value}</p>
    </div>
  );
}

function StatsBar({ metrics: m }: { metrics: PoolMetrics }) {
  const items = [
    { label: "APR (24h est.)", value: formatApr(m.aprPercent) },
    { label: "TVL", value: formatUsdCompact(m.tvlUsd) },
    { label: "Fees earned 24h", value: formatUsdCompact(m.fees24hUsd) },
    { label: "24h volume", value: formatUsdCompact(m.volume24hUsd) },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${clmm.border}` }}>
      {items.map((item, i) => (
        <div key={item.label} className="px-5 py-4" style={{ borderRight: i < items.length - 1 ? `1px solid ${clmm.border}` : undefined, background: clmm.purpleBg }}>
          <p className="font-mono text-[9px] uppercase" style={{ color: clmm.textDim }}>{item.label}</p>
          <p className="font-grotesk text-[20px] font-medium mt-1" style={{ color: clmm.text }}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function InfoCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <p className="font-mono text-[9px] uppercase" style={{ color: clmm.textDim }}>{label}</p>
      <p className="font-mono text-[11px] mt-1 truncate flex items-center gap-1" style={{ color: clmm.text }}>
        {value}
        {href && <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />}
      </p>
    </>
  );
  return (
    <div className="rounded-xl p-4" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
      {href ? <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80">{inner}</a> : inner}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: clmm.textDim }}>{label}</span>
      <p className="mt-0.5" style={{ color: clmm.text }}>{value}</p>
    </div>
  );
}
