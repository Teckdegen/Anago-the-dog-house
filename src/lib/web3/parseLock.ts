/** Normalize getLock() tuple — viem may return object or array */

export type ParsedLockData = {
  token: `0x${string}`;
  amount: bigint;
  unlockAt: bigint;
  createdAt: bigint;
  withdrawn: boolean;
};

export function parseLockTuple(raw: unknown): ParsedLockData | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    if (raw.length < 5) return null;
    return {
      token: raw[0] as `0x${string}`,
      amount: raw[1] as bigint,
      unlockAt: raw[2] as bigint,
      createdAt: raw[3] as bigint,
      withdrawn: Boolean(raw[4]),
    };
  }

  const r = raw as Record<string, unknown>;
  const unlockAt = (r.unlockTime ?? r.unlockAt ?? 0n) as bigint;
  if (r.token == null || r.amount == null) return null;

  return {
    token: r.token as `0x${string}`,
    amount: r.amount as bigint,
    unlockAt,
    createdAt: (r.createdAt ?? 0n) as bigint,
    withdrawn: Boolean(r.withdrawn),
  };
}

const ZERO = "0x0000000000000000000000000000000000000000";

export function resolveLockOwner(
  ownerFromNft: unknown,
  fallback?: `0x${string}`,
): `0x${string}` {
  if (
    typeof ownerFromNft === "string" &&
    ownerFromNft.toLowerCase() !== ZERO &&
    ownerFromNft.length === 42
  ) {
    return ownerFromNft as `0x${string}`;
  }
  return fallback ?? (ZERO as `0x${string}`);
}
