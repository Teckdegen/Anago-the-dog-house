import type { PublicClient } from "viem";
import { UNISWAP_V3 } from "./addresses";
import { FACTORY_ABI } from "./abis";

/** Lookup pool by two tokens + fee */
export async function getPoolAddress(
  client: PublicClient,
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  fee: number,
): Promise<`0x${string}` | null> {
  const addr = await client.readContract({
    address: UNISWAP_V3.factory,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [tokenA, tokenB, fee],
  });
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return null;
  return addr as `0x${string}`;
}
