import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { TokenIcon } from "@/components/TokenIcon";
import { useToast } from "@/components/Toast";
import { SuccessModal } from "@/components/SuccessModal";
import { useTransactionSuccess } from "@/lib/web3/useTransactionSuccess";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import {
  type LpPosition,
  buildCollectArgs,
  buildDecreaseArgs,
  CAPRICORN_CL,
} from "@/lib/capricorn";
import { NPM_ABI } from "@/lib/capricorn/abis";
import { clmm } from "./clmmTheme";
import { useOpenNftExplorer, stopPositionRowClick } from "@/components/NftExplorerLink";
import { SharePositionButton } from "@/components/SharePositionButton";

export function PositionCards({
  positions,
  loading,
  emptyLabel,
  layout = "stack",
  requireWallet = true,
}: {
  positions: LpPosition[];
  loading?: boolean;
  emptyLabel?: string;
  layout?: "stack" | "grid";
  /** When false, show on-chain position data without a connected wallet (shared links). */
  requireWallet?: boolean;
}) {
  const { address } = useAccount();

  if (requireWallet && !address) {
    return (
      <p className="font-mono text-[12px] py-12 text-center" style={{ color: clmm.textMuted }}>
        Connect wallet to view positions
      </p>
    );
  }

  if (loading && positions.length === 0) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: clmm.accent }} />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="font-mono text-[12px]" style={{ color: clmm.textMuted }}>
          {emptyLabel ?? "No LP positions found"}
        </p>
        <Link
          to="/clmm"
          className="inline-block font-grotesk text-[11px] uppercase px-5 py-2.5 rounded-full"
          style={{ border: `1px solid ${clmm.borderStrong}`, color: clmm.text }}
        >
          Explore pools
        </Link>
      </div>
    );
  }

  const gridClass =
    layout === "grid"
      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      : "space-y-3";

  return (
    <div className={gridClass}>
      {positions.map((pos) => (
        <PositionCard key={pos.tokenId.toString()} position={pos} />
      ))}
    </div>
  );
}

