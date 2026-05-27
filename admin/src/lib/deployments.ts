/**
 * Protocol addresses for admin — keep in sync with ../src/lib/web3/deployments.generated.ts
 */
export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);

const TESTNET = {
  streamFarm: "0xf14eD1b63EF380BF1d32C49fbA43b2871f194Fef" as const,
  tokenLock: "0x8eDC567AaB95D94DC343331A710b2c534b98dAd6" as const,
  vestingNFT: "0x05d844E4bA8c2Ee9EBC007eEADdF5d0fFfC5C87A" as const,
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
