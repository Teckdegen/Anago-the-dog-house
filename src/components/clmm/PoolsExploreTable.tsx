import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
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
            Indexing pool stats {progress.done}/{progress.total}
          </span>
          <span style={{ color: clmm.accent }}>
            {progress.done === progress.total ? "Cache ready" : "First load builds cache"}
          </span>
        </div>
      )}

      <div
        className="hidden sm:grid px-4 py-3 font-mono text-[9px] uppercase tracking-wider gap-4"
        style={{
          gridTemplateColumns: "minmax(200px,2fr) repeat(4,1fr) 120px",
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
      <div className="relative z-[1] pointer-events-none sm:grid sm:items-center sm:gap-4" style={{ gridTemplateColumns: "minmax(200px,2fr) repeat(4,1fr) 120px" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex shrink-0">
            <TokenIcon address={row.token0} symbol={m.symbol0} size={32} />
            <div className="absolute -right-2 top-2">
              <TokenIcon address={row.token1} symbol={m.symbol1} size={32} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-grotesk text-[14px] sm:text-[15px] font-medium truncate" style={{ color: clmm.text }}>
                {pairLabel}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: clmm.verified }} />
            </div>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: clmm.textDim }}>
              {m.displayId} · {m.feePercent}
            </p>
          </div>
        </div>

        <div
          className="hidden sm:contents font-mono text-[12px]"
          style={{ color: clmm.text }}
        >
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

function MetricCell({ value, highlight }: { value: string; highlight?: boolean }) {
  return (
    <span style={{ color: highlight ? clmm.green : clmm.text }}>{value}</span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] uppercase block" style={{ color: clmm.textDim }}>{label}</span>
      <span style={{ color: clmm.text }}>{value}</span>
    </div>
  );
}
