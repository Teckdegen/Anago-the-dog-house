/**
 * Token balances for connected wallets — Zerion (primary) + BlockVision + RPC fallback (merged)
 */

import { parseUnits } from "viem";
import type { PublicClient } from "viem";
import {
  blockVisionTokenToAddress,
  fetchBlockVisionAccountTokens,
  isBlockVisionAvailable,
  isNativeToken,
  parseBalanceRaw,
  NATIVE_TOKEN_ADDRESS,
} from "./blockvision";
import { fetchBlockscoutAddressTokens } from "./blockscout";
import { discoverAllUserTokens } from "./tokenDiscovery";
import { fetchZerionWalletPositions } from "./zerion";
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

  return out;
}

function mergeTokenBalances(...lists: TokenBalance[][]): TokenBalance[] {
  const merged = new Map<string, TokenBalance>();

  for (const list of lists) {
    for (const t of list) {
      const key = t.address.toLowerCase();
      const existing = merged.get(key);
      if (!existing || t.balance > existing.balance) {
        merged.set(key, t);
      }
    }
  }

  return [...merged.values()].sort((a, b) => {
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

export async function fetchBalancesFromZerion(
  address: `0x${string}`,
): Promise<TokenBalance[]> {
  return fetchZerionWalletPositions(address);
}

function mapBlockscoutTokens(items: Awaited<ReturnType<typeof fetchBlockscoutAddressTokens>>): TokenBalance[] {
  const out: TokenBalance[] = [];
  for (const t of items) {
    const balance = parseHumanBalanceBlockscout(t.balanceHuman, t.decimals);
    if (balance <= 0n) continue;
    const human = parseFloat(t.balanceHuman) || 0;
    const usdValue = t.priceUsd != null && t.priceUsd > 0 ? human * t.priceUsd : null;
    out.push({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logoURI: t.logoURI || undefined,
      balance,
      balanceFormatted: formatTokenBalance(balance, t.decimals),
      usdValue,
    });
  }
  return out;
}

function parseHumanBalanceBlockscout(balance: string, decimals: number): bigint {
  const s = balance?.trim() ?? "";
  if (!s || s === "0") return 0n;
  if (s.includes(".")) {
    const [whole, frac = ""] = s.split(".");
    const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
    try {
      return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
    } catch {
      return 0n;
    }
  }
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

export async function fetchBalancesFromBlockscout(
  address: `0x${string}`,
): Promise<TokenBalance[]> {
  const items = await fetchBlockscoutAddressTokens(address);
  return mapBlockscoutTokens(items);
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

/** Wallet tokens — BlockVision + on-chain discovery merged (never drop RPC tokens). */
export async function fetchAllBalances(
  address: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
): Promise<TokenBalance[]> {
  const lists: TokenBalance[][] = [];

  const [fromZerion, fromBv, fromBs, nativeBalance, tokenBalances] = await Promise.all([
    fetchBalancesFromZerion(address).catch((e) => {
      console.warn("[tokenBalances] Zerion unavailable:", e);
      return [] as TokenBalance[];
    }),
    isBlockVisionAvailable()
      ? fetchBalancesFromBlockVision(address).catch((e) => {
          console.warn("[tokenBalances] BlockVision unavailable:", e);
          return [] as TokenBalance[];
        })
      : Promise.resolve([] as TokenBalance[]),
    fetchBalancesFromBlockscout(address).catch((e) => {
      console.warn("[tokenBalances] Blockscout unavailable:", e);
      return [] as TokenBalance[];
    }),
    fetchNativeBalance(address, publicClient),
    fetchUserTokenBalances(address, chainId, publicClient).catch((e) => {
      console.warn("[tokenBalances] RPC discovery unavailable:", e);
      return [] as TokenBalance[];
    }),
  ]);

  if (fromZerion.length > 0) lists.push(fromZerion);
  if (fromBv.length > 0) lists.push(fromBv);
  if (fromBs.length > 0) lists.push(fromBs);
  lists.push([nativeBalance, ...tokenBalances]);

  return mergeTokenBalances(...lists);
}

/** Parse human amount string to bigint (utility for forms) */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  try {
    return parseUnits(amount || "0", decimals);
  } catch {
    return 0n;
  }
}
