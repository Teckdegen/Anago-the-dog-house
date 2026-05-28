/**
 * Protocol addresses for admin — keep in sync with ../src/lib/web3/contracts.ts (TESTNET)
 */
export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);

const TESTNET = {
  streamFarm: "0x736F281DB537B1595f74320995903666e804B80E" as const,
  tokenLock: "0x1B326887e87D6671D5c34FB79F66d72B446D0aF0" as const,
  vestingNFT: "0xfAb8d05E96E8295999AB00Bb20E7973CfdaC2D48" as const,
};

function addr(envKey: string, fallback: `0x${string}`): `0x${string}` {
  const v = process.env[envKey]?.trim();
  if (v && /^0x[a-fA-F0-9]{40}$/.test(v)) return v as `0x${string}`;
  return fallback;
}

export const STREAM_FARM_ADDRESS = addr("NEXT_PUBLIC_STREAM_FARM_ADDRESS", TESTNET.streamFarm);
export const TOKEN_LOCK_ADDRESS = addr("NEXT_PUBLIC_TOKEN_LOCK_ADDRESS", TESTNET.tokenLock);
export const VESTING_NFT_ADDRESS = addr("NEXT_PUBLIC_VESTING_NFT_ADDRESS", TESTNET.vestingNFT);

export const EXPLORER_BASE =
  DEFAULT_CHAIN_ID === 143 ? "https://monadexplorer.com" : "https://testnet.monadexplorer.com";

export const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() || "https://the-dog-house.vercel.app";
