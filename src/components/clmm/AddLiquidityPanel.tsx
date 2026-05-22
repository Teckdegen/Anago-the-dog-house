import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, maxUint256 } from "viem";
import { useToast } from "@/components/Toast";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import {
  UNISWAP_V3,
  buildMintArgs,
  type PoolLiveState,
} from "@/lib/uniswap";
import { NPM_ABI } from "@/lib/uniswap/abis";

export function AddLiquidityPanel({ live }: { live: PoolLiveState }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();

  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const stepRef = useRef<"idle" | "t0" | "t1" | "mint">("idle");

  const approveTx = useWriteContract();
  const mintTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const mintRcpt = useWaitForTransactionReceipt({ hash: mintTx.data });

  const parsed0 = safeParse(amount0, live.token0Decimals);
  const parsed1 = safeParse(amount1, live.token1Decimals);

  const allow0 = useReadContract({
    address: live.pool.token0,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, UNISWAP_V3.positionManager] : undefined,
    query: { enabled: !!address && parsed0 > 0n },
  });
  const allow1 = useReadContract({
    address: live.pool.token1,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, UNISWAP_V3.positionManager] : undefined,
    query: { enabled: !!address && parsed1 > 0n },
  });

  const needs0 = parsed0 > 0n && ((allow0.data as bigint | undefined) ?? 0n) < parsed0;
  const needs1 = parsed1 > 0n && ((allow1.data as bigint | undefined) ?? 0n) < parsed1;

  const runMint = async () => {
    if (!address || !publicClient || (parsed0 === 0n && parsed1 === 0n)) return;
    const gas = await prepareTransactionWithGas(publicClient);
    mintTx.writeContract({
      address: UNISWAP_V3.positionManager,
      abi: NPM_ABI,
      functionName: "mint",
      args: [
        buildMintArgs({
          live,
          recipient: address,
          amount0Desired: parsed0,
          amount1Desired: parsed1,
        }),
      ],
      ...gas,
    });
  };

  const approve = async (token: `0x${string}`) => {
    if (!publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    approveTx.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [UNISWAP_V3.positionManager, maxUint256],
      ...gas,
    });
  };

  useEffect(() => {
    if (!approveRcpt.isSuccess || stepRef.current === "idle") return;
    if (stepRef.current === "t0" && needs1) {
      stepRef.current = "t1";
      approve(live.pool.token1).catch((e) => toast("error", "Approve failed", (e as Error).message));
    } else {
      stepRef.current = "mint";
      runMint().catch((e) => toast("error", "Mint failed", (e as Error).message));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  useEffect(() => {
    if (mintRcpt.isSuccess) {
      stepRef.current = "idle";
      toast("success", "Liquidity added", "Position NFT minted");
      setAmount0("");
      setAmount1("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintRcpt.isSuccess]);

  const handleAdd = () => {
    if (!address) return;
    if (parsed0 === 0n && parsed1 === 0n) {
      toast("error", "Enter amount", "Provide at least one token");
      return;
    }
    if (needs0) {
      stepRef.current = "t0";
      approve(live.pool.token0).catch((e) => toast("error", "Approve failed", (e as Error).message));
    } else if (needs1) {
      stepRef.current = "t1";
      approve(live.pool.token1).catch((e) => toast("error", "Approve failed", (e as Error).message));
    } else {
      runMint().catch((e) => toast("error", "Mint failed", (e as Error).message));
    }
  };

  const busy = approveTx.isPending || approveRcpt.isLoading || mintTx.isPending || mintRcpt.isLoading;
  const label = needs0 || needs1 ? "Approve & Add Liquidity" : "Add Liquidity";

  if (!address) {
    return (
      <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.55)" }}>
        Connect wallet to add liquidity
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.5)" }}>
        Wide range around current tick · NonfungiblePositionManager mint
      </p>
      <AmountField label={live.token0Symbol} value={amount0} onChange={setAmount0} />
      <AmountField label={live.token1Symbol} value={amount1} onChange={setAmount1} />
      <button
        onClick={handleAdd}
        disabled={busy || (parsed0 === 0n && parsed1 === 0n)}
        className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider disabled:opacity-40"
        style={{ background: "rgba(155,127,212,0.22)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
      >
        {busy ? "Working…" : label}
      </button>
      {(approveTx.error || mintTx.error) && (
        <p className="font-mono text-[9px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
          {(approveTx.error || mintTx.error)?.message}
        </p>
      )}
      <p className="font-mono text-[8px] flex items-center gap-1" style={{ color: "rgba(196,168,240,0.35)" }}>
        <Plus className="w-3 h-3" /> NPM {UNISWAP_V3.positionManager.slice(0, 10)}…
      </p>
    </div>
  );
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0.0"
        className="w-full mt-1 rounded-xl px-4 py-3 font-grotesk text-[16px] outline-none"
        style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
      />
    </div>
  );
}

function safeParse(v: string, decimals: number): bigint {
  try {
    return v ? parseUnits(v, decimals) : 0n;
  } catch {
    return 0n;
  }
}
