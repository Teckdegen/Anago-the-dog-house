import { Link } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { TokenIcon } from "@/components/TokenIcon";
import { PoolPairLogos } from "@/components/clmm/PoolPairLogos";
import {
  formatAprPrecise,
  formatUsdTable,
  truncateAddress,
  type PoolMetrics,
} from "@/lib/capricorn/poolMetrics";
import { feeToPercent, type CachedPool, type PoolLiveState } from "@/lib/capricorn";
import { PoolChartEmbeds } from "./PoolChartEmbeds";
import { clmm } from "./clmmTheme";

function formatDailyChangeSub(pct: number | null): string | undefined {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < 0.005) return undefined;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

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
  const dailyChange = formatDailyChangeSub(m.priceChange24h);
  const volChangeSub =
    m.priceChange24h != null && Math.abs(m.priceChange24h) >= 0.005
      ? `${m.priceChange24h >= 0 ? "+" : ""}${m.priceChange24h.toFixed(2)}%`
      : undefined;

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

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <PoolPairLogos
            token0={live.pool.token0}
            token1={live.pool.token1}
            symbol0={live.token0Symbol}
            symbol1={live.token1Symbol}
            logo0={m.logo0 ?? m.pairImageUrl}
            logo1={m.logo1 ?? m.pairImageUrl}
            size={40}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-grotesk text-[24px] sm:text-[28px] font-medium" style={{ color: clmm.text }}>
                {m.symbol0} / {m.symbol1}
              </h1>
              <Badge>CLMM</Badge>
              <Badge>{feeLabel}</Badge>
            </div>
            <PoolIdCopy id={m.displayId} poolAddress={poolAddress} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <PoolChartEmbeds poolAddress={poolAddress} />

          <div className="rounded-2xl p-4 sm:p-5" style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}>
            <p className="font-mono text-[10px] uppercase mb-4" style={{ color: clmm.textDim }}>
              Stats
            </p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <StatRow
                label="TVL"
                value={formatUsdTable(m.tvlUsd)}
                sub={dailyChange}
                subNegative={m.priceChange24h != null && m.priceChange24h < 0}
              />
              <StatRow
                label="24h vol."
                value={formatUsdTable(m.volume24hUsd)}
                sub={volChangeSub}
                subNegative={m.priceChange24h != null && m.priceChange24h < 0}
              />
              <StatRow label="24h fees" value={formatUsdTable(m.fees24hUsd)} />
              {(m.buys24h != null || m.sells24h != null) && (
                <StatRow
                  label="24H trades"
                  value={`${m.buys24h ?? 0} buys · ${m.sells24h ?? 0} sells`}
                />
              )}
            </div>
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
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-6">
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

          <SidebarCard title="Pool APR%">
            <p className="font-grotesk text-[28px] font-medium tabular-nums" style={{ color: clmm.text }}>
              {formatAprPrecise(m.aprPercent)}
            </p>
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
    <span className="font-mono text-[11px] lowercase" style={{ color: clmm.textDim }}>
      {children}
    </span>
  );
}

function PoolIdCopy({ id, poolAddress }: { id: string; poolAddress: `0x${string}` }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 mt-1">
      <button
        type="button"
        className="flex items-center gap-1.5 font-mono text-[10px] hover:opacity-80"
        style={{ color: clmm.textDim }}
        onClick={() => {
          void navigator.clipboard.writeText(poolAddress);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {truncateAddress(id, 8, 6)}
        <Copy className="w-3 h-3" />
        {copied && <span style={{ color: clmm.green }}>copied</span>}
      </button>
    </div>
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
    <div className="mb-0">
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
    <a
      href={`https://monadexplorer.com/address/${address}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 w-full min-w-0 py-2 first:pt-0 rounded-lg -mx-1 px-1 transition hover:bg-[rgba(139,92,246,0.12)]"
    >
      <TokenIcon address={address} symbol={symbol} size={24} logoUrl={logo} />
      <span className="font-grotesk text-[13px] shrink-0" style={{ color: clmm.text }}>
        {symbol}
      </span>
      <span className="font-mono text-[10px] truncate min-w-0" style={{ color: clmm.textDim }}>
        {truncateAddress(address)}
      </span>
    </a>
  );
}
