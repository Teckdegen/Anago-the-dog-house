/**
 * On-chain ERC-20 metadata (logo URI, symbol, name) when DexScreener has no listing.
 */

import type { PublicClient } from "viem";
import { ERC20_ABI } from "./tokens";
import { parseNftImageSrc } from "./nftImage";

const TOKEN_URI_ABI = [
  {
    type: "function",
    name: "logoURI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "contractURI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

async function readUriField(
  publicClient: PublicClient,
  address: `0x${string}`,
  field: "logoURI" | "tokenURI" | "contractURI",
): Promise<string | null> {
  try {
    const uri = await publicClient.readContract({
      address,
      abi: TOKEN_URI_ABI,
      functionName: field,
    });
    if (typeof uri !== "string" || !uri) return null;
    return parseNftImageSrc(uri) ?? (uri.startsWith("http") || uri.startsWith("data:") ? uri : null);
  } catch {
    return null;
  }
}

/** Read logo/image URL from token contract metadata functions */
export async function fetchTokenLogoFromChain(
  address: `0x${string}`,
  publicClient: PublicClient,
): Promise<string | null> {
  for (const field of ["logoURI", "tokenURI", "contractURI"] as const) {
    const logo = await readUriField(publicClient, address, field);
    if (logo) return logo;
  }
  return null;
}

export async function fetchTokenBasicsFromChain(
  address: `0x${string}`,
  publicClient: PublicClient,
): Promise<{ symbol: string; name: string; decimals: number } | null> {
  try {
    const [symbol, name, decimals] = await Promise.all([
      publicClient.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
      publicClient.readContract({ address, abi: ERC20_ABI, functionName: "name" }),
      publicClient.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
    ]);
    return {
      symbol: symbol as string,
      name: name as string,
      decimals: Number(decimals),
    };
  } catch {
    return null;
  }
}
