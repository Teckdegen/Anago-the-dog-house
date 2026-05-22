/**
 * Gas utilities for Monad transactions.
 * Uses fixed gas limits to avoid wallet/RPC simulation ("cannot estimate gas") failures.
 */

import type { PublicClient } from "viem";

const DEFAULT_GAS_PRICE = 1_000_000_000n; // 1 gwei fallback

/** Generous fixed limits — Monad gas is cheap */
export const GAS = {
  APPROVE: 150_000n,
  CREATE_LOCK: 1_000_000n,
  WITHDRAW_LOCK: 400_000n,
  CREATE_VESTING: 1_200_000n,
  CLAIM_VESTING: 600_000n,
  FARM_DEPOSIT: 800_000n,
  FARM_CLAIM: 600_000n,
  FARM_WITHDRAW: 700_000n,
  OTC_BUY: 600_000n,
  OTC_LIST: 500_000n,
  NFT_APPROVE: 200_000n,
  NFT_TRANSFER: 300_000n,
  DEFAULT: 500_000n,
} as const;

export async function getRecommendedGasPrice(publicClient: PublicClient): Promise<bigint> {
  try {
    const gasPrice = await publicClient.getGasPrice();
    return (gasPrice * 110n) / 100n;
  } catch {
    return DEFAULT_GAS_PRICE;
  }
}

/** Sync gas fields for writeContract — no RPC simulation */
export function contractGas(gasLimit: bigint = GAS.DEFAULT, gasPrice = DEFAULT_GAS_PRICE) {
  return { gas: gasLimit, gasPrice };
}

/**
 * Prepare transaction with fixed gas (optional live gas price).
 * Never calls estimateContractGas — avoids "cannot get gas estimate" errors.
 */
export async function prepareTransactionWithGas(
  publicClient: PublicClient,
  _request?: unknown,
  gasLimit: bigint = GAS.DEFAULT,
): Promise<{ gas: bigint; gasPrice: bigint }> {
  const gasPrice = await getRecommendedGasPrice(publicClient);
  return { gas: gasLimit, gasPrice };
}

export function getGasSettings(gasLimit: bigint = GAS.DEFAULT) {
  return contractGas(gasLimit);
}
