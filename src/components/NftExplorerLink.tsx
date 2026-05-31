import { ExternalLink } from "lucide-react";
import { useChainId } from "wagmi";
import { explorerNftUrl } from "@/lib/web3/explorer";

type Props = {
  contract: `0x${string}`;
  tokenId: bigint | string | number;
  /** Accessible label override */
  label?: string;
  className?: string;
  /** Show "MonadScan" text beside icon */
  showLabel?: boolean;
};

export function NftExplorerLink({
  contract,
  tokenId,
  label,
  className = "",
  showLabel = false,
}: Props) {
  const chainId = useChainId();
  const idStr = typeof tokenId === "bigint" ? tokenId.toString() : String(tokenId);
  const href = explorerNftUrl(contract, tokenId, chainId);
  const aria =
    label ?? `View NFT #${idStr} on MonadScan`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={aria}
      aria-label={aria}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition hover:bg-[rgba(139,92,246,0.2)] ${className}`}
      style={{ color: "#A78BFA", border: "1px solid rgba(139,92,246,0.35)" }}
    >
      {showLabel && <span>MonadScan</span>}
      <ExternalLink className="w-3 h-3" strokeWidth={2} />
    </a>
  );
}
