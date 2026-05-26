const MAX_UINT128 = 2n ** 128n - 1n;

export function buildMintArgs(p: {
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  recipient: `0x${string}`;
  amount0Min?: bigint;
  amount1Min?: bigint;
  deadline?: bigint;
}) {
  const deadline = p.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 1200);
  const slip = (n: bigint) => (n * 95n) / 100n;
  return {
    token0: p.token0,
    token1: p.token1,
    fee: p.fee,
    tickLower: p.tickLower,
    tickUpper: p.tickUpper,
    amount0Desired: p.amount0Desired,
    amount1Desired: p.amount1Desired,
    amount0Min: p.amount0Min ?? slip(p.amount0Desired),
    amount1Min: p.amount1Min ?? slip(p.amount1Desired),
    recipient: p.recipient,
    deadline,
  } as const;
}

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
