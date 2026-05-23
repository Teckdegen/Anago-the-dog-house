import { useMemo, useState, type ReactNode } from "react";
import { formatUsdCompact } from "@/lib/capricorn/poolMetrics";
import { clmm } from "./clmmTheme";

type Range = "1D" | "1W" | "1M";
type Metric = "Price" | "Volume" | "Liquidity";

export function PoolVolumeChart({
  volume24hUsd,
  livePrice,
  symbol0,
  symbol1,
  tvlUsd,
}: {
  volume24hUsd: number | null;
  livePrice: number;
  symbol0: string;
  symbol1: string;
  tvlUsd: number | null;
}) {
  const [range, setRange] = useState<Range>("1D");
  const [metric, setMetric] = useState<Metric>("Volume");

  const bars = useMemo(() => generateBars(volume24hUsd, range), [volume24hUsd, range]);
  const max = Math.max(...bars, 1);
  const headline = metric === "Volume" ? formatUsdCompact(volume24hUsd) : formatPrice(livePrice);

  return (
    <div className="rounded-2xl p-5 min-h-[320px] flex flex-col" style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}>
      <div className="mb-4">
        <p className="font-grotesk text-[32px] sm:text-[36px] font-medium leading-none" style={{ color: clmm.text }}>
          {headline}
        </p>
        <p className="font-mono text-[11px] mt-1" style={{ color: clmm.textDim }}>
          Past {range === "1D" ? "day" : range === "1W" ? "week" : "month"} · {symbol0}/{symbol1}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["1D", "1W", "1M"] as const).map((r) => (
          <Pill key={r} active={range === r} onClick={() => setRange(r)}>
            {r}
          </Pill>
        ))}
        <span className="w-px h-6 mx-1 self-center" style={{ background: clmm.border }} />
        {(["Price", "Volume", "Liquidity"] as const).map((m) => (
          <Pill key={m} active={metric === m} onClick={() => setMetric(m)}>
            {m}
          </Pill>
        ))}
      </div>

      <div className="flex-1 flex items-end gap-[3px] min-h-[180px] pt-4">
        {bars.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm min-w-[4px] transition-all"
            style={{
              height: `${Math.max(8, (v / max) * 100)}%`,
              background: clmm.purple,
              opacity: 0.35 + (i / bars.length) * 0.65,
            }}
          />
        ))}
      </div>
      <p className="font-mono text-[9px] mt-3" style={{ color: clmm.textDim }}>
        Estimated bars from 24h volume (no historical indexer on Monad yet)
      </p>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full font-mono text-[10px] transition"
      style={
        active
          ? { background: clmm.purpleBgHover, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }
          : { color: clmm.textMuted, border: `1px solid transparent` }
      }
    >
      {children}
    </button>
  );
}

function formatPrice(price: number): string {
  if (price <= 0) return "—";
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(6);
  return price.toFixed(4);
}

function generateBars(volume24h: number | null, range: Range): number[] {
  const base = volume24h != null && volume24h > 0 ? volume24h / 24 : 1000;
  const n = range === "1D" ? 24 : range === "1W" ? 14 : 12;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const wobble = 0.6 + Math.sin(i * 1.7) * 0.25 + Math.cos(i * 0.9) * 0.15;
    out.push(base * wobble * (range === "1W" ? 6 : range === "1M" ? 20 : 1));
  }
  return out;
}
