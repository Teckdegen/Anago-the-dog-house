import type { ContractAddresses } from "@/lib/web3/contracts";

export type NftKind = "lock" | "vesting" | "farm";

/**
 * Drop your artwork into `public/images/nft/` using these exact filenames.
 * Served at `/images/nft/...` — PNG, WebP, or SVG all work.
 * Recommended size: 400×250 (matches on-chain card) or square 512×512.
 */
export const NFT_CUSTOM_ART: Record<NftKind, string> = {
  lock: "/images/nft/lock.png",
  vesting: "/images/nft/vesting.png",
  farm: "/images/nft/farm.png",
};

export function nftKindFromContract(
  contract: string,
  addresses: Pick<ContractAddresses, "tokenLock" | "vestingNFT" | "streamFarm">,
): NftKind | null {
  const c = contract.toLowerCase();
  if (c === addresses.tokenLock.toLowerCase()) return "lock";
  if (c === addresses.vestingNFT.toLowerCase()) return "vesting";
  if (c === addresses.streamFarm.toLowerCase()) return "farm";
  return null;
}
