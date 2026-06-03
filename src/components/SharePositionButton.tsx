import type { MouseEvent } from "react";
import { Share2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { buildPositionShareUrl, type PositionShareKind } from "@/lib/positionShare";
import { stopPositionRowClick } from "@/components/NftExplorerLink";

type Props = {
  kind: PositionShareKind;
  tokenId: bigint;
  className?: string;
};

export function SharePositionButton({ kind, tokenId, className = "" }: Props) {
  const { toast } = useToast();

  const onShare = async (e: MouseEvent) => {
    stopPositionRowClick(e);
    const url = buildPositionShareUrl(kind, tokenId);
    try {
      await navigator.clipboard.writeText(url);
      toast("success", "Link copied", `Position #${tokenId.toString()}`);
    } catch {
      toast("info", "Copy this link", url);
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      title={`Share position #${tokenId.toString()}`}
      aria-label={`Share position #${tokenId.toString()}`}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition hover:bg-[rgba(139,92,246,0.2)] shrink-0 ${className}`}
      style={{ color: "rgba(255,255,255,0.55)", border: "1px solid rgba(139,92,246,0.25)" }}
    >
      <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
    </button>
  );
}
