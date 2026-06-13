import type { ContractAddresses } from "@/lib/web3/contracts";

export type NftKind = "lock" | "vesting" | "farm";

/** Custom NFT card art — remote URLs or `/public/images/nft/...` paths. */
export const NFT_CUSTOM_ART: Record<NftKind, string> = {
  lock: "https://www.image2url.com/r2/default/images/1781347039322-42a5f5ba-833a-4c23-b5bb-9b89acc99652.jpg",
  vesting: "https://www.image2url.com/r2/default/images/1781346975174-c7be879b-3954-4651-8186-d3deab22fecd.jpg",
  farm: "https://www.image2url.com/r2/default/images/1781347075685-1459a4e0-474e-4f97-be8c-d096d988aae7.jpg",
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
