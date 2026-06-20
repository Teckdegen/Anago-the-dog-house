import { formatAmount } from "@/lib/web3/format";
import { formatFeePercent, PLATFORM_FEE_BPS } from "@/lib/web3/platformFee";

/** Amount and rate with a vertical divider — e.g. `0.75 USDC | 0.75%` */
export function PlatformFeeValue({
  amount,
  decimals,
  symbol,
  feeBps = PLATFORM_FEE_BPS,
  className = "font-mono text-[11px]",
}: {
  amount: bigint;
  decimals: number;
  symbol: string;
  feeBps?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={{ color: "rgba(255,255,255,0.9)" }}>
      <span>
        {formatAmount(amount, decimals)} {symbol}
      </span>
      <span
        className="w-px h-3 shrink-0"
        style={{ background: "rgba(139,92,246,0.35)" }}
        aria-hidden
      />
      <span style={{ color: "rgba(255,255,255,0.65)" }}>{formatFeePercent(feeBps)}</span>
    </span>
  );
}
