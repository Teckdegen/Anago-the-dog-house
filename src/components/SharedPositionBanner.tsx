import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { PositionShareKind } from "@/lib/positionShare";

type Props = {
  kind: PositionShareKind;
  tokenId: bigint;
  loading?: boolean;
  notFound?: boolean;
  children?: ReactNode;
};

const CLEAR_TO: Record<PositionShareKind, string> = {
  lock: "/lock",
  vesting: "/vesting",
  farm: "/farm",
  clmm: "/clmm",
};

export function SharedPositionBanner({ kind, tokenId, loading, notFound, children }: Props) {
  return (
    <div
      className="rounded-xl overflow-hidden mb-5"
      style={{ border: "1px solid rgba(167,139,250,0.5)", background: "rgba(139,92,246,0.08)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(139,92,246,0.2)" }}>
        <div className="min-w-0">
          <p className="font-grotesk text-[11px] uppercase tracking-wider" style={{ color: "#C4B5FD" }}>
            Shared position
          </p>
          <p className="font-mono text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
            #{tokenId.toString()} · loaded from chain
          </p>
        </div>
        <Link
          to={CLEAR_TO[kind]}
          search={{}}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 transition hover:bg-[rgba(255,255,255,0.08)]"
          style={{ color: "rgba(255,255,255,0.5)" }}
          title="Close shared view"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </Link>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(139,92,246,0.2)", borderTopColor: "#8B5CF6" }}
            />
          </div>
        ) : notFound ? (
          <p className="font-mono text-[11px] text-center py-6" style={{ color: "rgba(255,255,255,0.55)" }}>
            Position #{tokenId.toString()} was not found. It may have been withdrawn, burned, or never existed.
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
