import { useMemo } from "react";
import { formatUsdCompact } from "@/lib/capricorn/poolMetrics";
import { clmm } from "./clmmTheme";

function formatPrice(price: number): string {
  if (price <= 0) return "—";
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(6);
  return price.toFixed(4);
}

/** Price panel — on-chain mid price primary, subgraph for USD volume */
export function PoolPriceChart({
  livePrice,
  priceUsd,
  priceChange24h,
  symbol0,
  symbol1,
  volume24hUsd,
}: {
  livePrice: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  symbol0: string;
  symbol1: string;
  volume24hUsd?: number | null;
}) {
  const points = useMemo(
    () => generateSparkline(livePrice, priceChange24h, 32),
    [livePrice, priceChange24h],
  );
  const w = 100;
  const h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const positive = (priceChange24h ?? 0) >= 0;
  const stroke = positive ? clmm.green : clmm.red;

  return (
    <div className="rounded-xl p-4 h-full min-h-[220px] flex flex-col" style={{ border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}>
      <div className="flex gap-2 mb-3">
        <span className="font-mono text-[10px] px-2 py-1 rounded-md" style={{ background: clmm.purpleSolid, color: clmm.text }}>
          Price
        </span>
        <span className="font-mono text-[10px] px-2 py-1 rounded-md opacity-70" style={{ color: clmm.textMuted }}>
          Vol {formatUsdCompact(volume24hUsd)}
        </span>
      </div>
      <p className="font-grotesk text-[22px] font-medium" style={{ color: clmm.text }}>
        {formatPrice(livePrice)}{" "}
        <span className="text-[14px] font-mono" style={{ color: clmm.textMuted }}>
          {symbol1}/{symbol0}
        </span>
      </p>
      {priceUsd != null && (
        <p className="font-mono text-[11px] mt-1" style={{ color: clmm.textDim }}>
          ≈ ${priceUsd.toPrecision(4)} USD · on-chain mid
        </p>
      )}
      {priceChange24h != null && (
        <p className="font-mono text-[11px] mt-0.5" style={{ color: stroke }}>
          {priceChange24h >= 0 ? "+" : ""}
          {priceChange24h.toFixed(2)}% (24h · subgraph)
        </p>
      )}
      <div className="flex-1 flex items-end mt-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[100px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="clmmFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#clmmFill)" />
          <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="font-mono text-[8px] mt-2" style={{ color: clmm.textDim }}>
        Sparkline from live mid + 24h change (no historical API on Monad)
      </p>
    </div>
  );
}

function generateSparkline(endPrice: number, change24h: number | null, n: number): number[] {
  const end = endPrice > 0 ? endPrice : 1;
  const start = change24h != null ? end / (1 + change24h / 100) : end * 0.99;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push(start + (end - start) * t);
  }
  return out;
}
