/**
 * Token balances for connected wallets — BlockVision (primary) + RPC fallback
 */

import { parseUnits } from "viem";
import type { PublicClient } from "viem";
import {
  blockVisionTokenToAddress,
  fetchBlockVisionAccountTokens,
  getBlockVisionApiKey,
  isNativeToken,
  parseBalanceRaw,
  NATIVE_TOKEN_ADDRESS,
} from "./blockvision";
import { discoverAllUserTokens } from "./tokenDiscovery";
import type { TokenInfo } from "./tokens";

export type TokenBalance = TokenInfo & {
  balance: bigint;
  balanceFormatted: string;
  /** USD value for this holding when BlockVision provides price */
  usdValue?: number | null;
};

function formatTokenBalance(balance: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const remainder = balance % divisor;

  if (remainder === 0n) return whole.toString();

  const remainderStr = remainder.toString().padStart(decimals, "0");
  const decimalPart = remainderStr.slice(0, 6).replace(/0+$/, "");

  if (decimalPart === "") return whole.toString();
  return `${whole}.${decimalPart}`;
}

function mapBlockVisionTokens(
  items: Awaited<ReturnType<typeof fetchBlockVisionAccountTokens>>,
): TokenBalance[] {
  const out: TokenBalance[] = [];

  for (const t of items) {
    const decimals = Number(t.decimal) || 18;
    const balance = parseBalanceRaw(t.balance, decimals);
    if (balance <= 0n) continue;

    const address = blockVisionTokenToAddress(t);
    const price = t.price ? parseFloat(t.price) : NaN;
    const human =
      balance > 10n ** BigInt(decimals + 2)
        ? Number(balance) / 10 ** decimals
        : parseFloat(t.balance) || 0;
    const usdValue = Number.isFinite(price) && price > 0 ? human * price : null;

    out.push({
      address,
      symbol: isNativeToken(t) ? "MON" : t.symbol || "???",
      name: isNativeToken(t) ? "Monad" : t.name || t.symbol || "Token",
      decimals,
      logoURI: t.imageURL || undefined,
      balance,
      balanceFormatted: formatTokenBalance(balance, decimals),
      usdValue,
    });
  }

  return out.sort((a, b) => {
    const au = a.usdValue ?? 0;
    const bu = b.usdValue ?? 0;
    if (au !== bu) return bu - au;
    if (a.balance > b.balance) return -1;
    if (a.balance < b.balance) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

export async function fetchBalancesFromBlockVision(
  address: `0x${string}`,
): Promise<TokenBalance[]> {
  const items = await fetchBlockVisionAccountTokens(address);
  return mapBlockVisionTokens(items);
}

export async function fetchUserTokenBalances(
  address: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  try {
    return await discoverAllUserTokens(address, chainId, publicClient);
  } catch (error) {
    console.error("[tokenBalances] RPC discovery failed:", error);
    return [];
  }
}

export async function fetchNativeBalance(
  address: `0x${string}`,
  publicClient: PublicClient,
): Promise<TokenBalance> {
  const balance = await publicClient.getBalance({ address });

  return {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "MON",
    name: "Monad",
    decimals: 18,
    balance,
    balanceFormatted: formatTokenBalance(balance, 18),
  };
}

/** All wallet tokens — BlockVision when keyed, else RPC discovery + native balance */
export async function fetchAllBalances(
  address: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  if (getBlockVisionApiKey() || import.meta.env.DEV) {
    try {
      const fromBv = await fetchBalancesFromBlockVision(address);
      if (fromBv.length > 0) return fromBv;
    } catch (e) {
      console.warn("[tokenBalances] BlockVision unavailable, using RPC:", e);
    }
  }

  const [nativeBalance, tokenBalances] = await Promise.all([
    fetchNativeBalance(address, publicClient),
    fetchUserTokenBalances(address, chainId, publicClient),
  ]);

  const merged = new Map<string, TokenBalance>();
  merged.set(NATIVE_TOKEN_ADDRESS, nativeBalance);
  for (const t of tokenBalances) {
    if (t.address.toLowerCase() === NATIVE_TOKEN_ADDRESS) continue;
    merged.set(t.address.toLowerCase(), t);
  }

  return [...merged.values()].sort((a, b) => {
    if (a.balance > b.balance) return -1;
    if (a.balance < b.balance) return 1;
    return 0;
  });
}

/** Parse human amount string to bigint (utility for forms) */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  try {
    return parseUnits(amount || "0", decimals);
  } catch {
    return 0n;
  }
}
