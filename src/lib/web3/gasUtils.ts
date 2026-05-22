/**
 * Gas utilities for Monad transactions.
 * Fixed 10M gas limit + live gas price (Monad floor is 100 gwei).
 */

import type { PublicClient } from "viem";

/** User-requested generous limit for all contract writes */
export const TX_GAS = 10_000_000n;

/** Monad minimum base fee floor (100 gwei) — https://docs.monad.xyz/developer-essentials/gas-pricing */
export const MIN_GAS_PRICE = 100_000_000_000n;

export type TxGasParams = { gas: bigint; gasPrice: bigint };

/** @deprecated Use TX_GAS — kept for import compatibility */
export const GAS = {
  APPROVE: TX_GAS,
  CREATE_LOCK: TX_GAS,
  WITHDRAW_LOCK: TX_GAS,
  CREATE_VESTING: TX_GAS,
  CLAIM_VESTING: TX_GAS,
  FARM_DEPOSIT: TX_GAS,
  FARM_CLAIM: TX_GAS,
  FARM_WITHDRAW: TX_GAS,
  OTC_BUY: TX_GAS,
  OTC_LIST: TX_GAS,
  NFT_APPROVE: TX_GAS,
  NFT_TRANSFER: TX_GAS,
  DEFAULT: TX_GAS,
} as const;

export async function getRecommendedGasPrice(publicClient: PublicClient): Promise<bigint> {
  try {
    const network = await publicClient.getGasPrice();
    const bumped = (network * 200n) / 100n;
    return bumped > MIN_GAS_PRICE ? bumped : MIN_GAS_PRICE;
  } catch {
    return MIN_GAS_PRICE;
  }
}

/**
 * Gas params for writeContract — always 10M limit + network gas price (min 100 gwei).
 */
export async function prepareTransactionWithGas(
  publicClient: PublicClient | null | undefined,
  _request?: unknown,
  _gasLimit?: bigint,
): Promise<TxGasParams> {
  if (!publicClient) {
    return { gas: TX_GAS, gasPrice: MIN_GAS_PRICE };
  }
  const gasPrice = await getRecommendedGasPrice(publicClient);
  return { gas: TX_GAS, gasPrice };
}

/** @deprecated Use prepareTransactionWithGas — sync path used wrong 1 gwei default */
export async function contractGas(
  publicClient: PublicClient | null | undefined,
): Promise<TxGasParams> {
  return prepareTransactionWithGas(publicClient);
}

export async function getGasSettings(publicClient: PublicClient | null | undefined) {
  return prepareTransactionWithGas(publicClient);
}
