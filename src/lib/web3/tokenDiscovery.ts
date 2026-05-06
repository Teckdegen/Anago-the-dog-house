/**
 * Alternative token discovery methods for when explorer APIs are not available
 */

import type { PublicClient } from "viem";
import { type TokenInfo, getTokenList, ERC20_ABI } from "./tokens";
import { getAllTokens } from "./customTokens";
import type { TokenBalance } from "./tokenBalances";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/**
 * Discover tokens by scanning recent Transfer events in chunks
 * This is more reliable and efficient than relying on explorer APIs
 */
export async function discoverTokensFromLogs(
  address: `0x${string}`,
  publicClient: PublicClient,
  blocksToScan = 50000n,
): Promise<`0x${string}`[]> {
  try {
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = latestBlock > blocksToScan ? latestBlock - blocksToScan : 0n;
    
    // ERC-20 Transfer event signature
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    // Pad address to 32 bytes for topic matching
    const paddedAddress = `0x${address.slice(2).padStart(64, '0')}`;
    
    console.log(`[tokenDiscovery] Scanning ${blocksToScan} blocks for token transfers...`);
    
    // Get logs in chunks to avoid RPC limits
    const chunkSize = 10000n;
    let allLogs: any[] = [];
    
    for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
      const end = start + chunkSize - 1n > latestBlock ? latestBlock : start + chunkSize - 1n;
      
      try {
        // Get logs where user is sender or receiver
        const [sentLogs, receivedLogs] = await Promise.all([
          publicClient.getLogs({
            fromBlock: start,
            toBlock: end,
            topics: [transferTopic, paddedAddress, null],
          }).catch(() => []), // Graceful fallback
          publicClient.getLogs({
            fromBlock: start,
            toBlock: end,
            topics: [transferTopic, null, paddedAddress],
          }).catch(() => []), // Graceful fallback
        ]);
        
        allLogs = [...allLogs, ...sentLogs, ...receivedLogs];
        
        // Add small delay to avoid rate limiting
        if (end < latestBlock) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.warn(`[tokenDiscovery] Failed to get logs for blocks ${start}-${end}:`, error);
        continue;
      }
    }

    // Extract unique contract addresses
    const tokenAddresses = new Set<`0x${string}`>();
    allLogs.forEach(log => {
      if (log.address && log.address !== ZERO) {
        tokenAddresses.add(log.address.toLowerCase() as `0x${string}`);
      }
    });

    console.log(`[tokenDiscovery] Found ${tokenAddresses.size} unique token contracts`);
    return Array.from(tokenAddresses);
    
  } catch (error) {
    console.warn("[tokenDiscovery] Failed to scan logs:", error);
    return [];
  }
}

/**
 * Batch fetch token metadata and balances with better error handling
 */
export async function batchFetchTokenData(
  tokenAddresses: `0x${string}`[],
  userAddress: `0x${string}`,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  if (tokenAddresses.length === 0) return [];

  console.log(`[tokenDiscovery] Fetching data for ${tokenAddresses.length} tokens...`);

  const tokens: TokenBalance[] = [];
  
  // Process tokens in smaller batches to avoid RPC limits
  const batchSize = 10;
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (address) => {
      try {
        // Fetch token metadata with fallbacks
        const [symbol, name, decimals, balance] = await Promise.all([
          publicClient.readContract({
            address,
            abi: ERC20_ABI,
            functionName: 'symbol',
          }).catch(() => '???'),
          publicClient.readContract({
            address,
            abi: ERC20_ABI,
            functionName: 'name',
          }).catch(() => 'Unknown Token'),
          publicClient.readContract({
            address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          }).catch(() => 18), // Default to 18 decimals
          publicClient.readContract({
            address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          }).catch(() => 0n),
        ]);

        // Only include tokens with non-zero balance
        if (balance > 0n) {
          return {
            address,
            symbol: String(symbol),
            name: String(name),
            decimals: Number(decimals),
            balance: BigInt(balance),
            balanceFormatted: formatTokenBalance(BigInt(balance), Number(decimals)),
          };
        }
        return null;
      } catch (error) {
        console.warn(`[tokenDiscovery] Failed to fetch data for token ${address}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const validTokens = batchResults.filter((token): token is TokenBalance => token !== null);
    tokens.push(...validTokens);
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < tokenAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`[tokenDiscovery] Successfully loaded ${tokens.length} tokens with balances`);
  return tokens.sort((a, b) => a.balance > b.balance ? -1 : 1);
}

/**
 * Format token balance for display - handles all decimal places (6, 18, etc.)
 */
function formatTokenBalance(balance: bigint, decimals: number): string {
  if (balance === 0n) return "0";
  
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const remainder = balance % divisor;
  
  if (remainder === 0n) {
    return whole.toString();
  }
  
  // Convert remainder to string and pad with leading zeros
  const remainderStr = remainder.toString().padStart(decimals, "0");
  
  // For display, show appropriate decimal places based on token decimals
  let decimalPlaces = 6; // Default to 6 decimal places
  if (decimals <= 6) {
    decimalPlaces = decimals; // Show all decimals for tokens with 6 or fewer
  } else if (decimals === 18) {
    decimalPlaces = 6; // Show 6 decimals for 18-decimal tokens
  } else {
    decimalPlaces = Math.min(6, decimals); // Show up to 6 decimals for others
  }
  
  // Take only the needed decimal places and remove trailing zeros
  const decimalPart = remainderStr.slice(0, decimalPlaces).replace(/0+$/, "");
  
  if (decimalPart === "") {
    return whole.toString();
  }
  
  return `${whole}.${decimalPart}`;
}

/**
 * Enhanced token discovery that combines multiple methods
 */
export async function discoverAllUserTokens(
  address: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  try {
    // Start with curated + custom token list
    const curatedTokens = getTokenList(chainId).filter(t => t.address !== ZERO);
    const allKnownTokens = getAllTokens(chainId, curatedTokens);
    const knownAddresses = allKnownTokens.map(t => t.address.toLowerCase() as `0x${string}`);
    
    // Discover additional tokens from logs
    const discoveredAddresses = await discoverTokensFromLogs(address, publicClient);
    
    // Combine and deduplicate
    const allAddresses = Array.from(new Set([
      ...knownAddresses,
      ...discoveredAddresses,
    ]));
    
    console.log(`[tokenDiscovery] Checking balances for ${allAddresses.length} tokens...`);
    
    // Batch fetch all token data
    const tokens = await batchFetchTokenData(allAddresses, address, publicClient);
    
    return tokens;
    
  } catch (error) {
    console.error("[tokenDiscovery] Discovery failed:", error);
    return [];
  }
}