import { Link } from "@tanstack/react-router";
import { ChevronDown, Info } from "lucide-react";
import { PoolPairLogos } from "@/components/clmm/PoolPairLogos";
import {
  formatAprPrecise,
  formatUsdTable,
  type EnrichedPool,
} from "@/lib/capricorn/poolMetrics";
import { clmm } from "./clmmTheme";

type SortKey = "tvl" | "apr" | "vol";

export function PoolsExploreTable({
  rows,
  sortKey,
  sortDesc,
  onSort,
  rankOffset = 0,
}: {
  rows: EnrichedPool[];
  sortKey: SortKey;
  sortDesc: boolean;
  onSort: (key: SortKey) => void;
  rankOffset?: number;
}) {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr
              className="font-mono text-[11px] uppercase tracking-wide"
              style={{ color: clmm.textDim, borderBottom: `1px solid ${clmm.rowBorder}` }}
            >
              <th className="text-left py-4 pl-5 pr-3 font-normal w-12">#</th>
              <th className="text-left py-4 pr-4 font-normal min-w-[220px]">Pool</th>
              <th className="text-center py-4 px-3 font-normal w-[88px]">Type</th>
              <th className="text-center py-4 px-3 font-normal w-[88px]">Fee tier</th>
              <th className="text-center py-4 px-3 font-normal min-w-[120px]">
                <span className="inline-flex items-center justify-center gap-1">
                  Pool APR%
                  <Info
                    className="w-3 h-3 opacity-50"
                    aria-label="Estimated from 24h volume, fee tier, and TVL"
                  />
                </span>
              </th>
              <SortHeader
                label="TVL"
                active={sortKey === "tvl"}
                desc={sortDesc}
                onClick={() => onSort("tvl")}
                align="right"
              />
              <SortHeader
                label="24h vol."
                active={sortKey === "vol"}
                desc={sortDesc}
                onClick={() => onSort("vol")}
                align="right"
              />
              <th className="text-right py-4 pr-5 pl-3 font-normal">24h fees</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <PoolRow key={row.address} row={row} rank={rankOffset + i + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  desc,
  onClick,
  align = "right",
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`py-4 px-3 font-normal ${align === "right" ? "text-right pr-5" : "text-left"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:opacity-90 transition uppercase"
        style={{ color: active ? clmm.text : clmm.textDim }}
      >
        {label}
        {active && (
          <ChevronDown
            className="w-3 h-3 shrink-0"
            style={{ transform: desc ? undefined : "rotate(180deg)" }}
          />
        )}
      </button>
    </th>
  );
}

function PoolRow({ row, rank }: { row: EnrichedPool; rank: number }) {
  const m = row.metrics;
  const pairLabel = `${m.symbol0}/${m.symbol1}`;

  return (
    <tr
      className="group transition-colors"
      style={{ borderTop: `1px solid ${clmm.rowBorder}` }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = clmm.purpleBgHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <td className="py-5 pl-5 pr-3 font-mono text-[13px]" style={{ color: clmm.textDim }}>
        {rank}
      </td>
      <td className="py-5 pr-4">
        <Link
          to="/clmm/pool/$poolAddress"
          params={{ poolAddress: row.address }}
          className="flex items-center gap-3 min-w-0"
        >
          <PoolPairAvatar row={row} />
          <span className="font-grotesk text-[16px] font-medium truncate" style={{ color: clmm.text }}>
            {pairLabel}
          </span>
        </Link>
      </td>
      <td className="py-5 px-3 text-center font-mono text-[13px]" style={{ color: clmm.textMuted }}>
        CLMM
      </td>
      <td className="py-5 px-3 text-center font-mono text-[13px]" style={{ color: clmm.text }}>
        {m.feePercent}
      </td>
      <td className="py-5 px-3 text-center font-mono text-[13px] tabular-nums" style={{ color: clmm.text }}>
        {formatAprPrecise(m.aprPercent)}
      </td>
      <td className="py-5 pr-5 pl-3 text-right font-mono text-[13px] tabular-nums" style={{ color: clmm.text }}>
        {formatUsdTable(m.tvlUsd)}
      </td>
      <td className="py-5 pr-5 pl-3 text-right font-mono text-[13px] tabular-nums" style={{ color: clmm.text }}>
        {formatUsdTable(m.volume24hUsd)}
      </td>
      <td className="py-5 pr-5 pl-3 text-right font-mono text-[13px] tabular-nums" style={{ color: clmm.text }}>
        {formatUsdTable(m.fees24hUsd)}
      </td>
    </tr>
  );
}

function PoolPairAvatar({ row }: { row: EnrichedPool }) {
  const m = row.metrics;
  return (
    <PoolPairLogos
      token0={row.token0}
      token1={row.token1}
      symbol0={m.symbol0}
      symbol1={m.symbol1}
      logo0={m.logo0 ?? m.pairImageUrl}
      logo1={m.logo1 ?? m.pairImageUrl}
      size={32}
    />
  );
}
