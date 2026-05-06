/**
 * Token balance fetching utilities for Monad
 * Discovers and fetches all ERC-20 token balances for a user address
 */

import { type TokenInfo, getTokenList, ERC20_ABI } from "./tokens";
import { discoverAllUserTokens } from "./tokenDiscovery";
import type { PublicClient } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export type TokenBalance = TokenInfo & {
  balance: bigint;
  balanceFormatted: string;
};

/**
 * Fetch all token balances for a given address on Monad
 * Uses RPC event logs to discover tokens the user has interacted with
 */
export async function fetchUserTokenBalances(
  address: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  try {
    // Use the enhanced discovery method
    return await discoverAllUserTokens(address, chainId, publicClient);
  } catch (error) {
    console.error("[tokenBalances] Error fetching token balances:", error);
    return [];
  }
}

/**
 * Format token balance for display
 */
function formatTokenBalance(balance: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const remainder = balance % divisor;
  
  if (remainder === 0n) {
    return whole.toString();
  }
  
  // Show up to 6 decimal places, removing trailing zeros
  const remainderStr = remainder.toString().padStart(decimals, "0");
  const decimalPart = remainderStr.slice(0, 6).replace(/0+$/, "");
  
  if (decimalPart === "") {
    return whole.toString();
  }
  
  return `${whole}.${decimalPart}`;
}

/**
 * Fetch native token (MON) balance
 */
export async function fetchNativeBalance(
  address: `0x${string}`,
  publicClient: PublicClient,
): Promise<TokenBalance> {
  const balance = await publicClient.getBalance({ address });
  
  return {
    address: "0x0000000000000000000000000000000000000000",
    symbol: "MON",
    name: "Monad",
    decimals: 18,
    balance,
    balanceFormatted: formatTokenBalance(balance, 18),
  };
}

/**
 * Fetch all balances (native + ERC-20 tokens)
 */
export async function fetchAllBalances(
  address: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  const [nativeBalance, tokenBalances] = await Promise.all([
    fetchNativeBalance(address, publicClient),
    fetchUserTokenBalances(address, chainId, publicClient),
  ]);

  // Combine and sort by balance
  return [nativeBalance, ...tokenBalances].sort((a, b) => {
    if (a.balance > b.balance) return -1;
    if (a.balance < b.balance) return 1;
    return 0;
  });
}
