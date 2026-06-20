import { formatAmount } from "@/lib/web3/format";

/** Platform fee in basis points — 75 bps = 0.75% */
export const PLATFORM_FEE_BPS = 75;
export const BASIS_POINTS = 10_000;

export function platformFeeAmount(amount: bigint, feeBps = PLATFORM_FEE_BPS): bigint {
  if (amount <= 0n || feeBps <= 0) return 0n;
  return (amount * BigInt(feeBps)) / BigInt(BASIS_POINTS);
}

export function netAfterPlatformFee(amount: bigint, feeBps = PLATFORM_FEE_BPS): bigint {
  return amount - platformFeeAmount(amount, feeBps);
}

export function formatFeePercent(feeBps = PLATFORM_FEE_BPS): string {
  return `${((feeBps / BASIS_POINTS) * 100).toFixed(2)}%`;
}

/** e.g. `0.75 TOKEN | 0.75%` — plain string for modals / success rows */
export function formatPlatformFeeValue(amount: bigint, decimals: number, symbol: string, feeBps = PLATFORM_FEE_BPS): string {
  return `${formatAmount(amount, decimals)} ${symbol} | ${formatFeePercent(feeBps)}`;
}
