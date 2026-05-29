/**
 * Protocol addresses for admin — keep in sync with ../src/lib/web3/deployments.generated.ts
 */
import { MAINNET_DEPLOYMENTS } from "../../../src/lib/web3/deployments.generated";

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 143);

function addr(envKey: string, fallback: `0x${string}`): `0x${string}` {
  const v = process.env[envKey]?.trim();
  if (v && /^0x[a-fA-F0-9]{40}$/.test(v)) return v as `0x${string}`;
  return fallback;
}

export const STREAM_FARM_ADDRESS = addr(
  "NEXT_PUBLIC_STREAM_FARM_ADDRESS",
  MAINNET_DEPLOYMENTS.streamFarm,
);
export const TOKEN_LOCK_ADDRESS = addr(
  "NEXT_PUBLIC_TOKEN_LOCK_ADDRESS",
  MAINNET_DEPLOYMENTS.tokenLock,
);
export const VESTING_NFT_ADDRESS = addr(
  "NEXT_PUBLIC_VESTING_NFT_ADDRESS",
  MAINNET_DEPLOYMENTS.vestingNFT,
);

export const EXPLORER_BASE = "https://monadexplorer.com";

export const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() || "https://the-dog-house.vercel.app";
