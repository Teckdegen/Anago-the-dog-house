import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { PoolPairLogos } from "@/components/clmm/PoolPairLogos";
import {
  formatAprPrecise,
  formatUsdTable,
  type EnrichedPool,
} from "@/lib/capricorn/poolMetrics";
import { clmm } from "./clmmTheme";

export function PoolsExploreMobileList({
  rows,
  rankOffset = 0,
}: {
  rows: EnrichedPool[];
  rankOffset?: number;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <PoolCard key={row.address} row={row} rank={rankOffset + i + 1} />
      ))}
    </ul>
  );
}

function PoolCard({ row, rank }: { row: EnrichedPool; rank: number }) {
  const m = row.metrics;
  const pairLabel = `${m.symbol0}/${m.symbol1}`;
  const isStubPair =
    pairLabel === "0x0000/0x0000" ||
    m.symbol0.startsWith("0x0000") ||
    m.symbol1.startsWith("0x0000");

  return (
    <li>
      <Link
        to="/clmm/pool/$poolAddress"
        params={{ poolAddress: row.address }}
        className="flex items-center gap-3 p-4 rounded-2xl transition-colors active:opacity-90"
        style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}
      >
        <span
          className="font-mono text-[11px] w-6 shrink-0 text-center tabular-nums"
          style={{ color: clmm.textDim }}
        >
          {rank}
        </span>

        <PoolPairLogos
          token0={row.token0}
          token1={row.token1}
          symbol0={m.symbol0}
          symbol1={m.symbol1}
          logo0={m.logo0 ?? m.pairImageUrl}
          logo1={m.logo1 ?? m.pairImageUrl}
          size={36}
        />

        <div className="flex-1 min-w-0">
          <p className="font-grotesk text-[15px] font-medium truncate" style={{ color: clmm.text }}>
            {isStubPair ? m.displayId : pairLabel}
          </p>
          <p className="font-mono text-[10px] mt-0.5" style={{ color: clmm.textMuted }}>
            CLMM · {m.feePercent}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2.5">
            <Stat label="APR" value={formatAprPrecise(m.aprPercent)} />
            <Stat label="TVL" value={formatUsdTable(m.tvlUsd)} />
            <Stat label="24h vol" value={formatUsdTable(m.volume24hUsd)} />
          </div>
        </div>

        <ChevronRight className="w-4 h-4 shrink-0 opacity-40" style={{ color: clmm.text }} />
      </Link>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] uppercase tracking-wide" style={{ color: clmm.textDim }}>
        {label}
      </p>
      <p className="font-mono text-[11px] tabular-nums mt-0.5 truncate" style={{ color: clmm.text }}>
        {value}
      </p>
    </div>
  );
}
