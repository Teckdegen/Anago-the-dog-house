import { useCallback } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useChainId } from "wagmi";
import { explorerNftUrl } from "@/lib/web3/explorer";

export function useNftExplorerUrl(
  contract: `0x${string}`,
  tokenId: bigint | string | number,
): string {
  const chainId = useChainId();
  return explorerNftUrl(contract, tokenId, chainId);
}

export function useOpenNftExplorer(
  contract: `0x${string}`,
  tokenId: bigint | string | number,
) {
  const href = useNftExplorerUrl(contract, tokenId);
  return useCallback(() => {
    window.open(href, "_blank", "noopener,noreferrer");
  }, [href]);
}

/** Prevent action buttons from triggering the position row explorer click. */
export function stopPositionRowClick(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

export function positionExplorerRowProps(open: () => void, className = "") {
  return {
    role: "link" as const,
    tabIndex: 0,
    onClick: open,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    },
    className: `cursor-pointer ${className}`.trim(),
    title: "View on MonadScan",
  };
}
