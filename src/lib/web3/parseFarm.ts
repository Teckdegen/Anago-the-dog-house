import type { PublicClient } from "viem";

/** Min seconds after chain `block.timestamp` — contract rejects start in the past. */
export const REWARD_START_BUFFER_SEC = 120;

export type ParsedFarmData = {
  stakeToken: `0x${string}`;
  totalShares: bigint;
  totalStaked: bigint;
  active: boolean;
  lockDuration: bigint;
  earlyWithdrawBps: bigint;
  rewardStreamCount: bigint;
};

/** Normalize getFarm() — viem may return object or array. */
export function parseFarmTuple(raw: unknown): ParsedFarmData | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    if (raw.length < 7) return null;
    return {
      stakeToken: raw[0] as `0x${string}`,
      totalShares: raw[1] as bigint,
      totalStaked: raw[2] as bigint,
      active: Boolean(raw[3]),
      lockDuration: raw[4] as bigint,
      earlyWithdrawBps: raw[5] as bigint,
      rewardStreamCount: raw[6] as bigint,
    };
  }

  const r = raw as Record<string, unknown>;
  if (r.stakeToken == null) return null;

  return {
    stakeToken: r.stakeToken as `0x${string}`,
    totalShares: (r.totalShares ?? 0n) as bigint,
    totalStaked: (r.totalStaked ?? 0n) as bigint,
    active: Boolean(r.active),
    lockDuration: (r.lockDuration ?? 0n) as bigint,
    earlyWithdrawBps: (r.earlyWithdrawBps ?? 0n) as bigint,
    rewardStreamCount: (r.rewardStreamCount ?? 0n) as bigint,
  };
}

/** Reward stream window using chain time so addRewardStream won't revert with "Start in past". */
export async function computeRewardStreamWindow(
  publicClient: PublicClient,
  delayHours: number,
  durationDays: number,
): Promise<{ start: bigint; end: bigint }> {
  const block = await publicClient.getBlock();
  const chainNow = Number(block.timestamp);
  const delaySec = Math.max(0, delayHours) * 3600;
  const startOffset = Math.max(REWARD_START_BUFFER_SEC, delaySec);
  const durationSec = Math.max(1, durationDays) * 86400;
  const start = BigInt(chainNow + startOffset);
  const end = start + BigInt(durationSec);
  return { start, end };
}
