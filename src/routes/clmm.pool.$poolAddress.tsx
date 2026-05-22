import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDownUp,
  Droplets,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, maxUint256, isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { PoolPairHeader } from "@/components/clmm/PoolPairHeader";
import { PositionCards } from "@/components/clmm/PositionCards";
import { AddLiquidityPanel } from "@/components/clmm/AddLiquidityPanel";
import { useToast } from "@/components/Toast";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import {
  UNISWAP_V3,
  isUniswapSupportedChain,
  fetchPoolLiveState,
  resolvePoolByAddress,
  quoteExactInputSingle,
  buildExactInputSingleArgs,
  fetchUserPositions,
  positionMatchesPool,
  type CachedPool,
  type PoolLiveState,
  type ClmmTab,
  type LpPosition,
} from "@/lib/uniswap";
import { SWAP_ROUTER_ABI } from "@/lib/uniswap/abis";

export const Route = createFileRoute("/clmm/pool/$poolAddress")({
  component: ClmmPoolPage,
  head: () => ({
    meta: [{ title: "CLMM Pool — Uniswap V3 on Monad" }],
  }),
});

function ClmmPoolPage() {
  const { poolAddress: poolParam } = Route.useParams();
  const chainId = useChainId();
  const supported = isUniswapSupportedChain(chainId);
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const poolAddress = isAddress(poolParam) ? (poolParam as `0x${string}`) : undefined;

  const [pool, setPool] = useState<CachedPool | null>(null);
  const [live, setLive] = useState<PoolLiveState | null>(null);
  const [tab, setTab] = useState<ClmmTab>("swap");
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const [posMsg, setPosMsg] = useState("");

  useEffect(() => {
    if (!publicClient || !poolAddress) return;
    resolvePoolByAddress(publicClient, poolAddress).then(setPool);
  }, [publicClient, poolAddress]);

  useEffect(() => {
    if (!publicClient || !pool) return;
    let cancelled = false;
    fetchPoolLiveState(publicClient, pool).then((s) => {
      if (!cancelled) setLive(s);
    });
    const id = setInterval(() => {
      fetchPoolLiveState(publicClient, pool).then((s) => {
        if (!cancelled) setLive(s);
      });
    }, 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pool, publicClient]);

  const refreshPositions = useCallback(async () => {
    if (!publicClient || !address || !poolAddress) return;
    setLoadingPos(true);
    try {
      const all = await fetchUserPositions(publicClient, address, setPosMsg);
      setPositions(all.filter((p) => positionMatchesPool(p, poolAddress)));
    } finally {
      setLoadingPos(false);
      setPosMsg("");
    }
  }, [publicClient, address, poolAddress]);

  useEffect(() => {
    if (address && (tab === "positions" || tab === "liquidity")) refreshPositions();
  }, [address, tab, refreshPositions]);

  if (!supported) {
    return (
      <AppShell>
        <div className="max-w-[680px] mx-auto px-5 pt-12 pb-20 text-center">
          <p className="font-grotesk text-[18px] uppercase" style={{ color: "#EDE0FF" }}>
            Switch to Monad Mainnet (chain 143)
          </p>
        </div>
      </AppShell>
    );
  }

  if (!poolAddress) {
    return (
      <AppShell>
        <div className="max-w-[680px] mx-auto px-5 pt-12 text-center font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.55)" }}>
          Invalid pool address
        </div>
      </AppShell>
    );
  }

  const tabs: { id: ClmmTab; label: string; icon: typeof TrendingUp }[] = [
    { id: "swap", label: "Swap", icon: TrendingUp },
    { id: "positions", label: "My Positions", icon: Layers },
    { id: "liquidity", label: "Add Liquidity", icon: Droplets },
  ];

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto px-5 sm:px-8 pt-8 pb-20">
        <Link
          to="/clmm"
          className="inline-flex items-center gap-2 font-mono text-[10px] mb-5 hover:underline"
          style={{ color: "rgba(196,168,240,0.55)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All pools
        </Link>

        {!pool || !live ? (
          <div className="rounded-xl p-10 text-center animate-pulse" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
            <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.5)" }}>Loading pool…</p>
          </div>
        ) : (
          <>
            <PoolPairHeader live={live} poolAddress={poolAddress} />

            <div className="flex gap-1 mt-5 p-1 rounded-xl" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}>
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-grotesk text-[10px] uppercase tracking-wider transition"
                  style={{
                    background: tab === id ? "rgba(155,127,212,0.25)" : "transparent",
                    color: tab === id ? "#EDE0FF" : "rgba(196,168,240,0.5)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            <div
              className="mt-4 rounded-xl p-5"
              style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}
            >
              {tab === "swap" && <SwapPanel pool={pool} live={live} />}
              {tab === "positions" && (
                <>
                  {posMsg && (
                    <p className="font-mono text-[9px] mb-3" style={{ color: "rgba(196,168,240,0.45)" }}>{posMsg}</p>
                  )}
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={refreshPositions}
                      disabled={loadingPos}
                      className="font-mono text-[9px] px-3 py-1 rounded-lg uppercase"
                      style={{ border: "1px solid rgba(155,127,212,0.35)", color: "#C4A8F0" }}
                    >
                      {loadingPos ? "Scanning…" : "Refresh positions"}
                    </button>
                  </div>
                  <PositionCards
                    positions={positions}
                    loading={loadingPos}
                    emptyLabel="No positions in this pool — add liquidity or scan wallet NFTs"
                    onRefresh={refreshPositions}
                  />
                </>
              )}
              {tab === "liquidity" && <AddLiquidityPanel live={live} />}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function SwapPanel({ pool, live }: { pool: CachedPool; live: PoolLiveState }) {
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
    args: address && tokenIn ? [address, UNISWAP_V3.swapRouter02] : undefined,
    query: { enabled: !!address && !!tokenIn },
  });
  const allowance = (allowanceQ.data as bigint | undefined) ?? 0n;
  const needsApproval = parsedIn > 0n && allowance < parsedIn;

  const runSwap = async () => {
    if (!address || !publicClient || parsedIn === 0n) return;
    const minOut = quoteOut ? (quoteOut * 95n) / 100n : 0n;
    const gas = await prepareTransactionWithGas(publicClient);
    swapTx.writeContract({
      address: UNISWAP_V3.swapRouter02,
      abi: SWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        buildExactInputSingleArgs({
          tokenIn,
          tokenOut,
          fee: pool.fee,
          recipient: address,
          amountIn: parsedIn,
          amountOutMinimum: minOut,
        }),
      ],
      ...gas,
    });
  };

  useEffect(() => {
    if (!approveRcpt.isSuccess || !autoSwapRef.current) return;
    autoSwapRef.current = false;
    runSwap().catch(() => toast("error", "Swap failed", "Could not submit swap after approval"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  useEffect(() => {
    if (swapRcpt.isSuccess) {
      toast("success", "Swap complete", `${symbolIn} → ${symbolOut}`);
      setAmountIn("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapRcpt.isSuccess]);

  const handleSwap = async () => {
    if (!address) return;
    if (needsApproval && publicClient) {
      autoSwapRef.current = true;
      const gas = await prepareTransactionWithGas(publicClient);
      approveTx.writeContract({
        address: tokenIn,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [UNISWAP_V3.swapRouter02, maxUint256],
        ...gas,
      });
    } else {
      runSwap().catch((e) => toast("error", "Swap failed", (e as Error).message));
    }
  };

  const busy = approveTx.isPending || approveRcpt.isLoading || swapTx.isPending || swapRcpt.isLoading;

  if (!address) {
    return (
      <p className="font-mono text-[11px] flex items-center gap-2" style={{ color: "rgba(196,168,240,0.55)" }}>
        <Wallet className="w-4 h-4" /> Connect wallet to swap
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-grotesk text-[12px] uppercase tracking-wider flex items-center gap-2" style={{ color: "#EDE0FF" }}>
          <ArrowDownUp className="w-4 h-4" /> Swap
        </p>
        <button
          onClick={() => setZeroForOne((z) => !z)}
          className="font-mono text-[9px] px-2 py-1 rounded"
          style={{ border: "1px solid rgba(155,127,212,0.35)", color: "#C4A8F0" }}
        >
          Flip
        </button>
      </div>
      <div>
        <label className="font-mono text-[9px] uppercase" style={{ color: "rgba(196,168,240,0.5)" }}>
          Pay · {symbolIn}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.0"
          className="w-full mt-1 rounded-xl px-4 py-3 font-grotesk text-[18px] outline-none"
          style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
        />
      </div>
      <div className="rounded-lg px-3 py-2" style={{ background: "rgba(155,127,212,0.08)" }}>
        <p className="font-mono text-[9px] uppercase" style={{ color: "rgba(196,168,240,0.45)" }}>Receive (QuoterV2)</p>
        <p className="font-mono text-[14px] mt-0.5" style={{ color: "#EDE0FF" }}>
          {quoting
            ? "Quoting…"
            : quoteOut != null
              ? `${formatUnits(quoteOut, decimalsOut)} ${symbolOut}`
              : parsedIn > 0n
                ? "No quote"
                : "—"}
        </p>
      </div>
      <button
        onClick={handleSwap}
        disabled={busy || parsedIn === 0n || quoteOut == null}
        className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase disabled:opacity-40"
        style={{ background: "rgba(155,127,212,0.22)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
      >
        {busy ? "Working…" : needsApproval ? "Approve & Swap" : "Swap"}
      </button>
    </div>
  );
}
