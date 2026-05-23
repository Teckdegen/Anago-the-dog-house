import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { TokenIcon } from "@/components/TokenIcon";
import { formatApr, formatUsdCompact, truncateAddress, type PoolMetrics } from "@/lib/uniswap/poolMetrics";
import { feeToPercent, type PoolLiveState } from "@/lib/uniswap";
import { PoolPriceChart } from "./PoolPriceChart";
import { clmm } from "./clmmTheme";

export function PoolDetailView({
  poolAddress,
  live,
  metrics,
  onTrade,
  onPositions,
}: {
  poolAddress: `0x${string}`;
  live: PoolLiveState;
  metrics: PoolMetrics;
  onTrade: () => void;
  onPositions: () => void;
}) {
  const m = metrics;
  const priceLabel =
    live.price < 0.0001 ? live.price.toExponential(4) : live.price.toFixed(6);

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
            <TokenIcon address={live.pool.token0} symbol={live.token0Symbol} size={40} />
            <div className="absolute -right-2 top-3">
              <TokenIcon address={live.pool.token1} symbol={live.token1Symbol} size={40} />
            </div>
          </div>
          <div>
            <h1 className="font-grotesk text-[22px] font-medium" style={{ color: clmm.text }}>
              {m.symbol0} / {m.symbol1}
            </h1>
            <p className="font-mono text-[10px]" style={{ color: clmm.textDim }}>
              {m.displayId} · {feeToPercent(live.pool.fee)} · Uniswap {(live.pool.protocol ?? "v3").toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onTrade}
            className="px-4 py-2 rounded-full font-grotesk text-[10px] uppercase"
            style={{ border: `1px solid ${clmm.border}`, color: clmm.text }}
          >
            Swap
          </button>
          <button
            type="button"
            onClick={onPositions}
            className="px-4 py-2 rounded-full font-grotesk text-[10px] uppercase"
            style={{ border: `1px solid ${clmm.border}`, color: clmm.textMuted }}
          >
            Positions
          </button>
          <Link
            to="/clmm/pool/$poolAddress/add"
            params={{ poolAddress }}
            className="px-5 py-2 rounded-full font-grotesk text-[10px] uppercase"
            style={{ background: clmm.purpleSolid, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }}
          >
            Add liquidity
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <PoolPriceChart
          priceUsd={m.priceUsd}
          priceChange24h={m.priceChange24h}
          symbol0={m.symbol0}
          symbol1={m.symbol1}
        />
        <OrderBookPanel price={priceLabel} symbol0={m.symbol0} symbol1={m.symbol1} positive={(m.priceChange24h ?? 0) >= 0} />
      </div>

      <StatsBar metrics={m} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <InfoCard label="Pool address" value={truncateAddress(poolAddress)} href={`https://monadexplorer.com/address/${poolAddress}`} />
        <InfoCard label="Market ID" value={m.displayId} />
        <InfoCard label={m.symbol0} value={truncateAddress(live.pool.token0)} href={`https://monadexplorer.com/address/${live.pool.token0}`} />
        <InfoCard label={m.symbol1} value={truncateAddress(live.pool.token1)} href={`https://monadexplorer.com/address/${live.pool.token1}`} />
      </div>

      <div className="rounded-xl p-5" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
        <p className="font-grotesk text-[11px] uppercase tracking-wider mb-4" style={{ color: clmm.textMuted }}>
          Market info
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3 font-mono text-[11px]">
          <InfoRow label="On-chain price" value={`1 ${live.token0Symbol} ≈ ${priceLabel} ${live.token1Symbol}`} />
          <InfoRow label="Current tick" value={String(live.tick)} />
          <InfoRow label="Tick spacing" value={String(live.pool.tickSpacing)} />
          <InfoRow label="Pool liquidity" value={live.liquidity.toString().slice(0, 18) + "…"} />
          <InfoRow label="Fee tier" value={feeToPercent(live.pool.fee)} />
          <InfoRow label="Pool APR (est.)" value={formatApr(m.aprPercent)} />
          <InfoRow label="TVL (DexScreener)" value={formatUsdCompact(m.tvlUsd)} />
          <InfoRow label="Volume 24h" value={formatUsdCompact(m.volume24hUsd)} />
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 font-mono text-[10px]" style={{ color: clmm.textDim, border: `1px solid ${clmm.border}` }}>
        On-chain live tick & price refresh every 12s · Stats cached locally for instant reload
      </div>
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
    <div
      className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${clmm.border}` }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className="px-5 py-4"
          style={{
            borderRight: i < items.length - 1 ? `1px solid ${clmm.border}` : undefined,
            background: clmm.purpleBg,
          }}
        >
          <p className="font-mono text-[9px] uppercase" style={{ color: clmm.textDim }}>{item.label}</p>
          <p className="font-grotesk text-[20px] font-medium mt-1" style={{ color: clmm.text }}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function OrderBookPanel({
  price,
  symbol0,
  symbol1,
  positive,
}: {
  price: string;
  symbol0: string;
  symbol1: string;
  positive: boolean;
}) {
  const asks = [0.12, 0.08, 0.05, 0.03, 0.02].map((o, i) => ({
    p: (parseFloat(price) * (1 + o * 0.01)).toFixed(5),
    s: `${(1000 + i * 420).toLocaleString()}`,
  }));
  const bids = [0.02, 0.03, 0.05, 0.08, 0.12].map((o, i) => ({
    p: (parseFloat(price) * (1 - o * 0.01)).toFixed(5),
    s: `${(800 + i * 380).toLocaleString()}`,
  }));

  return (
    <div className="rounded-xl p-3 flex flex-col min-h-[220px] font-mono text-[10px]" style={{ border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}>
      <p className="uppercase text-[9px] mb-2" style={{ color: clmm.textDim }}>
        Order book · {symbol1}
      </p>
      <div className="flex-1 space-y-0.5 overflow-hidden">
        {asks.map((r) => (
          <div key={`a-${r.p}`} className="flex justify-between" style={{ color: clmm.red }}>
            <span>{r.p}</span>
            <span style={{ color: clmm.textMuted }}>{r.s}</span>
          </div>
        ))}
        <div className="py-2 text-center text-[9px]" style={{ color: clmm.textDim, borderTop: `1px solid ${clmm.border}`, borderBottom: `1px solid ${clmm.border}` }}>
          Mid · {price} {symbol1}/{symbol0}
        </div>
        {bids.map((r) => (
          <div key={`b-${r.p}`} className="flex justify-between" style={{ color: clmm.green }}>
            <span>{r.p}</span>
            <span style={{ color: clmm.textMuted }}>{r.s}</span>
          </div>
        ))}
      </div>
      <p className="text-[8px] mt-2 text-center" style={{ color: clmm.textDim }}>
        Illustrative book · {positive ? "▲" : "▼"} 24h
      </p>
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
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80">
          {inner}
        </a>
      ) : (
        inner
      )}
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
