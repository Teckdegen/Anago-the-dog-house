export type PositionShareKind = "lock" | "vesting" | "farm" | "clmm";

const BASE_PATHS: Record<PositionShareKind, string> = {
  lock: "/lock",
  vesting: "/vesting",
  farm: "/farm",
  clmm: "/clmm",
};

/** Parse `?position=123` from the URL. */
export function parsePositionSearchParam(raw: string | undefined): bigint | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return undefined;
  try {
    const n = BigInt(s);
    if (n < 0n) return undefined;
    return n;
  } catch {
    return undefined;
  }
}

export type PositionSearchParams = {
  position?: string;
  tab?: string;
};

export function validatePositionSearch(search: Record<string, unknown>): PositionSearchParams {
  return {
    position: typeof search.position === "string" ? search.position : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
  };
}

/** Full shareable URL for a single on-chain position (NFT token id). */
export function buildPositionShareUrl(
  kind: PositionShareKind,
  tokenId: bigint | number | string,
): string {
  const id = (typeof tokenId === "bigint" ? tokenId : BigInt(tokenId)).toString();
  const params = new URLSearchParams({ position: id });
  if (kind === "farm") params.set("tab", "positions");
  const path = BASE_PATHS[kind];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${path}?${params.toString()}`;
}
