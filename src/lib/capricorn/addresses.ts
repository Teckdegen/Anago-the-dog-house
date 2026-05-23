/** Capricorn CL (V3-compatible) — Monad mainnet (chainId 143) */

export const MONAD_CHAIN_ID = 143;

export const CAPRICORN_CL = {
  factory: "0x6B5F564339DbAD6b780249827f2198a841FEB7F3",
  positionManager: "0x4C02af995BB1f574c9bf31F43ddc112414aE0Ac7",
  swapRouter: "0xdac97b6a3951641B177283028A8f428332333071",
  quoter: "0xB430EDD2b54cdB3B25703fb3342ca3a88663A04D",
  tickLens: "0x0136B6347509D386c6da3896162BEBaAF19e51c4",
  initCodeHash:
    "0x32103411033f4f192bc82f2336cf034c3faf574dfaa3539190239fc1f27ab9fa",
} as const;

export function isCapricornSupportedChain(chainId: number): boolean {
  return chainId === MONAD_CHAIN_ID;
}

export function isPoolAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function isPoolRef(value: string): boolean {
  return isPoolAddress(value);
}
