import { UNISWAP_V4 } from "./addresses";

export const positionManager = UNISWAP_V4.positionManager;
export const quoter = UNISWAP_V4.quoter;
export const swapRouter = UNISWAP_V4.universalRouter211;
export const universalRouter = UNISWAP_V4.universalRouter211;
export const poolManager = UNISWAP_V4.poolManager;

export function positionManagerFor(): `0x${string}` {
  return UNISWAP_V4.positionManager;
}

export function quoterFor(): `0x${string}` {
  return UNISWAP_V4.quoter;
}

export function swapRouterFor(): `0x${string}` {
  return UNISWAP_V4.universalRouter211;
}

export function universalRouterFor(): `0x${string}` {
  return UNISWAP_V4.universalRouter211;
}

export function poolManagerFor(): `0x${string}` {
  return UNISWAP_V4.poolManager;
}

export function lpProtocolLabel(): "V4" {
  return "V4";
}