function PositionCard({ position: pos }: { position: LpPosition }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successConfig, setSuccessConfig] = useState<{
    heading: string;
    subtext: string;
    rows: { label: string; value: string }[];
  } | null>(null);
  const positionManager = CAPRICORN_CL.positionManager as `0x${string}`;

  const collectTx = useWriteContract();
  const decreaseTx = useWriteContract();
  const collectRcpt = useWaitForTransactionReceipt({ hash: collectTx.data });
  const decreaseRcpt = useWaitForTransactionReceipt({ hash: decreaseTx.data });

  const hasOwed = pos.tokensOwed0 > 0n || pos.tokensOwed1 > 0n;
  const canRemove = pos.liquidity > 0n;
  const owed0Label = formatTokenAmount(pos.tokensOwed0, pos.token0Decimals);
  const owed1Label = formatTokenAmount(pos.tokensOwed1, pos.token1Decimals);
  const openExplorer = useOpenNftExplorer(positionManager, pos.tokenId);

  const runCollect = async () => {
    if (!address || !publicClient) return;
    setBusy(true);
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      collectTx.writeContract({
        address: positionManager,
        abi: NPM_ABI,
        functionName: "collect",
        args: [buildCollectArgs(pos.tokenId, address)],
        ...gas,
      });
    } catch (e) {
      setBusy(false);
      toast("error", "Claim failed", (e as Error).message);
    }
  };

  const runDecrease = async () => {
    if (!address || !publicClient || pos.liquidity === 0n) return;
    setBusy(true);
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      decreaseTx.writeContract({
        address: positionManager,
        abi: NPM_ABI,
        functionName: "decreaseLiquidity",
        args: [buildDecreaseArgs({ tokenId: pos.tokenId, liquidity: pos.liquidity })],
        ...gas,
      });
    } catch (e) {
      setBusy(false);
      toast("error", "Remove failed", (e as Error).message);
    }
  };

  useTransactionSuccess(collectTx, collectRcpt, () => {
    setBusy(false);
    setSuccessConfig({
      heading: "Fees Claimed",
      subtext: "Accrued fees have been sent to your wallet.",
      rows: [
        { label: "Position", value: `#${pos.tokenId.toString()}` },
        { label: "Token 0", value: `${owed0Label} ${pos.token0Symbol}` },
        { label: "Token 1", value: `${owed1Label} ${pos.token1Symbol}` },
      ],
    });
    setSuccessOpen(true);
  });

  useTransactionSuccess(decreaseTx, decreaseRcpt, () => {
    setBusy(false);
    setSuccessConfig({
      heading: "Liquidity Removed",
      subtext: "Your liquidity has been withdrawn from the pool.",
      rows: [{ label: "Position", value: `#${pos.tokenId.toString()}` }],
    });
    setSuccessOpen(true);
  });

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    setSuccessConfig(null);
    collectTx.reset();
    decreaseTx.reset();
  };

  const pending =
    busy || collectTx.isPending || collectRcpt.isLoading || decreaseTx.isPending || decreaseRcpt.isLoading;

  return (
    <>
      {successConfig && (
        <SuccessModal
          open={successOpen}
          onClose={handleSuccessClose}
          title="CLMM Positions"
          heading={successConfig.heading}
          subtext={successConfig.subtext}
          rows={successConfig.rows}
        />
      )}
    <div
      className="rounded-xl p-5 flex flex-col h-full cursor-pointer transition hover:bg-[rgba(139,92,246,0.06)]"
      style={{ border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}
      onClick={openExplorer}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openExplorer();
        }
      }}
      role="link"
      tabIndex={0}
      title="View on MonadScan"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex shrink-0">
          <TokenIcon address={pos.token0} symbol={pos.token0Symbol} size={32} />
          <div className="absolute -right-2 top-2">
            <TokenIcon address={pos.token1} symbol={pos.token1Symbol} size={32} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-grotesk text-[15px] font-medium truncate" style={{ color: clmm.text }}>
            {pos.token0Symbol}/{pos.token1Symbol}
          </p>
          <p className="font-mono text-[9px]" style={{ color: clmm.textDim }}>
            NFT #{pos.tokenId.toString()}
          </p>
        </div>
        <div onClick={stopPositionRowClick}>
          <SharePositionButton kind="clmm" tokenId={pos.tokenId} />
        </div>
      </div>

      <div className="font-mono text-[10px] space-y-1 mb-4 flex-1" style={{ color: clmm.textMuted }}>
        <p>
          Ticks {pos.tickLower} → {pos.tickUpper}
        </p>
        <p>Liquidity {pos.liquidity.toString()}</p>
        <div className="mt-2 rounded-lg p-2.5 space-y-2" style={{ border: `1px solid ${clmm.border}` }}>
          <p className="text-[9px] uppercase" style={{ color: hasOwed ? clmm.accent : clmm.textDim }}>
            Unclaimed Fees
          </p>
          <div className="flex items-center justify-between gap-3">
            <span>{pos.token0Symbol}</span>
            <span style={{ color: hasOwed ? clmm.text : clmm.textDim }}>{owed0Label}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>{pos.token1Symbol}</span>
            <span style={{ color: hasOwed ? clmm.text : clmm.textDim }}>{owed1Label}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: `1px solid ${clmm.border}` }} onClick={stopPositionRowClick}>
        <button
          type="button"
          onClick={runCollect}
          disabled={pending}
          className="px-3 py-2 rounded-lg font-grotesk text-[10px] uppercase tracking-wider disabled:opacity-40"
          style={{ background: clmm.purpleSolid, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }}
        >
          {pending && collectTx.isPending ? "Claiming…" : "Claim fees"}
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={runDecrease}
            disabled={pending}
            className="px-3 py-2 rounded-lg font-grotesk text-[10px] uppercase tracking-wider disabled:opacity-40"
            style={{ border: `1px solid ${clmm.border}`, color: clmm.textMuted }}
          >
            Remove liquidity
          </button>
        )}
        <Link
          to="/clmm/pool/$poolAddress"
          params={{ poolAddress: pos.poolAddress }}
          className="px-3 py-2 rounded-lg font-grotesk text-[10px] uppercase tracking-wider ml-auto"
          style={{ border: `1px solid ${clmm.border}`, color: clmm.accent }}
        >
          Manage pool
        </Link>
      </div>
    </div>
    </>
  );
}

function formatTokenAmount(amount: bigint, decimals: number): string {
  const raw = formatUnits(amount, decimals);
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  if (n < 0.000001) return "<0.000001";
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}
