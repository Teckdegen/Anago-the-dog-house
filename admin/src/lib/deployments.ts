/**
 * StreamFarm address for this admin app.
 * Keep in sync with ../src/lib/web3/deployments.generated.ts after `npm run deploy:testnet` in /contracts.
 */
export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);

/** Monad testnet — latest deploy from deploySuite.ts */
const TESTNET_STREAM_FARM = "0xf14eD1b63EF380BF1d32C49fbA43b2871f194Fef" as const;

export const STREAM_FARM_ADDRESS = (
  process.env.NEXT_PUBLIC_STREAM_FARM_ADDRESS?.trim() || TESTNET_STREAM_FARM
) as `0x${string}`;

export const EXPLORER_BASE =
  DEFAULT_CHAIN_ID === 143
    ? "https://monadexplorer.com"
    : "https://testnet.monadexplorer.com";
