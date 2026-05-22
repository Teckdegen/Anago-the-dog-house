import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { NFT_URI_ABI, LIVE_CHAIN_QUERY, parseNftImageSrc } from "@/lib/web3/nftImage";

type Props = {
  contract: `0x${string}`;
  tokenId: bigint;
  size?: number;
  className?: string;
  fallbackLetter?: string;
};

/**
 * Renders the on-chain SVG from tokenURI (Lock / Vesting / Stream Farm NFTs).
 */
export function NftImage({ contract, tokenId, size = 48, className = "", fallbackLetter = "#" }: Props) {
  const [failed, setFailed] = useState(false);

  const uriQ = useReadContract({
    address: contract,
    abi: NFT_URI_ABI,
    functionName: "tokenURI",
    args: [tokenId],
    query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 },
  });

  const src = useMemo(() => parseNftImageSrc(uriQ.data as string | undefined), [uriQ.data]);
  const letter = (fallbackLetter || "#")[0].toUpperCase();

  if (uriQ.isLoading) {
    return (
      <div
        className={`rounded-lg shrink-0 animate-pulse ${className}`}
        style={{ width: size, height: size, background: "rgba(155,127,212,0.12)" }}
      />
    );
  }

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`NFT #${tokenId.toString()}`}
        width={size}
        height={size}
        className={`rounded-lg shrink-0 object-cover ${className}`}
        style={{ width: size, height: size, border: "1px solid rgba(155,127,212,0.35)" }}
        onError={() => setFailed(true)}
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
        background: "rgba(155,127,212,0.15)",
        border: "1px solid rgba(155,127,212,0.35)",
        color: "#C4A8F0",
      }}
    >
      {letter}
    </div>
  );
}
