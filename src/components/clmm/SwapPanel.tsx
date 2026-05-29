import { useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits, maxUint256 } from "viem";
import { clmm } from "@/components/clmm/clmmTheme";
import { useToast } from "@/components/Toast";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import {
  CAPRICORN_CL,
  quoteExactInputSingle,
  buildExactInputSingleArgs,
  type CachedPool,
  type PoolLiveState,
} from "@/lib/capricorn";
import { SWAP_ROUTER_ABI } from "@/lib/capricorn/abis";

export function SwapPanel({
  pool,
  live,
  onClose,
  compact,
}: {
  pool: CachedPool;
  live: PoolLiveState;
  onClose?: () => void;
  /** Sidebar layout on pool page */
  compact?: boolean;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const [amountIn, setAmountIn] = useState("");
  const [quoteOut, setQuoteOut] = useState<bigint | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [zeroForOne, setZeroForOne] = useState(true);
  const autoSwapRef = useRef(false);

  const approveTx = useWriteContract();
  const swapTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const swapRcpt = useWaitForTransactionReceipt({ hash: swapTx.data });

  const tokenIn = zeroForOne ? live.pool.token0 : live.pool.token1;
  const tokenOut = zeroForOne ? live.pool.token1 : live.pool.token0;
  const decimalsIn = zeroForOne ? live.token0Decimals : live.token1Decimals;
  const decimalsOut = zeroForOne ? live.token1Decimals : live.token0Decimals;
  const symbolIn = zeroForOne ? live.token0Symbol : live.token1Symbol;
  const symbolOut = zeroForOne ? live.token1Symbol : live.token0Symbol;

  const parsedIn = (() => {
    try {
      return amountIn ? parseUnits(amountIn, decimalsIn) : 0n;
    } catch {
      return 0n;
    }
  })();

  useEffect(() => {
    if (!publicClient || parsedIn === 0n) {
      setQuoteOut(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(async () => {
      const out = await quoteExactInputSingle(publicClient, tokenIn, tokenOut, pool.fee, parsedIn);
      if (!cancelled) {
        setQuoteOut(out);
        setQuoting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [parsedIn, tokenIn, tokenOut, pool.fee, publicClient]);

  const allowanceQ = useReadContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && tokenIn ? [address, CAPRICORN_CL.swapRouter as `0x${string}`] : undefined,
    query: { enabled: !!address && !!tokenIn },
  });
  const needsApproval = parsedIn > 0n && ((allowanceQ.data as bigint | undefined) ?? 0n) < parsedIn;

  const runSwap = async () => {
    if (!address || !publicClient || parsedIn === 0n) return;
    const gas = await prepareTransactionWithGas(publicClient);
    swapTx.writeContract({
      address: CAPRICORN_CL.swapRouter as `0x${string}`,
      abi: SWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        buildExactInputSingleArgs({
          tokenIn,
          tokenOut,
          fee: pool.fee,
          recipient: address,
          amountIn: parsedIn,
          amountOutMinimum: quoteOut ? (quoteOut * 95n) / 100n : 0n,
        }),
      ],
      ...gas,
    });
  };

  useEffect(() => {
    if (!approveRcpt.isSuccess || !autoSwapRef.current) return;
    autoSwapRef.current = false;
    runSwap().catch(() => toast("error", "Swap failed", ""));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  useEffect(() => {
    if (swapRcpt.isSuccess) {
      toast("success", "Swap complete", `${symbolIn} → ${symbolOut}`);
      setAmountIn("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapRcpt.isSuccess]);

  const busy = approveTx.isPending || approveRcpt.isLoading || swapTx.isPending || swapRcpt.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="font-grotesk text-[12px] uppercase" style={{ color: clmm.text }}>
          Swap
        </p>
        {onClose && !compact && (
          <button type="button" onClick={onClose} className="font-mono text-[9px]" style={{ color: clmm.accent }}>
            Close
          </button>
        )}
      </div>
      {!address ? (
        <p className="font-mono text-[11px]" style={{ color: clmm.textMuted }}>
          Connect wallet to swap
        </p>
      ) : (
        <>
          <button type="button" onClick={() => setZeroForOne((z) => !z)} className="font-mono text-[9px]" style={{ color: clmm.accent }}>
            Flip direction
          </button>
          <input
            type="text"
            inputMode="decimal"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={`0.0 ${symbolIn}`}
            className="w-full rounded-xl px-4 py-3 font-grotesk text-[18px] outline-none"
            style={{ color: clmm.text, border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}
          />
          <p className="font-mono text-[12px]" style={{ color: clmm.text }}>
            {quoting ? "Quoting…" : quoteOut != null ? `→ ${formatUnits(quoteOut, decimalsOut)} ${symbolOut}` : "—"}
          </p>
          <button
            type="button"
            onClick={() => {
              if (!address) return;
              if (needsApproval && publicClient) {
                autoSwapRef.current = true;
                prepareTransactionWithGas(publicClient).then((gas) =>
                  approveTx.writeContract({
                    address: tokenIn,
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [CAPRICORN_CL.swapRouter as `0x${string}`, maxUint256],
                    ...gas,
                  }),
                );
              } else runSwap().catch((e) => toast("error", "Swap failed", (e as Error).message));
            }}
            disabled={busy || parsedIn === 0n || quoteOut == null}
            className="w-full py-3.5 rounded-2xl font-grotesk text-[11px] uppercase disabled:opacity-40"
            style={{
              background: compact ? clmm.purpleBtn : clmm.purpleSolid,
              color: compact ? "#000000" : clmm.text,
              border: compact ? "none" : `1px solid ${clmm.borderStrong}`,
            }}
          >
            {busy ? "Working…" : needsApproval ? "Approve & Swap" : "Swap"}
          </button>
        </>
      )}
    </div>
  );
}
