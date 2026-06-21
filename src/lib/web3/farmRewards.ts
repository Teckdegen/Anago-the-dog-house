type RewardStreamTuple = readonly [
  `0x${string}`, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
];

export type FarmRewardRemaining = {
  token: `0x${string}`;
  remaining: bigint;
};

/** Remaining reward budget per reward token (never sums different tokens). */
export function computeRewardsByToken(
  streams: readonly ({ status: string; result?: unknown } | undefined)[] | undefined,
  count: number,
): FarmRewardRemaining[] {
  const map = new Map<string, bigint>();

  for (let i = 0; i < count; i++) {
    const d = streams?.[i];
    if (d?.status !== "success" || !d.result) continue;
    const [token, , , , totalBudget, totalDistributed] = d.result as RewardStreamTuple;
    const remaining = totalBudget > totalDistributed ? totalBudget - totalDistributed : 0n;
    const key = (token as string).toLowerCase();
    map.set(key, (map.get(key) ?? 0n) + remaining);
  }

  return Array.from(map.entries()).map(([key, remaining]) => ({
    token: key as `0x${string}`,
    remaining,
  }));
}

/** Reward token addresses from streams (including fully claimed — for empty-state labels). */
export function rewardTokensFromStreams(
  streams: readonly ({ status: string; result?: unknown } | undefined)[] | undefined,
  count: number,
): `0x${string}`[] {
  const seen = new Set<string>();
  const tokens: `0x${string}`[] = [];
  for (let i = 0; i < count; i++) {
    const d = streams?.[i];
    if (d?.status !== "success" || !d.result) continue;
    const [token] = d.result as RewardStreamTuple;
    const key = (token as string).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tokens.push(token);
    }
  }
  return tokens;
}
