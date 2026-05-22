/** Minimal ABI for reading on-chain NFT metadata */
export const NFT_URI_ABI = [
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
] as const;

function decodeBase64Json(dataUri: string): Record<string, unknown> | null {
  const comma = dataUri.indexOf(",");
  if (comma < 0) return null;
  const payload = dataUri.slice(comma + 1);
  try {
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeImageField(image: unknown): string | null {
  if (typeof image !== "string" || !image) return null;
  if (image.startsWith("data:") || image.startsWith("http")) return image;
  return null;
}

/**
 * Extract an <img>-compatible src from an ERC-721 tokenURI (data:application/json;base64,…).
 */
export function parseNftImageSrc(tokenUri: string | undefined | null): string | null {
  if (!tokenUri) return null;

  if (tokenUri.startsWith("data:image/")) return tokenUri;

  if (tokenUri.startsWith("data:application/json")) {
    const json = decodeBase64Json(tokenUri);
    return normalizeImageField(json?.image);
  }

  if (tokenUri.startsWith("http")) return tokenUri;

  return null;
}

/** React Query options — always read live chain data (no stale cache) */
export const LIVE_CHAIN_QUERY = {
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
} as const;
