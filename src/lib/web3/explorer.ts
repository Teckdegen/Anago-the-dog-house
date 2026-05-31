/** Etherscan-style MonadScan bases (chain 143 = mainnet). */
const EXPLORER_BASE: Record<number, string> = {
  143: "https://monadscan.com",
  10143: "https://testnet.monadscan.com",
};

export function getExplorerBase(chainId?: number): string {
  if (chainId != null && EXPLORER_BASE[chainId]) return EXPLORER_BASE[chainId];
  return EXPLORER_BASE[143];
}

export function explorerAddressUrl(address: string, chainId?: number): string {
  return `${getExplorerBase(chainId)}/address/${address}`;
}

/** ERC-721 position on MonadScan (Etherscan `/nft/{contract}/{tokenId}`). */
export function explorerNftUrl(
  contract: string,
  tokenId: bigint | string | number,
  chainId?: number,
): string {
  const id = typeof tokenId === "bigint" ? tokenId.toString() : String(tokenId);
  return `${getExplorerBase(chainId)}/nft/${contract}/${id}`;
}

export function explorerTxUrl(hash: string, chainId?: number): string {
  return `${getExplorerBase(chainId)}/tx/${hash}`;
}
