/** Normalize OTC getListing() — viem/wagmi may return object or array */

export type ParsedListing = {
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  paymentToken: `0x${string}`;
  price: bigint;
  active: boolean;
  createdAt: bigint;
};

export function parseListingTuple(raw: unknown): ParsedListing | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    if (raw.length < 6) return null;
    return {
      seller: raw[0] as `0x${string}`,
      nftContract: raw[1] as `0x${string}`,
      tokenId: raw[2] as bigint,
      paymentToken: raw[3] as `0x${string}`,
      price: raw[4] as bigint,
      active: Boolean(raw[5]),
      createdAt: (raw[6] ?? 0n) as bigint,
    };
  }

  const r = raw as Record<string, unknown>;
  if (r.seller == null || r.nftContract == null || r.tokenId == null || r.price == null) {
    return null;
  }

  return {
    seller: r.seller as `0x${string}`,
    nftContract: r.nftContract as `0x${string}`,
    tokenId: r.tokenId as bigint,
    paymentToken: (r.paymentToken ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    price: r.price as bigint,
    active: Boolean(r.active),
    createdAt: (r.createdAt ?? 0n) as bigint,
  };
}
