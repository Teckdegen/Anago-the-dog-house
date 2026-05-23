/** Official Uniswap V4 deployments on Monad mainnet (chainId 143) */

export const MONAD_CHAIN_ID = 143;

export const UNISWAP_V4 = {
  poolManager: "0x188d586ddcf52439676ca21a244753fa19f9ea8e",
  positionDescriptor: "0x5770d2914355a6d0a39a70aeea9bcce55df4201b",
  positionManager: "0x5b7ec4a94ff9bedb700fb82ab09d5846972f4016",
  quoter: "0xa222dd357a9076d1091ed6aa2e16c9742dd26891",
  stateView: "0x77395f3b2e73ae90843717371294fa97cc419d64",
  universalRouter: "0x0d97dc33264bfc1c226207428a79b26757fb9dc3",
  universalRouter211: "0xfdf682f51fe81aa4898f0ae2163d8a55c127fbc7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  wmon: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
} as const;

/** @deprecated Use UNISWAP_V4 */
export const UNISWAP_SHARED = {
  wmon: UNISWAP_V4.wmon,
  permit2: UNISWAP_V4.permit2,
  universalRouter: UNISWAP_V4.universalRouter,
} as const;

export function isUniswapSupportedChain(chainId: number): boolean {
  return chainId === MONAD_CHAIN_ID;
}

/** V4 pool IDs are bytes32 (0x + 64 hex chars). */
export function isV4PoolId(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function isPoolRef(value: string): boolean {
  return isV4PoolId(value);
}
