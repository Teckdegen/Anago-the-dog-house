/** Uniswap V3 tick → sqrtPriceX96 (minimal port for NPM mint bounds) */

const Q32 = 2n ** 32n;

const MIN_TICK = -887272;
const MAX_TICK = 887272;

function mulShift(val: bigint, mul: bigint): bigint {
  return (val * mul) >> 128n;
}

function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = tick < 0 ? -tick : tick;
  if (absTick > MAX_TICK) throw new Error("TICK");

  let ratio =
    (absTick & 0x1) !== 0
      ? 0xfffcb933e6e5746958b08e4e9n
      : 0x100000000000000000000000000000000n;
  if ((absTick & 0x2) !== 0) ratio = mulShift(ratio, 0xfff97272373d413259a46990580e413n);
  if ((absTick & 0x4) !== 0) ratio = mulShift(ratio, 0xfff2e50f5f656932ef12357cf3c7fdccn);
  if ((absTick & 0x8) !== 0) ratio = mulShift(ratio, 0xffe5caca7e10e4e61c3624eaa0941cd0n);
  if ((absTick & 0x10) !== 0) ratio = mulShift(ratio, 0xffcb9843d60f6159c9db58835c926644n);
  if ((absTick & 0x20) !== 0) ratio = mulShift(ratio, 0xff973b41fa98c081472e6896dfb254c0n);
  if ((absTick & 0x40) !== 0) ratio = mulShift(ratio, 0xff2ea16466c96a3843ec78b326b52861n);
  if ((absTick & 0x80) !== 0) ratio = mulShift(ratio, 0xfe5dee046a99a2a811c461f1837af2afn);
  if ((absTick & 0x100) !== 0) ratio = mulShift(ratio, 0xfcbe86c7900a88aedcffe83b8df191451n);
  if ((absTick & 0x200) !== 0) ratio = mulShift(ratio, 0xf987a7253ac413176f3b0746bb5e2153n);
  if ((absTick & 0x400) !== 0) ratio = mulShift(ratio, 0xf2d6e8d731a05d438338d1e62f1e2fb4n);
  if ((absTick & 0x800) !== 0) ratio = mulShift(ratio, 0xe62f6ff8b0ba10c36941da67afcf08136n);
  if ((absTick & 0x1000) !== 0) ratio = mulShift(ratio, 0xd34f13b3a85f79ba132ee988da2ca40bn);
  if ((absTick & 0x2000) !== 0) ratio = mulShift(ratio, 0xad077c56a01ae0b0d6a6f6f296ecf437n);
  if ((absTick & 0x4000) !== 0) ratio = mulShift(ratio, 0x83c8c73030e8789ebc4eb314440f8e4en);
  if ((absTick & 0x8000) !== 0) ratio = mulShift(ratio, 0x48a170391f7dc42444e8fa2cddf2d551n);
  if ((absTick & 0x10000) !== 0) ratio = mulShift(ratio, 0x237be35e6a251fc6db6a759775f0a06n);
  if ((absTick & 0x20000) !== 0) ratio = mulShift(ratio, 0x814c9dadd0b4e9f8594ee2cee0d64da0n);
  if ((absTick & 0x40000) !== 0) ratio = mulShift(ratio, 0x4b8b95eedb7bb9cb54538d042f897da93n);
  if ((absTick & 0x80000) !== 0) ratio = mulShift(ratio, 0x397f8372d0d06fc5fb2e8c3d79b2b1b4n);

  if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;

  return (ratio >> 32n) + (ratio % Q32 === 0n ? 0n : 1n);
}

export function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  return Math.min(MAX_TICK, Math.max(MIN_TICK, rounded));
}

export function wideRangeTicks(currentTick: number, tickSpacing: number, span = 60): {
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96Lower: bigint;
  sqrtPriceX96Upper: bigint;
} {
  const tickLower = nearestUsableTick(currentTick - span * tickSpacing, tickSpacing);
  const tickUpper = nearestUsableTick(currentTick + span * tickSpacing, tickSpacing);
  return {
    tickLower,
    tickUpper,
    sqrtPriceX96Lower: getSqrtRatioAtTick(tickLower),
    sqrtPriceX96Upper: getSqrtRatioAtTick(tickUpper),
  };
}

export { MIN_TICK, MAX_TICK, getSqrtRatioAtTick };
