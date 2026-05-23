import type { PublicClient } from "viem";
import { CAPRICORN_CL } from "./addresses";
import { SWAP_ROUTER_ABI } from "./abis";

export type ExactInputSingleParams = {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  fee: number;
  recipient: `0x${string}`;
  amountIn: bigint;
  amountOutMinimum: bigint;
  deadline?: bigint;
};

export function buildExactInputSingleArgs(p: ExactInputSingleParams) {
  const deadline = p.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 1200);
  return {
    tokenIn: p.tokenIn,
    tokenOut: p.tokenOut,
    fee: p.fee,
    recipient: p.recipient,
    deadline,
    amountIn: p.amountIn,
    amountOutMinimum: p.amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  } as const;
}

export async function simulateExactInputSingle(
  client: PublicClient,
  account: `0x${string}`,
  p: ExactInputSingleParams,
) {
  return client.simulateContract({
    address: CAPRICORN_CL.swapRouter as `0x${string}`,
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [buildExactInputSingleArgs(p)],
    account,
  });
}
