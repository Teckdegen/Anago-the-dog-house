import type { PublicClient } from "viem";
import { UNISWAP_V3 } from "./addresses";
import { NPM_ABI, POOL_ABI } from "./abis";
import { wideRangeTicks } from "./tickMath";
import type { PoolLiveState } from "./types";

const MAX_UINT128 = 2n ** 128n - 1n;

export function buildCollectArgs(tokenId: bigint, recipient: `0x${string}`) {
  return {
    tokenId,
    recipient,
    amount0Max: MAX_UINT128,
    amount1Max: MAX_UINT128,
  } as const;
}

export function buildMintArgs(p: {
  live: PoolLiveState;
  recipient: `0x${string}`;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min?: bigint;
  amount1Min?: bigint;
  deadline?: bigint;
}) {
  const { live } = p;
  const tickSpacing = live.pool.tickSpacing || 60;
  const { tickLower, tickUpper } = wideRangeTicks(live.tick, tickSpacing, 80);
  const deadline = p.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 1200);

  return {
    token0: live.pool.token0,
    token1: live.pool.token1,
    fee: live.pool.fee,
    tickLower,
    tickUpper,
    amount0Desired: p.amount0Desired,
    amount1Desired: p.amount1Desired,
    amount0Min: p.amount0Min ?? 0n,
    amount1Min: p.amount1Min ?? 0n,
    recipient: p.recipient,
    deadline,
  } as const;
}

export function buildDecreaseArgs(p: {
  tokenId: bigint;
  liquidity: bigint;
  amount0Min?: bigint;
  amount1Min?: bigint;
  deadline?: bigint;
}) {
  const deadline = p.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 1200);
  return {
    tokenId: p.tokenId,
    liquidity: p.liquidity,
    amount0Min: p.amount0Min ?? 0n,
    amount1Min: p.amount1Min ?? 0n,
    deadline,
  } as const;
}

export async function readPoolTickSpacing(
  client: PublicClient,
  poolAddress: `0x${string}`,
): Promise<number> {
  try {
    const spacing = await client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "tickSpacing",
    });
    return Number(spacing);
  } catch {
    return 60;
  }
}
