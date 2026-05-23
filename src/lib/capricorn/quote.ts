import type { PublicClient } from "viem";
import { CAPRICORN_CL } from "./addresses";
import { QUOTER_V2_ABI } from "./abis";

export async function quoteExactInputSingle(
  client: PublicClient,
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  fee: number,
  amountIn: bigint,
): Promise<bigint | null> {
  if (amountIn <= 0n) return 0n;
  try {
    const result = await client.simulateContract({
      address: CAPRICORN_CL.quoter as `0x${string}`,
      abi: QUOTER_V2_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    return result.result[0] as bigint;
  } catch {
    try {
      const result = await client.readContract({
        address: CAPRICORN_CL.quoter as `0x${string}`,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn,
            tokenOut,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      return result[0] as bigint;
    } catch {
      return null;
    }
  }
}
