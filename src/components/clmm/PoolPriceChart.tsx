import { useMemo } from "react";
import { clmm } from "./clmmTheme";

/** Lightweight price chart from 24h change + current price (no external chart API) */
export function PoolPriceChart({
  priceUsd,
  priceChange24h,
  symbol0,
  symbol1,
}: {
  priceUsd: number | null;
  priceChange24h: number | null;
  symbol0: string;
  symbol1: string;
}) {
  const points = useMemo(() => generateSparkline(priceUsd, priceChange24h, 48), [priceUsd, priceChange24h]);
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
        <span className="font-mono text-[10px] px-2 py-1 rounded-md opacity-50" style={{ color: clmm.textMuted }}>
          Volume
        </span>
      </div>
      <p className="font-grotesk text-[22px] font-medium" style={{ color: clmm.text }}>
        {priceUsd != null ? priceUsd.toPrecision(4) : "—"}{" "}
        <span className="text-[14px] font-mono" style={{ color: clmm.textMuted }}>
          {symbol1}/{symbol0}
        </span>
      </p>
      {priceChange24h != null && (
        <p className="font-mono text-[11px] mt-1" style={{ color: stroke }}>
          {priceChange24h >= 0 ? "+" : ""}
          {priceChange24h.toFixed(2)}% (24h)
        </p>
      )}
      <div className="flex-1 flex items-end mt-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[120px]" preserveAspectRatio="none">
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
      <div className="flex gap-2 mt-3 font-mono text-[9px]" style={{ color: clmm.textDim }}>
        {["1H", "1D", "1W", "1M", "3M", "6M", "1Y", "All"].map((t) => (
          <button
            key={t}
            type="button"
            className="px-1.5 py-0.5 rounded"
            style={{
              color: t === "1D" ? clmm.text : clmm.textDim,
              background: t === "1D" ? clmm.purpleSolid : "transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function generateSparkline(price: number | null, change24h: number | null, n: number): number[] {
  const end = price ?? 1;
  const start = change24h != null ? end / (1 + change24h / 100) : end * 0.98;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const base = start + (end - start) * t;
    const noise = Math.sin(i * 0.7) * 0.008 * end + Math.cos(i * 1.3) * 0.005 * end;
    out.push(Math.max(0, base + noise));
  }
  return out;
}
