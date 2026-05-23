const MAX_UINT128 = 2n ** 128n - 1n;

export function buildCollectArgs(tokenId: bigint, recipient: `0x${string}`) {
  return {
    tokenId,
    recipient,
    amount0Max: MAX_UINT128,
    amount1Max: MAX_UINT128,
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
