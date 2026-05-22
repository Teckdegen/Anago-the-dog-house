/** Official Uniswap V3 deployments on Monad (chainId 143) */

export const MONAD_CHAIN_ID = 143;

export const UNISWAP_V3 = {
  factory: "0x204faca1764b154221e35c0d20abb3c525710498",
  quoterV2: "0x661e93cca42afacb172121ef892830ca3b70f08d",
  swapRouter02: "0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900",
  universalRouter: "0x0d97dc33264bfc1c226207428a79b26757fb9dc3",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  positionManager: "0x7197e214c0b767cfb76fb734ab638e2c192f4e53",
  wmon: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  multicall: "0xd1b797d92d87b688193a2b976efc8d577d204343",
} as const;

export function isUniswapSupportedChain(chainId: number): boolean {
  return chainId === MONAD_CHAIN_ID;
}
