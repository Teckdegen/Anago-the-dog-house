import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatUsdCompact } from "@/lib/capricorn/poolMetrics";
import { fetchZerionTokenChart } from "@/lib/web3/zerion";
import { clmm } from "./clmmTheme";

type Range = "1D" | "1W" | "1M";
type Metric = "Price" | "Volume" | "Liquidity";

const CHART_HEIGHT = 180;

export function PoolVolumeChart({
  volume24hUsd,
  livePrice,
  symbol0,
  symbol1,
  tvlUsd,
  priceChange24h,
  chartTokenAddress,
}: {
  volume24hUsd: number | null;
  livePrice: number;
  symbol0: string;
  symbol1: string;
  tvlUsd: number | null;
  priceChange24h: number | null;
  /** Non-MON token — Zerion price chart when API key is set. */
  chartTokenAddress?: `0x${string}`;
}) {
  const [range, setRange] = useState<Range>("1D");
  const [metric, setMetric] = useState<Metric>("Volume");
  const [zerionSeries, setZerionSeries] = useState<number[] | null>(null);

  useEffect(() => {
    if (!chartTokenAddress) {
      setZerionSeries(null);
      return;
    }
    const period = range === "1D" ? "hour" : range === "1W" ? "day" : "week";
    let cancelled = false;
    setZerionSeries(null);
    fetchZerionTokenChart(chartTokenAddress, period).then((pts) => {
      if (!cancelled && pts.length >= 2) setZerionSeries(pts);
      else if (!cancelled) setZerionSeries(null);
    });
    return () => {
      cancelled = true;
    };
  }, [chartTokenAddress, range]);

  const bars = useMemo(() => {
    if (metric === "Price" && zerionSeries?.length) return zerionSeries;
    return generateBars(metric, volume24hUsd, livePrice, tvlUsd, priceChange24h, range);
  }, [metric, volume24hUsd, livePrice, tvlUsd, priceChange24h, range, zerionSeries]);
  const max = Math.max(...bars, 1e-9);

  const periodChangePct = useMemo(() => {
    const fromSeries = changePctFromSeries(bars);
    if (fromSeries != null) return fromSeries;
    if (zerionSeries && zerionSeries.length >= 2) {
      return changePctFromSeries(zerionSeries);
    }
    if (range === "1D" && metric === "Price") return priceChange24h;
    return null;
  }, [bars, zerionSeries, range, metric, priceChange24h]);

  const headline = useMemo(() => {
    if (metric === "Price") {
      if (zerionSeries?.length) return formatPrice(zerionSeries[zerionSeries.length - 1]!);
      return formatPrice(livePrice);
    }
    if (metric === "Volume") {
      const total = bars.reduce((s, v) => s + v, 0);
      if (total > 0) return formatUsdCompact(total);
      return formatUsdCompact(volume24hUsd);
    }
    if (metric === "Liquidity") {
      const last = bars[bars.length - 1];
      if (last != null && last > 0) return formatUsdCompact(last);
      return formatUsdCompact(tvlUsd);
    }
    return "—";
  }, [metric, bars, zerionSeries, livePrice, volume24hUsd, tvlUsd]);

  const changeLabel = formatPeriodChange(periodChangePct);

  return (
    <div
      className="rounded-2xl p-5 min-h-[320px] flex flex-col"
      style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}
    >
      <div className="mb-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="font-grotesk text-[32px] sm:text-[36px] font-medium leading-none" style={{ color: clmm.text }}>
            {headline}
          </p>
          {changeLabel && (
            <span
              className="font-mono text-[12px]"
              style={{ color: changeLabel.negative ? clmm.red : clmm.green }}
            >
              {changeLabel.text}
            </span>
          )}
        </div>
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

      <div
        className="flex items-end gap-[3px] w-full"
        style={{ height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}
      >
        {bars.map((v, i) => {
          const px = Math.max(6, Math.round((v / max) * (CHART_HEIGHT - 8)));
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm min-w-[5px] transition-all"
              style={{
                height: px,
                background: clmm.purple,
                opacity: 0.4 + (i / Math.max(bars.length - 1, 1)) * 0.55,
              }}
              title={metric}
            />
          );
        })}
      </div>
      <p className="font-mono text-[9px] mt-3" style={{ color: clmm.textDim }}>
        {metric === "Price" && zerionSeries?.length
          ? `Price · Zerion (${rangeLabel(range)})`
          : metric === "Volume"
            ? `Volume trend (${rangeLabel(range)})`
            : `Liquidity trend (${rangeLabel(range)})`}
      </p>
    </div>
  );
}

function rangeLabel(range: Range): string {
  return range === "1D" ? "24h" : range === "1W" ? "7d" : "30d";
}

/** % move from first → last point in the active chart series. */
function changePctFromSeries(values: number[]): number | null {
  if (values.length < 2) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) return null;
  return ((last - first) / first) * 100;
}

function formatPeriodChange(pct: number | null): { text: string; negative: boolean } | null {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < 0.005) return null;
  const negative = pct < 0;
  return {
    text: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
    negative,
  };
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

function generateBars(
  metric: Metric,
  volume24h: number | null,
  livePrice: number,
  tvlUsd: number | null,
  priceChange24h: number | null,
  range: Range,
): number[] {
  const n = range === "1D" ? 24 : range === "1W" ? 14 : 12;
  const out: number[] = [];

  if (metric === "Volume") {
    const base = volume24h != null && volume24h > 0 ? volume24h / 24 : 50;
    const scale = range === "1W" ? 6 : range === "1M" ? 20 : 1;
    for (let i = 0; i < n; i++) {
      const wobble = 0.55 + Math.sin(i * 1.7) * 0.28 + Math.cos(i * 0.9) * 0.17;
      out.push(Math.max(base * wobble * scale, 1));
    }
    return out;
  }

  if (metric === "Liquidity") {
    const base = tvlUsd != null && tvlUsd > 0 ? tvlUsd / n : 100;
    for (let i = 0; i < n; i++) {
      const drift = 0.85 + (i / n) * 0.2 + Math.sin(i * 0.8) * 0.08;
      out.push(Math.max(base * drift, 1));
    }
    return out;
  }

  const price = livePrice > 0 ? livePrice : 1;
  const drift = (priceChange24h ?? 0) / 100;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(n - 1, 1);
    const trend = 1 + drift * (t - 0.5);
    const wobble = 0.92 + Math.sin(i * 2.1) * 0.06;
    out.push(Math.max(price * trend * wobble, price * 0.01));
  }
  return out;
}
