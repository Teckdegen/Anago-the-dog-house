import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { TokenIcon } from "@/components/TokenIcon";
import { formatApr, formatUsdCompact, type EnrichedPool } from "@/lib/uniswap/poolMetrics";
import { clmm } from "./clmmTheme";

export function PoolsExploreTable({
  rows,
  indexing,
  progress,
}: {
  rows: EnrichedPool[];
  indexing: boolean;
  progress: { done: number; total: number };
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}
    >
      {indexing && progress.total > 0 && (
        <div
          className="px-4 py-2 flex items-center justify-between font-mono text-[9px]"
          style={{ borderBottom: `1px solid ${clmm.border}`, color: clmm.textMuted }}
        >
          <span className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: clmm.accent }} />
            Loading stats {progress.done}/{progress.total}
          </span>
        </div>
      )}

      <div
        className="hidden sm:grid px-4 py-3 font-mono text-[9px] uppercase tracking-wider gap-4"
        style={{
          gridTemplateColumns: "minmax(220px,2fr) repeat(4,1fr) 120px",
          color: clmm.textDim,
          borderBottom: `1px solid ${clmm.border}`,
        }}
      >
        <span>Market</span>
        <span>TVL</span>
        <span>Volume (24h)</span>
        <span>Fees (24h)</span>
        <span>Pool APR</span>
        <span className="text-right">Action</span>
      </div>

      <div className="divide-y" style={{ borderColor: clmm.border }}>
        {rows.map((row) => (
          <PoolTableRow key={row.address} row={row} loading={indexing && !row.metrics.updatedAt} />
        ))}
      </div>
    </div>
  );
}

function PoolTableRow({ row, loading }: { row: EnrichedPool; loading?: boolean }) {
  const m = row.metrics;
  const pairLabel = `${m.symbol0} / ${m.symbol1}`;

  return (
    <div
      className="group relative px-4 py-4 sm:py-3.5 transition-colors hover:bg-[rgba(155,127,212,0.08)]"
      style={{ borderColor: clmm.border }}
    >
      <Link
        to="/clmm/pool/$poolAddress"
        params={{ poolAddress: row.address }}
        className="absolute inset-0 z-0"
        aria-label={`Open ${pairLabel}`}
      />
      <div
        className="relative z-[1] pointer-events-none sm:grid sm:items-center sm:gap-4"
        style={{ gridTemplateColumns: "minmax(220px,2fr) repeat(4,1fr) 120px" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <PoolPairAvatar row={row} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-grotesk text-[14px] sm:text-[15px] font-medium truncate"
                style={{ color: clmm.text }}
              >
                {pairLabel}
              </span>
              <ProtocolBadge />
            </div>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: clmm.textDim }}>
              {m.displayId} · {m.feePercent}
            </p>
          </div>
        </div>

        <div className="hidden sm:contents font-mono text-[12px]" style={{ color: clmm.text }}>
          <MetricCell value={loading && m.tvlUsd == null ? "…" : formatUsdCompact(m.tvlUsd)} />
          <MetricCell value={loading && m.volume24hUsd == null ? "…" : formatUsdCompact(m.volume24hUsd)} />
          <MetricCell value={loading && m.fees24hUsd == null ? "…" : formatUsdCompact(m.fees24hUsd)} />
          <MetricCell
            value={loading && m.aprPercent == null ? "…" : formatApr(m.aprPercent)}
            highlight={m.aprPercent != null && m.aprPercent > 1}
          />
        </div>

        <div className="sm:hidden grid grid-cols-2 gap-2 font-mono text-[11px] mt-1">
          <MiniStat label="TVL" value={formatUsdCompact(m.tvlUsd)} />
          <MiniStat label="Vol 24h" value={formatUsdCompact(m.volume24hUsd)} />
          <MiniStat label="Fees 24h" value={formatUsdCompact(m.fees24hUsd)} />
          <MiniStat label="APR" value={formatApr(m.aprPercent)} />
        </div>

        <div className="flex sm:justify-end mt-2 sm:mt-0 pointer-events-auto">
          <Link
            to="/clmm/pool/$poolAddress/add"
            params={{ poolAddress: row.address }}
            className="px-4 py-2 rounded-full font-grotesk text-[10px] uppercase tracking-wider transition shrink-0"
            style={{
              border: `1px solid ${clmm.borderStrong}`,
              color: clmm.text,
              background: "rgba(8,4,18,0.85)",
            }}
          >
            Add liquidity
          </Link>
        </div>
      </div>
    </div>
  );
}

function PoolPairAvatar({ row }: { row: EnrichedPool }) {
  const m = row.metrics;
  const size = 36;

  if (m.pairImageUrl) {
    return (
      <img
        src={m.pairImageUrl}
        alt={`${m.symbol0}/${m.symbol1}`}
        width={size}
        height={size}
        className="rounded-xl shrink-0 object-cover"
        style={{ width: size, height: size, border: `1px solid ${clmm.border}` }}
      />
    );
  }

  return (
    <div className="relative flex shrink-0" style={{ width: size + 14, height: size }}>
      <TokenIcon address={row.token0} symbol={m.symbol0} size={size} logoUrl={m.logo0} />
      <div className="absolute left-[18px] top-[10px]">
        <TokenIcon address={row.token1} symbol={m.symbol1} size={size} logoUrl={m.logo1} />
      </div>
    </div>
  );
}

function ProtocolBadge() {
  return (
    <span
      className="font-mono text-[9px] px-1.5 py-0.5 rounded uppercase shrink-0"
      style={{
        background: "rgba(127,200,255,0.12)",
        color: "#9BC8FF",
        border: "1px solid rgba(127,200,255,0.35)",
      }}
    >
      V4
    </span>
  );
}

function MetricCell({ value, highlight }: { value: string; highlight?: boolean }) {
  return <span style={{ color: highlight ? clmm.green : clmm.text }}>{value}</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] uppercase block" style={{ color: clmm.textDim }}>
        {label}
      </span>
      <span style={{ color: clmm.text }}>{value}</span>
    </div>
  );
}
