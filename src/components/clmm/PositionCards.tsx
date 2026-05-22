import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Droplets, Loader2 } from "lucide-react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { TokenIcon } from "@/components/TokenIcon";
import { useToast } from "@/components/Toast";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import {
  UNISWAP_V3,
  type LpPosition,
  buildCollectArgs,
  buildDecreaseArgs,
} from "@/lib/uniswap";
import { NPM_ABI } from "@/lib/uniswap/abis";

export function PositionCards({
  positions,
  loading,
  emptyLabel,
  onRefresh,
}: {
  positions: LpPosition[];
  loading?: boolean;
  emptyLabel?: string;
  onRefresh?: () => void;
}) {
  const { address } = useAccount();

  if (!address) {
    return (
      <p className="font-mono text-[11px] py-6 text-center" style={{ color: "rgba(196,168,240,0.55)" }}>
        Connect wallet to view positions
      </p>
    );
  }

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#C4A8F0" }} />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <p className="font-mono text-[11px] py-8 text-center" style={{ color: "rgba(196,168,240,0.5)" }}>
        {emptyLabel ?? "No LP positions found — add liquidity or scan again"}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((pos) => (
        <PositionCard key={pos.tokenId.toString()} position={pos} onDone={onRefresh} />
      ))}
    </div>
  );
}

function PositionCard({ position: pos, onDone }: { position: LpPosition; onDone?: () => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const collectTx = useWriteContract();
  const decreaseTx = useWriteContract();
  const collectRcpt = useWaitForTransactionReceipt({ hash: collectTx.data });
  const decreaseRcpt = useWaitForTransactionReceipt({ hash: decreaseTx.data });

  const hasOwed = pos.tokensOwed0 > 0n || pos.tokensOwed1 > 0n;
  const canRemove = pos.liquidity > 0n;

  const runCollect = async () => {
    if (!address || !publicClient) return;
    setBusy(true);
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      collectTx.writeContract({
        address: UNISWAP_V3.positionManager,
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
        address: UNISWAP_V3.positionManager,
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

  useEffect(() => {
    if (collectRcpt.isSuccess) {
      setBusy(false);
      toast("success", "Fees claimed", `#${pos.tokenId.toString()}`);
      onDone?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectRcpt.isSuccess]);

  useEffect(() => {
    if (decreaseRcpt.isSuccess) {
      setBusy(false);
      toast("success", "Liquidity removed", `#${pos.tokenId.toString()}`);
      onDone?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decreaseRcpt.isSuccess]);

  const pending =
    busy || collectTx.isPending || collectRcpt.isLoading || decreaseTx.isPending || decreaseRcpt.isLoading;

  return (
    <div
      className="rounded-xl p-4"
      style={{ border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.04)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <TokenIcon address={pos.token0} symbol={pos.token0Symbol} size={24} />
          <span className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.5)" }}>/</span>
          <TokenIcon address={pos.token1} symbol={pos.token1Symbol} size={24} />
          <span className="font-grotesk text-[12px] ml-1 truncate" style={{ color: "#EDE0FF" }}>
            {pos.token0Symbol}/{pos.token1Symbol}
          </span>
        </div>
        <span className="font-mono text-[9px] shrink-0" style={{ color: "rgba(196,168,240,0.45)" }}>
          NFT #{pos.tokenId.toString()}
        </span>
      </div>
      <p className="font-mono text-[9px] mb-2" style={{ color: "rgba(196,168,240,0.4)" }}>
        Ticks {pos.tickLower} → {pos.tickUpper} · Liq {pos.liquidity.toString()}
      </p>
      {hasOwed && (
        <p className="font-mono text-[10px] mb-3 flex items-center gap-1" style={{ color: "#C4A8F0" }}>
          <Coins className="w-3.5 h-3.5" />
          Owed: {formatUnits(pos.tokensOwed0, pos.token0Decimals)} {pos.token0Symbol} +{" "}
          {formatUnits(pos.tokensOwed1, pos.token1Decimals)} {pos.token1Symbol}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={runCollect}
          disabled={pending}
          className="px-3 py-1.5 rounded-lg font-grotesk text-[10px] uppercase tracking-wider disabled:opacity-40"
          style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.45)" }}
        >
          {pending && collectTx.isPending ? "Claiming…" : "Claim fees"}
        </button>
        {canRemove && (
          <button
            onClick={runDecrease}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg font-grotesk text-[10px] uppercase tracking-wider disabled:opacity-40"
            style={{ border: "1px solid rgba(155,127,212,0.35)", color: "rgba(196,168,240,0.75)" }}
          >
            Remove all liquidity
          </button>
        )}
        <Link
          to="/clmm/pool/$poolAddress"
          params={{ poolAddress: pos.poolAddress }}
          className="px-3 py-1.5 rounded-lg font-grotesk text-[10px] uppercase tracking-wider inline-flex items-center gap-1"
          style={{ border: "1px solid rgba(155,127,212,0.25)", color: "rgba(196,168,240,0.55)" }}
        >
          <Droplets className="w-3 h-3" /> Pool
        </Link>
      </div>
    </div>
  );
}
