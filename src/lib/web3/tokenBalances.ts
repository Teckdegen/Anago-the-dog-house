/**
 * Token balance fetching utilities for Monad
 * Discovers and fetches all ERC-20 token balances for a user address
 */

import { type TokenInfo, EXPLORER_API, ERC20_ABI } from "./tokens";
import type { PublicClient } from "viem";

export type TokenBalance = TokenInfo & {
  balance: bigint;
  balanceFormatted: string;
};

/**
 * Fetch all token balances for a given address on Monad
 * Uses the Monad Explorer API to discover tokens the user has interacted with
 */
export async function fetchUserTokenBalances(
  address: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  const explorerUrl = EXPLORER_API[chainId];
  if (!explorerUrl) {
    console.warn(`[tokenBalances] No explorer API configured for chain ${chainId}`);
    return [];
  }

  try {
    // Fetch token transfers involving this address from the explorer
    const tokensResponse = await fetch(
      `${explorerUrl}?module=account&action=tokentx&address=${address}&page=1&offset=100`,
    );

    if (!tokensResponse.ok) {
      console.error("[tokenBalances] Explorer API request failed:", tokensResponse.statusText);
      return [];
    }

    const data = await tokensResponse.json();
    
    if (data.status !== "1" || !Array.isArray(data.result)) {
      // No token transfers found or API error
      return [];
    }

    // Extract unique token addresses
    const tokenAddresses = new Set<`0x${string}`>();
    for (const tx of data.result) {
      if (tx.contractAddress) {
        tokenAddresses.add(tx.contractAddress.toLowerCase() as `0x${string}`);
      }
    }

    if (tokenAddresses.size === 0) {
      return [];
    }

    // Fetch token metadata and balances in parallel
    const tokenPromises = Array.from(tokenAddresses).map(async (tokenAddress) => {
      try {
        // Fetch token metadata
        const [symbol, decimals, balance] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "symbol",
          }) as Promise<string>,
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
          }) as Promise<number>,
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          }) as Promise<bigint>,
        ]);

        // Try to fetch name (optional, some tokens might not have it)
        let name = symbol;
        try {
          name = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "name",
          }) as string;
        } catch {
          // Name is optional, use symbol as fallback
        }

        // Only return tokens with non-zero balance
        if (balance > 0n) {
          const balanceFormatted = formatTokenBalance(balance, decimals);
          return {
            address: tokenAddress,
            symbol,
            name,
            decimals,
            balance,
            balanceFormatted,
          } as TokenBalance;
        }
        return null;
      } catch (error) {
        console.warn(`[tokenBalances] Failed to fetch data for token ${tokenAddress}:`, error);
        return null;
      }
    });

    const results = await Promise.all(tokenPromises);
    
    // Filter out null results and sort by balance (descending)
    return results
      .filter((token): token is TokenBalance => token !== null)
      .sort((a, b) => {
        // Sort by balance in descending order
        if (a.balance > b.balance) return -1;
        if (a.balance < b.balance) return 1;
        return 0;
      });
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
