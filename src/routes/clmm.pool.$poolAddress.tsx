import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownUp, Wallet } from "lucide-react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, maxUint256, isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { PoolDetailView } from "@/components/clmm/PoolDetailView";
import { PositionCards } from "@/components/clmm/PositionCards";
import { ClmmNetworkGate } from "@/components/clmm/SwitchToMonadMainnet";
import { clmm } from "@/components/clmm/clmmTheme";
import { useToast } from "@/components/Toast";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import {
  UNISWAP_V3,
  fetchPoolLiveState,
  resolvePoolByAddress,
  quoteExactInputSingle,
  buildExactInputSingleArgs,
  fetchUserPositions,
  positionMatchesPool,
  fetchPoolMetrics,
  enrichFromCache,
  type CachedPool,
  type PoolLiveState,
  type LpPosition,
  type PoolMetrics,
} from "@/lib/uniswap";
import { SWAP_ROUTER_ABI } from "@/lib/uniswap/abis";

export const Route = createFileRoute("/clmm/pool/$poolAddress")({
  component: ClmmPoolPage,
});

type Panel = "overview" | "swap" | "positions";

function ClmmPoolPage() {
  const { poolAddress: poolParam } = Route.useParams();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const poolAddress = isAddress(poolParam) ? (poolParam as `0x${string}`) : undefined;
  const [pool, setPool] = useState<CachedPool | null>(null);
  const [live, setLive] = useState<PoolLiveState | null>(null);
  const [metrics, setMetrics] = useState<PoolMetrics | null>(null);
  const [panel, setPanel] = useState<Panel>("overview");
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);

  useEffect(() => {
    if (!publicClient || !poolAddress) return;
    resolvePoolByAddress(publicClient, poolAddress).then(async (p) => {
      if (!p) return;
      setPool(p);
      setMetrics(enrichFromCache(p).metrics);
      fetchPoolMetrics(p, publicClient).then(setMetrics);
      fetchPoolLiveState(publicClient, p).then(setLive);
    });
  }, [publicClient, poolAddress]);

  useEffect(() => {
    if (!publicClient || !pool) return;
    const tick = () => fetchPoolLiveState(publicClient, pool).then((s) => s && setLive(s));
    tick();
    const id = setInterval(tick, 12_000);
    return () => clearInterval(id);
  }, [publicClient, pool]);

  const refreshPositions = useCallback(async () => {
    if (!publicClient || !address || !poolAddress) return;
    setLoadingPos(true);
    try {
      const all = await fetchUserPositions(publicClient, address);
      setPositions(all.filter((p) => positionMatchesPool(p, poolAddress)));
    } finally {
      setLoadingPos(false);
    }
  }, [publicClient, address, poolAddress]);

  useEffect(() => {
    if (panel === "positions" && address) refreshPositions();
  }, [panel, address, refreshPositions]);

  if (!poolAddress) {
    return (
      <AppShell>
        <p className="text-center pt-20 font-mono text-[11px]" style={{ color: clmm.textMuted }}>
          Invalid pool address
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ClmmNetworkGate>
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        {!pool || !live || !metrics ? (
          <div className="rounded-xl p-12 text-center animate-pulse" style={{ border: `1px solid ${clmm.border}` }}>
            <p className="font-mono text-[11px]" style={{ color: clmm.textMuted }}>Loading pool…</p>
          </div>
        ) : (
          <>
            <PoolDetailView
              poolAddress={poolAddress}
              live={live}
              metrics={metrics}
              onTrade={() => setPanel("swap")}
              onPositions={() => setPanel("positions")}
            />

            {panel === "swap" && (
              <div className="mt-6 rounded-2xl p-5 max-w-xl" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
                <SwapPanel pool={pool} live={live} onClose={() => setPanel("overview")} />
              </div>
            )}

            {panel === "positions" && (
              <div className="mt-6 rounded-2xl p-5" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
                <div className="flex justify-between items-center mb-4">
                  <p className="font-grotesk text-[12px] uppercase" style={{ color: clmm.text }}>
                    My positions in this pool
                  </p>
                  <button
                    type="button"
                    onClick={refreshPositions}
                    className="font-mono text-[9px] px-3 py-1 rounded-full uppercase"
                    style={{ border: `1px solid ${clmm.border}`, color: clmm.accent }}
                  >
                    {loadingPos ? "Scanning…" : "Refresh"}
                  </button>
                </div>
                <PositionCards positions={positions} loading={loadingPos} onRefresh={refreshPositions} />
              </div>
            )}
          </>
        )}
      </div>
      </ClmmNetworkGate>
    </AppShell>
  );
}

function SwapPanel({
  pool,
  live,
  onClose,
}: {
  pool: CachedPool;
  live: PoolLiveState;
  onClose: () => void;
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
    args: address && tokenIn ? [address, UNISWAP_V3.swapRouter02] : undefined,
    query: { enabled: !!address && !!tokenIn },
  });
  const needsApproval = parsedIn > 0n && ((allowanceQ.data as bigint | undefined) ?? 0n) < parsedIn;

  const runSwap = async () => {
    if (!address || !publicClient || parsedIn === 0n) return;
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
        <p className="font-grotesk text-[12px] uppercase flex items-center gap-2" style={{ color: clmm.text }}>
          <ArrowDownUp className="w-4 h-4" /> Swap
        </p>
        <button type="button" onClick={onClose} className="font-mono text-[9px]" style={{ color: clmm.accent }}>
          Close
        </button>
      </div>
      {!address ? (
        <p className="font-mono text-[11px] flex items-center gap-2" style={{ color: clmm.textMuted }}>
          <Wallet className="w-4 h-4" /> Connect wallet
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
                    args: [UNISWAP_V3.swapRouter02, maxUint256],
                    ...gas,
                  }),
                );
              } else runSwap().catch((e) => toast("error", "Swap failed", (e as Error).message));
            }}
            disabled={busy || parsedIn === 0n || quoteOut == null}
            className="w-full py-3 rounded-full font-grotesk text-[11px] uppercase disabled:opacity-40"
            style={{ background: clmm.purpleSolid, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }}
          >
            {busy ? "Working…" : needsApproval ? "Approve & Swap" : "Swap"}
          </button>
        </>
      )}
    </div>
  );
}
