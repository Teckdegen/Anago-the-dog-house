/**
 * Alternative token discovery methods for when explorer APIs are not available
 */

import type { PublicClient } from "viem";
import { type TokenInfo, getTokenList, ERC20_ABI } from "./tokens";
import { getAllTokens } from "./customTokens";
import type { TokenBalance } from "./tokenBalances";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

// Cache discovered tokens in localStorage to avoid re-scanning
const DISCOVERY_CACHE_KEY = "token_discovery_cache";
const DISCOVERY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCachedDiscovery(address: string, chainId: number): `0x${string}`[] | null {
  try {
    const raw = localStorage.getItem(`${DISCOVERY_CACHE_KEY}_${address}_${chainId}`);
    if (!raw) return null;
    const { tokens, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > DISCOVERY_CACHE_TTL) return null;
    return tokens;
  } catch { return null; }
}

function setCachedDiscovery(address: string, chainId: number, tokens: `0x${string}`[]): void {
  try {
    localStorage.setItem(`${DISCOVERY_CACHE_KEY}_${address}_${chainId}`, JSON.stringify({ tokens, timestamp: Date.now() }));
  } catch {}
}

/**
 * Discover tokens by scanning recent Transfer events in chunks.
 * Uses aggressive caching and smaller scan windows for reliability.
 */
export async function discoverTokensFromLogs(
  address: `0x${string}`,
  publicClient: PublicClient,
  blocksToScan = 200000n,
): Promise<`0x${string}`[]> {
  try {
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = latestBlock > blocksToScan ? latestBlock - blocksToScan : 0n;
    
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as `0x${string}`;
    const paddedAddress = `0x${address.slice(2).padStart(64, '0')}` as `0x${string}`;
    
    console.log(`[tokenDiscovery] Scanning blocks ${fromBlock} to ${latestBlock}...`);
    
    const chunkSize = 50000n;
    const tokenAddresses = new Set<`0x${string}`>();
    
    for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
      const end = start + chunkSize - 1n > latestBlock ? latestBlock : start + chunkSize - 1n;
      
      try {
        const [sentLogs, receivedLogs] = await Promise.all([
          publicClient.getLogs({
            fromBlock: start,
            toBlock: end,
            topics: [transferTopic, paddedAddress, null],
          }).catch(() => []),
          publicClient.getLogs({
            fromBlock: start,
            toBlock: end,
            topics: [transferTopic, null, paddedAddress],
          }).catch(() => []),
        ]);
        
        [...sentLogs, ...receivedLogs].forEach(log => {
          if (log.address && log.address !== ZERO) {
            tokenAddresses.add(log.address.toLowerCase() as `0x${string}`);
          }
        });
      } catch (error) {
        console.warn(`[tokenDiscovery] Chunk ${start}-${end} failed, skipping`);
        continue;
      }
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`[tokenDiscovery] Found ${tokenAddresses.size} unique token contracts`);
    return Array.from(tokenAddresses);
    
  } catch (error) {
    console.warn("[tokenDiscovery] Log scan failed:", error);
    return [];
  }
}

/**
 * Batch fetch token metadata and balances
 */
export async function batchFetchTokenData(
  tokenAddresses: `0x${string}`[],
  userAddress: `0x${string}`,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  if (tokenAddresses.length === 0) return [];

  const tokens: TokenBalance[] = [];
  const batchSize = 5; // Smaller batches for reliability
  
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (address) => {
      try {
        const [symbol, name, decimals, balance] = await Promise.all([
          publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => '???'),
          publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'name' }).catch(() => 'Unknown Token'),
          publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18),
          publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress] }).catch(() => 0n),
        ]);

        if ((balance as bigint) > 0n) {
          return {
            address,
            symbol: String(symbol),
            name: String(name),
            decimals: Number(decimals),
            balance: BigInt(balance as bigint),
            balanceFormatted: formatTokenBalance(BigInt(balance as bigint), Number(decimals)),
          };
        }
        return null;
      } catch {
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    tokens.push(...batchResults.filter((t): t is TokenBalance => t !== null));
    
    if (i + batchSize < tokenAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return tokens.sort((a, b) => a.balance > b.balance ? -1 : 1);
}

function formatTokenBalance(balance: bigint, decimals: number): string {
  if (balance === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const remainder = balance % divisor;
  if (remainder === 0n) return whole.toString();
  const remainderStr = remainder.toString().padStart(decimals, "0");
  const decimalPlaces = Math.min(6, decimals);
  const decimalPart = remainderStr.slice(0, decimalPlaces).replace(/0+$/, "");
  if (decimalPart === "") return whole.toString();
  return `${whole}.${decimalPart}`;
}

/**
 * Enhanced token discovery that combines cached results + known tokens + log scanning
 */
export async function discoverAllUserTokens(
  address: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  try {
    // 1. Start with curated + custom token list (instant)
    const curatedTokens = getTokenList(chainId).filter(t => t.address !== ZERO);
    const allKnownTokens = getAllTokens(chainId, curatedTokens);
    const knownAddresses = allKnownTokens.map(t => t.address.toLowerCase() as `0x${string}`);
    
    // 2. Check cache for previously discovered tokens
    const cached = getCachedDiscovery(address, chainId) ?? [];
    
    // 3. Combine known + cached immediately for fast first render
    const immediateAddresses = Array.from(new Set([...knownAddresses, ...cached]));
    
    // 4. Fetch balances for known tokens first (fast path)
    let tokens = await batchFetchTokenData(immediateAddresses, address, publicClient);
    
    // 5. Background: discover new tokens from logs
    try {
      const discoveredAddresses = await discoverTokensFromLogs(address, publicClient);
      
      // Find new tokens not already checked
      const newAddresses = discoveredAddresses.filter(a => !immediateAddresses.includes(a));
      
      if (newAddresses.length > 0) {
        const newTokens = await batchFetchTokenData(newAddresses, address, publicClient);
        tokens = [...tokens, ...newTokens];
      }
      
      // Update cache with all discovered addresses
      const allDiscovered = Array.from(new Set([...cached, ...discoveredAddresses]));
      setCachedDiscovery(address, chainId, allDiscovered);
    } catch (error) {
      console.warn("[tokenDiscovery] Background scan failed, using cached results");
    }
    
    return tokens;
    
  } catch (error) {
    console.error("[tokenDiscovery] Discovery failed:", error);
    return [];
  }
}