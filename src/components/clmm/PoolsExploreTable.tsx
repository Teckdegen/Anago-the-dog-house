import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { TokenIcon } from "@/components/TokenIcon";
import { formatApr, formatUsdCompact, type EnrichedPool } from "@/lib/capricorn/poolMetrics";
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
  const volKey: SortKey = "vol";

  return (
    <div className="w-full">
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wide" style={{ color: clmm.textDim }}>
              <th className="text-left py-3 pr-3 font-normal w-10">#</th>
              <th className="text-left py-3 pr-4 font-normal min-w-[200px]">Pool</th>
              <th className="text-left py-3 pr-3 font-normal">Protocol</th>
              <th className="text-left py-3 pr-3 font-normal">Fee tier</th>
              <SortHeader
                label="TVL"
                active={sortKey === "tvl"}
                desc={sortDesc}
                onClick={() => onSort("tvl")}
              />
              <SortHeader
                label="Pool APR"
                active={sortKey === "apr"}
                desc={sortDesc}
                onClick={() => onSort("apr")}
              />
              <th className="text-right py-3 pr-3 font-normal">Reward APR</th>
              <SortHeader
                label="1D vol"
                active={sortKey === volKey}
                desc={sortDesc}
                onClick={() => onSort(volKey)}
                align="right"
              />
              <th className="text-right py-3 pr-3 font-normal">30D vol</th>
              <th className="text-right py-3 font-normal">1D vol/TVL</th>
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
    <th className={`py-3 pr-3 font-normal ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:opacity-90 transition"
        style={{ color: active ? clmm.text : clmm.textDim }}
      >
        {label}
        {active && (
          <ChevronDown
            className="w-3 h-3 transition-transform"
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
  const volTvl =
    m.volume24hUsd != null && m.tvlUsd != null && m.tvlUsd > 0
      ? (m.volume24hUsd / m.tvlUsd).toFixed(2)
      : "—";

  return (
    <tr
      className="group border-t transition-colors"
      style={{ borderColor: clmm.border }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = clmm.purpleBgHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <td className="py-4 pr-3 font-mono text-[12px]" style={{ color: clmm.textDim }}>
        {rank}
      </td>
      <td className="py-4 pr-4">
        <Link
          to="/clmm/pool/$poolAddress"
          params={{ poolAddress: row.address }}
          className="flex items-center gap-3 min-w-0"
        >
          <PoolPairAvatar row={row} />
          <span className="font-grotesk text-[15px] font-medium truncate" style={{ color: clmm.text }}>
            {pairLabel}
          </span>
        </Link>
      </td>
      <td className="py-4 pr-3">
        <span className="font-mono text-[11px] lowercase" style={{ color: clmm.textMuted }}>
          v4
        </span>
      </td>
      <td className="py-4 pr-3 font-mono text-[12px]" style={{ color: clmm.text }}>
        {m.feePercent}
      </td>
      <td className="py-4 pr-3 text-right font-mono text-[12px]" style={{ color: clmm.text }}>
        {formatUsdCompact(m.tvlUsd)}
      </td>
      <td className="py-4 pr-3 text-right font-mono text-[12px]" style={{ color: clmm.text }}>
        {formatApr(m.aprPercent)}
      </td>
      <td className="py-4 pr-3 text-right font-mono text-[12px]" style={{ color: clmm.textDim }}>
        —
      </td>
      <td className="py-4 pr-3 text-right font-mono text-[12px]" style={{ color: clmm.text }}>
        {formatUsdCompact(m.volume24hUsd)}
      </td>
      <td className="py-4 pr-3 text-right font-mono text-[12px]" style={{ color: clmm.textDim }}>
        —
      </td>
      <td className="py-4 text-right font-mono text-[12px]" style={{ color: clmm.textMuted }}>
        {volTvl}
      </td>
    </tr>
  );
}

function PoolPairAvatar({ row }: { row: EnrichedPool }) {
  const m = row.metrics;
  const size = 28;

  if (m.pairImageUrl) {
    return (
      <img
        src={m.pairImageUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full shrink-0 object-cover"
        style={{ border: `1px solid ${clmm.border}` }}
      />
    );
  }

  return (
    <div className="relative flex shrink-0" style={{ width: size + 12, height: size }}>
      <TokenIcon address={row.token0} symbol={m.symbol0} size={size} logoUrl={m.logo0} />
      <div className="absolute left-[14px] top-[6px] ring-2 ring-[#06040F] rounded-full">
        <TokenIcon address={row.token1} symbol={m.symbol1} size={size} logoUrl={m.logo1} />
      </div>
      <div
        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-bold"
        style={{ background: clmm.purpleSolid, color: clmm.text, border: `1px solid ${clmm.border}` }}
      >
        ◆
      </div>
    </div>
  );
}
