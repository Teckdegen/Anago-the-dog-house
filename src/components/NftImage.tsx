import { useMemo, useState } from "react";
import { useChainId, useReadContract } from "wagmi";
import { NFT_CUSTOM_ART, nftKindFromContract, type NftKind } from "@/lib/nftArt";
import { CONTRACTS } from "@/lib/web3/contracts";
import { NFT_URI_ABI, LIVE_CHAIN_QUERY, parseNftImageSrc } from "@/lib/web3/nftImage";

type Props = {
  contract: `0x${string}`;
  tokenId: bigint;
  size?: number;
  className?: string;
  fallbackLetter?: string;
  /** Override auto-detected lock / vesting / farm artwork from `public/images/nft/` */
  kind?: NftKind;
};

/**
 * Renders NFT art — custom file from `public/images/nft/` when present,
 * otherwise the on-chain SVG from tokenURI (Lock / Vesting / Stream Farm).
 */
export function NftImage({
  contract,
  tokenId,
  size = 48,
  className = "",
  fallbackLetter = "#",
  kind: kindProp,
}: Props) {
  const chainId = useChainId();
  const addresses = CONTRACTS[chainId] ?? CONTRACTS[143];
  const kind = kindProp ?? nftKindFromContract(contract, addresses);
  const customSrc = kind ? NFT_CUSTOM_ART[kind] : null;

  const [customFailed, setCustomFailed] = useState(false);
  const [chainFailed, setChainFailed] = useState(false);
  const useCustom = !!customSrc && !customFailed;

  const uriQ = useReadContract({
    address: contract,
    abi: NFT_URI_ABI,
    functionName: "tokenURI",
    args: [tokenId],
    query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000, enabled: !useCustom || customFailed },
  });

  const chainSrc = useMemo(() => parseNftImageSrc(uriQ.data as string | undefined), [uriQ.data]);
  const src = useCustom ? customSrc : chainSrc;
  const letter = (fallbackLetter || "#")[0].toUpperCase();

  if (!useCustom && uriQ.isLoading) {
    return (
      <div
        className={`rounded-lg shrink-0 animate-pulse ${className}`}
        style={{ width: size, height: size, background: "rgba(139,92,246,0.12)" }}
      />
    );
  }

  if (src && !(useCustom ? customFailed : chainFailed)) {
    return (
      <img
        src={src}
        alt={`NFT #${tokenId.toString()}`}
        width={size}
        height={size}
        className={`rounded-lg shrink-0 object-cover ${className}`}
        style={{ width: size, height: size, border: "1px solid rgba(139,92,246,0.35)" }}
        onError={() => (useCustom ? setCustomFailed(true) : setChainFailed(true))}
      />
    );
  }

  return (
    <div
      className={`rounded-lg flex items-center justify-center font-grotesk shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.35,
        background: "rgba(139,92,246,0.15)",
        border: "1px solid rgba(139,92,246,0.35)",
        color: "#A78BFA",
      }}
    >
      {letter}
    </div>
  );
}
