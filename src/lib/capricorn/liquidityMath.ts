import { sqrtPriceX96ToPrice } from "./poolState";

/** Uniswap V3–style tick / liquidity math for deposit quotes and mint amounts. */

const Q96 = 2n ** 96n;
const MIN_TICK = -887272;
const MAX_TICK = 887272;

function mulShift(val: bigint, mul: bigint): bigint {
  return (val * mul) >> 128n;
}

/** sqrtPriceX96 at a given tick (Uniswap TickMath). */
export function getSqrtRatioAtTick(tick: number): bigint {
  if (tick < MIN_TICK || tick > MAX_TICK) throw new Error("Invalid tick");
  const absTick = tick < 0 ? -tick : tick;

  let ratio =
    (absTick & 0x1) !== 0
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;

  if ((absTick & 0x2) !== 0) ratio = mulShift(ratio, 0xfff97272373d413259a46990580e213an);
  if ((absTick & 0x4) !== 0) ratio = mulShift(ratio, 0xfff2e50f5f656932ef12357cf3c7fdccn);
  if ((absTick & 0x8) !== 0) ratio = mulShift(ratio, 0xffe5caca7e10e4e61c3624eaa094ee3n);
  if ((absTick & 0x10) !== 0) ratio = mulShift(ratio, 0xffcb9843d1f5989daac1dade2db9ae0dn);
  if ((absTick & 0x20) !== 0) ratio = mulShift(ratio, 0xff973b41fa98c081472d097580f9a2dn);
  if ((absTick & 0x40) !== 0) ratio = mulShift(ratio, 0xff2ea16466c96a3843ec78b326b52861n);
  if ((absTick & 0x80) !== 0) ratio = mulShift(ratio, 0xfe5dee046a99a2a811c461f1839af481n);
  if ((absTick & 0x100) !== 0) ratio = mulShift(ratio, 0xfcbe86c7900a88aedcffc83b479a3a4n);
  if ((absTick & 0x200) !== 0) ratio = mulShift(ratio, 0xf987a7253ac413176f2b074cf7815e54n);
  if ((absTick & 0x400) !== 0) ratio = mulShift(ratio, 0xf3392b0822b70005940c7a398e6b7e3n);
  if ((absTick & 0x800) !== 0) ratio = mulShift(ratio, 0xe7159475a2c29b7443b29c7fa6e889d9n);
  if ((absTick & 0x1000) !== 0) ratio = mulShift(ratio, 0xd097f3bdfd2022b8845ad8f792aa5825n);
  if ((absTick & 0x2000) !== 0) ratio = mulShift(ratio, 0xa9f746462d870fdf8a65c026fe0da397n);
  if ((absTick & 0x4000) !== 0) ratio = mulShift(ratio, 0x70d869a156d2a1b890bb3df62baf32f7n);
  if ((absTick & 0x8000) !== 0) ratio = mulShift(ratio, 0x31be135f97d08fd981231505eafbcaa8n);
  if ((absTick & 0x10000) !== 0) ratio = mulShift(ratio, 0x9aa508b5b7a84e1c677de54f3e99bc9n);
  if ((absTick & 0x20000) !== 0) ratio = mulShift(ratio, 0x5d6af8deddb81196699e73e6c1a08d0n);
  if ((absTick & 0x40000) !== 0) ratio = mulShift(ratio, 0x2216e584f5fa1ea926041bedfe98a78bn);
  if ((absTick & 0x80000) !== 0) ratio = mulShift(ratio, 0x48a170391f7dc42444e8fa2c9a0b6a4n);

  if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;

  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

function sortSqrt(sqrtA: bigint, sqrtB: bigint): [bigint, bigint] {
  return sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
}

function mulDiv(a: bigint, b: bigint, denom: bigint): bigint {
  if (denom === 0n) return 0n;
  return (a * b) / denom;
}

function getLiquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint {
  [sqrtA, sqrtB] = sortSqrt(sqrtA, sqrtB);
  if (amount0 === 0n || sqrtA === sqrtB) return 0n;
  const intermediate = mulDiv(sqrtA, sqrtB, Q96);
  return mulDiv(amount0, intermediate, sqrtB - sqrtA);
}

function getLiquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint {
  [sqrtA, sqrtB] = sortSqrt(sqrtA, sqrtB);
  if (amount1 === 0n || sqrtA === sqrtB) return 0n;
  return mulDiv(amount1, Q96, sqrtB - sqrtA);
}

function getAmount0ForLiquidity(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  [sqrtA, sqrtB] = sortSqrt(sqrtA, sqrtB);
  if (liquidity === 0n) return 0n;
  return mulDiv(mulDiv(liquidity, Q96, sqrtB), sqrtB - sqrtA, sqrtA);
}

function getAmount1ForLiquidity(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  [sqrtA, sqrtB] = sortSqrt(sqrtA, sqrtB);
  if (liquidity === 0n) return 0n;
  return mulDiv(liquidity, sqrtB - sqrtA, Q96);
}

export function alignTickLower(tick: number, tickSpacing: number): number {
  const t = Math.floor(tick / tickSpacing) * tickSpacing;
  return Math.max(MIN_TICK, t);
}

export function alignTickUpper(tick: number, tickSpacing: number): number {
  const t = Math.ceil(tick / tickSpacing) * tickSpacing;
  return Math.min(MAX_TICK, t);
}

export function defaultTickRange(currentTick: number, tickSpacing: number, widthSteps = 80): {
  tickLower: number;
  tickUpper: number;
} {
  const tickLower = alignTickLower(currentTick - tickSpacing * widthSteps, tickSpacing);
  let tickUpper = alignTickUpper(currentTick + tickSpacing * widthSteps, tickSpacing);
  if (tickUpper <= tickLower) tickUpper = tickLower + tickSpacing;
  return { tickLower, tickUpper };
}

export type RangePreset = "10" | "20" | "50" | "full";

const PRESET_WIDTH_STEPS: Record<RangePreset, number> = {
  "10": 8,
  "20": 16,
  "50": 40,
  full: 80,
};

export function tickRangeForPreset(
  currentTick: number,
  tickSpacing: number,
  preset: RangePreset,
): { tickLower: number; tickUpper: number } {
  return defaultTickRange(currentTick, tickSpacing, PRESET_WIDTH_STEPS[preset]);
}

/** Human price (token1 per token0) at a tick. */
export function priceAtTick(tick: number, decimals0: number, decimals1: number): number {
  return sqrtPriceX96ToPrice(getSqrtRatioAtTick(tick), decimals0, decimals1);
}

export function formatPriceDisplay(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(6);
  if (price < 1000) return price.toFixed(4);
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Given one token amount, compute the paired amount for a V3 position at the current price. */
export function quoteLiquidityPair(params: {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  amount0?: bigint;
  amount1?: bigint;
}): { amount0: bigint; amount1: bigint } {
  const sqrtA = getSqrtRatioAtTick(params.tickLower);
  const sqrtB = getSqrtRatioAtTick(params.tickUpper);
  const sqrtP = params.sqrtPriceX96;
  const [sqrtLower, sqrtUpper] = sortSqrt(sqrtA, sqrtB);

  if (params.amount0 != null && params.amount0 > 0n) {
    const amount0 = params.amount0;
    if (sqrtP <= sqrtLower) {
      return { amount0, amount1: 0n };
    }
    if (sqrtP >= sqrtUpper) {
      return { amount0: 0n, amount1: 0n };
    }
    const liquidity = getLiquidityForAmount0(sqrtP, sqrtUpper, amount0);
    const amount1 = getAmount1ForLiquidity(sqrtLower, sqrtP, liquidity);
    return { amount0, amount1 };
  }

  if (params.amount1 != null && params.amount1 > 0n) {
    const amount1 = params.amount1;
    if (sqrtP >= sqrtUpper) {
      return { amount0: 0n, amount1 };
    }
    if (sqrtP <= sqrtLower) {
      return { amount0: 0n, amount1: 0n };
    }
    const liquidity = getLiquidityForAmount1(sqrtLower, sqrtP, amount1);
    const amount0 = getAmount0ForLiquidity(sqrtP, sqrtUpper, liquidity);
    return { amount0, amount1 };
  }

  return { amount0: 0n, amount1: 0n };
}
