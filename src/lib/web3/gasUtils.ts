/**
 * Gas estimation utilities for Monad transactions
 */

import type { PublicClient } from "viem";

/**
 * Estimate gas for a contract call with buffer
 */
export async function estimateGasWithBuffer(
  publicClient: PublicClient,
  request: any,
  bufferPercent = 20
): Promise<bigint> {
  try {
    const estimated = await publicClient.estimateContractGas(request);
    // Add buffer to avoid out of gas errors
    const buffer = (estimated * BigInt(bufferPercent)) / 100n;
    return estimated + buffer;
  } catch (error) {
    console.warn("[gasUtils] Gas estimation failed, using default:", error);
    // Return a reasonable default gas limit for Monad
    return 500000n; // 500k gas
  }
}

/**
 * Get recommended gas price for Monad
 */
export async function getRecommendedGasPrice(publicClient: PublicClient): Promise<bigint> {
  try {
    const gasPrice = await publicClient.getGasPrice();
    // Add 10% buffer to gas price
    return (gasPrice * 110n) / 100n;
  } catch (error) {
    console.warn("[gasUtils] Gas price fetch failed, using default:", error);
    // Default gas price for Monad testnet (1 gwei)
    return 1000000000n;
  }
}

/**
 * Prepare transaction with gas estimation
 */
export async function prepareTransactionWithGas(
  publicClient: PublicClient,
  request: any
): Promise<any> {
  try {
    const [gasLimit, gasPrice] = await Promise.all([
      estimateGasWithBuffer(publicClient, request),
      getRecommendedGasPrice(publicClient),
    ]);

    return {
      ...request,
      gas: gasLimit,
      gasPrice,
    };
  } catch (error) {
    console.warn("[gasUtils] Transaction preparation failed:", error);
    // Return original request with default gas settings
    return {
      ...request,
      gas: 500000n,
      gasPrice: 1000000000n,
    };
  }
}