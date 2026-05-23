import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, MoreHorizontal, Share2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { TokenIcon } from "@/components/TokenIcon";
import { formatApr, formatUsdCompact, truncateAddress, type PoolMetrics } from "@/lib/uniswap/poolMetrics";
import { feeToPercent, type CachedPool, type PoolLiveState } from "@/lib/uniswap";
import { PoolVolumeChart } from "./PoolVolumeChart";
import { PoolTransactionsTable } from "./PoolTransactionsTable";
import { SwapPanel } from "./SwapPanel";
import { ClmmTxGate } from "./SwitchToMonadMainnet";
import { clmm } from "./clmmTheme";

function formatPrice(price: number): string {
  if (price <= 0) return "—";
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(6);
  return price.toFixed(4);
}

export function PoolDetailView({
  poolAddress,
  pool,
  live,
  metrics,
}: {
  poolAddress: `0x${string}`;
  pool: CachedPool;
  live: PoolLiveState;
  metrics: PoolMetrics;
}) {
  const m = metrics;
  const feeLabel = feeToPercent(live.pool.fee);
  const volChange = m.priceChange24h != null ? m.priceChange24h : 0;

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <nav className="font-mono text-[11px] flex items-center gap-2" style={{ color: clmm.textMuted }}>
        <Link to="/clmm" className="hover:underline" style={{ color: clmm.textMuted }}>
          Pools
        </Link>
        <span style={{ color: clmm.textDim }}>›</span>
        <span style={{ color: clmm.text }}>
          {m.symbol0} / {m.symbol1}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex shrink-0">
            <TokenIcon address={live.pool.token0} symbol={live.token0Symbol} size={40} logoUrl={m.logo0} />
            <div className="absolute -right-2 top-4 rounded-full" style={{ boxShadow: `0 0 0 2px ${clmm.bg}` }}>
              <TokenIcon address={live.pool.token1} symbol={live.token1Symbol} size={40} logoUrl={m.logo1} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-grotesk text-[24px] sm:text-[28px] font-medium" style={{ color: clmm.text }}>
                {m.symbol0} / {m.symbol1}
              </h1>
              <Badge>v4</Badge>
              <Badge>{feeLabel}</Badge>
            </div>
            <PoolIdCopy id={m.displayId} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn icon={Share2} label="Share" />
          <a
            href={`https://monadexplorer.com/address/${poolAddress}`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg transition hover:bg-[rgba(155,127,212,0.1)]"
            style={{ color: clmm.textMuted }}
            aria-label="Explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <IconBtn icon={MoreHorizontal} label="More" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div>
          <PoolVolumeChart
            volume24hUsd={m.volume24hUsd}
            livePrice={live.price}
            symbol0={m.symbol0}
            symbol1={m.symbol1}
            tvlUsd={m.tvlUsd}
          />
          <PoolTransactionsTable symbol0={m.symbol0} symbol1={m.symbol1} />
        </div>

        <aside className="space-y-3 lg:sticky lg:top-6">
          <div className="rounded-2xl p-4" style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}>
            <ClmmTxGate>
              <SwapPanel pool={pool} live={live} compact />
            </ClmmTxGate>
          </div>

          <Link
            to="/clmm/pool/$poolAddress/add"
            params={{ poolAddress }}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-grotesk text-[12px] uppercase tracking-wider transition hover:opacity-90"
            style={{
              border: `1px solid ${clmm.purple}`,
              color: clmm.accent,
              background: "transparent",
            }}
          >
            + Add liquidity
          </Link>

          <SidebarCard title="Total APR">
            <p className="font-grotesk text-[28px] font-medium" style={{ color: clmm.text }}>
              {formatApr(m.aprPercent)}
            </p>
          </SidebarCard>

          <SidebarCard title="Stats">
            <StatRow label="TVL" value={formatUsdCompact(m.tvlUsd)} sub="0.00%" />
            <StatRow
              label="24H volume"
              value={formatUsdCompact(m.volume24hUsd)}
              sub={volChange !== 0 ? `${volChange >= 0 ? "+" : ""}${volChange.toFixed(1)}%` : undefined}
              subNegative={volChange < 0}
            />
            <StatRow label="24H fees" value={formatUsdCompact(m.fees24hUsd)} />
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${clmm.border}` }}>
              <p className="font-mono text-[9px] uppercase mb-2" style={{ color: clmm.textDim }}>
                Pool balances
              </p>
              <p className="font-mono text-[11px]" style={{ color: clmm.text }}>
                On-chain via StateView · tick {live.tick}
              </p>
              <p className="font-mono text-[10px] mt-1" style={{ color: clmm.textMuted }}>
                1 {live.token0Symbol} ≈ {formatPrice(live.price)} {live.token1Symbol}
              </p>
            </div>
          </SidebarCard>

          <SidebarCard title="Links">
            <TokenLinkRow symbol={m.symbol0} address={live.pool.token0} logo={m.logo0} />
            <TokenLinkRow symbol={m.symbol1} address={live.pool.token1} logo={m.logo1} />
          </SidebarCard>
        </aside>
      </div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-mono text-[10px] px-2 py-0.5 rounded-md lowercase"
      style={{ background: clmm.purpleBg, color: clmm.textMuted, border: `1px solid ${clmm.border}` }}
    >
      {children}
    </span>
  );
}

function PoolIdCopy({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 font-mono text-[10px] mt-1 hover:opacity-80"
      style={{ color: clmm.textDim }}
      onClick={() => {
        void navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {truncateAddress(id, 8, 6)}
      <Copy className="w-3 h-3" />
      {copied && <span style={{ color: clmm.green }}>copied</span>}
    </button>
  );
}

function IconBtn({ icon: Icon, label }: { icon: typeof Share2; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="p-2 rounded-lg transition hover:bg-[rgba(155,127,212,0.1)]"
      style={{ color: clmm.textMuted }}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function SidebarCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}>
      <p className="font-mono text-[10px] uppercase mb-3" style={{ color: clmm.textDim }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function StatRow({
  label,
  value,
  sub,
  subNegative,
}: {
  label: string;
  value: string;
  sub?: string;
  subNegative?: boolean;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="font-mono text-[10px] mb-1" style={{ color: clmm.textDim }}>
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className="font-grotesk text-[22px] font-medium" style={{ color: clmm.text }}>
          {value}
        </p>
        {sub && (
          <span className="font-mono text-[11px]" style={{ color: subNegative ? clmm.red : clmm.green }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function TokenLinkRow({
  symbol,
  address,
  logo,
}: {
  symbol: string;
  address: `0x${string}`;
  logo: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 first:pt-0">
      <div className="flex items-center gap-2 min-w-0">
        <TokenIcon address={address} symbol={symbol} size={24} logoUrl={logo} />
        <span className="font-grotesk text-[13px]" style={{ color: clmm.text }}>
          {symbol}
        </span>
        <span className="font-mono text-[10px] truncate" style={{ color: clmm.textDim }}>
          {truncateAddress(address)}
        </span>
      </div>
      <div className="flex gap-1 shrink-0">
        <a
          href={`https://monadexplorer.com/address/${address}`}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-md hover:bg-[rgba(155,127,212,0.12)]"
          style={{ color: clmm.textMuted }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
