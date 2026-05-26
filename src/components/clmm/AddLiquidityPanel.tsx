import { useEffect, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits, maxUint256 } from "viem";
import { TokenIcon } from "@/components/TokenIcon";
import { useToast } from "@/components/Toast";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import {
  CAPRICORN_CL,
  buildMintArgs,
  formatPriceDisplay,
  getSqrtRatioAtTick,
  priceAtTick,
  quoteLiquidityPair,
  type PoolLiveState,
  type RangePreset,
} from "@/lib/capricorn";
import { formatUsdCompact } from "@/lib/capricorn/poolMetrics";
import { NPM_ABI } from "@/lib/capricorn/abis";
import { clmm } from "./clmmTheme";

type EditSide = "0" | "1";

const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "10", label: "10%" },
  { id: "20", label: "20%" },
  { id: "50", label: "50%" },
  { id: "full", label: "Full" },
];

export function AddLiquidityPanel({
  live,
  tickLower,
  tickUpper,
  rangePreset,
  onRangePresetChange,
  logo0,
  logo1,
  token0Usd,
}: {
  live: PoolLiveState;
  tickLower: number;
  tickUpper: number;
  rangePreset: RangePreset;
  onRangePresetChange: (p: RangePreset) => void;
  logo0: string | null;
  logo1: string | null;
  /** USD price of token0 (from metrics / DexScreener). */
  token0Usd: number | null;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const positionManager = CAPRICORN_CL.positionManager as `0x${string}`;

  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [editSide, setEditSide] = useState<EditSide>("0");
  const pendingMintRef = useRef<{ amount0: bigint; amount1: bigint } | null>(null);
  const approveStepRef = useRef<"0" | "1" | null>(null);

  const approveTx = useWriteContract();
  const mintTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const mintRcpt = useWaitForTransactionReceipt({ hash: mintTx.data });

  const parsed0 = safeParse(amount0, live.token0Decimals);
  const parsed1 = safeParse(amount1, live.token1Decimals);

  const sqrtLower = getSqrtRatioAtTick(tickLower);
  const sqrtUpper = getSqrtRatioAtTick(tickUpper);
  const sqrtMin = sqrtLower < sqrtUpper ? sqrtLower : sqrtUpper;
  const sqrtMax = sqrtLower < sqrtUpper ? sqrtUpper : sqrtLower;
  const priceInRange = live.sqrtPriceX96 >= sqrtMin && live.sqrtPriceX96 < sqrtMax;
  const priceBelowRange = live.sqrtPriceX96 < sqrtMin;
  const priceAboveRange = live.sqrtPriceX96 >= sqrtMax;

  const minPrice = priceAtTick(tickLower, live.token0Decimals, live.token1Decimals);
  const maxPrice = priceAtTick(tickUpper, live.token0Decimals, live.token1Decimals);
  const priceLo = Math.min(minPrice, maxPrice);
  const priceHi = Math.max(minPrice, maxPrice);
  const priceLabel = `${live.token1Symbol} per ${live.token0Symbol}`;

  const balance0Q = useReadContract({
    address: live.pool.token0,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const balance1Q = useReadContract({
    address: live.pool.token1,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const bal0 = (balance0Q.data as bigint | undefined) ?? 0n;
  const bal1 = (balance1Q.data as bigint | undefined) ?? 0n;

  const token1Usd =
    token0Usd != null && live.price > 0 ? token0Usd / live.price : null;

  const resolveDeposit = (): { amount0: bigint; amount1: bigint } | null => {
    if (editSide === "1" && parsed1 > 0n) {
      const q = quoteLiquidityPair({
        sqrtPriceX96: live.sqrtPriceX96,
        tickLower,
        tickUpper,
        amount1: parsed1,
      });
      return { amount0: q.amount0, amount1: parsed1 };
    }
    if (parsed0 > 0n) {
      const q = quoteLiquidityPair({
        sqrtPriceX96: live.sqrtPriceX96,
        tickLower,
        tickUpper,
        amount0: parsed0,
      });
      return { amount0: parsed0, amount1: q.amount1 };
    }
    return null;
  };

  const deposit = resolveDeposit();
  const deposit0 = deposit?.amount0 ?? 0n;
  const deposit1 = deposit?.amount1 ?? 0n;

  const requoteFromSide = (side: EditSide) => {
    if (side === "0" && parsed0 > 0n) {
      const q = quoteLiquidityPair({
        sqrtPriceX96: live.sqrtPriceX96,
        tickLower,
        tickUpper,
        amount0: parsed0,
      });
      setAmount1(q.amount1 > 0n ? trimFormat(q.amount1, live.token1Decimals) : "");
    } else if (side === "1" && parsed1 > 0n) {
      const q = quoteLiquidityPair({
        sqrtPriceX96: live.sqrtPriceX96,
        tickLower,
        tickUpper,
        amount1: parsed1,
      });
      setAmount0(q.amount0 > 0n ? trimFormat(q.amount0, live.token0Decimals) : "");
    }
  };

  useEffect(() => {
    requoteFromSide(editSide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickLower, tickUpper, live.sqrtPriceX96]);

  const onChange0 = (v: string) => {
    const clean = v.replace(/[^0-9.]/g, "");
    setEditSide("0");
    setAmount0(clean);
    if (!clean) {
      setAmount1("");
      return;
    }
    if (priceAboveRange) {
      setAmount1("");
      return;
    }
    const p0 = safeParse(clean, live.token0Decimals);
    if (p0 === 0n) {
      setAmount1("");
      return;
    }
    const q = quoteLiquidityPair({
      sqrtPriceX96: live.sqrtPriceX96,
      tickLower,
      tickUpper,
      amount0: p0,
    });
    setAmount1(q.amount1 > 0n ? trimFormat(q.amount1, live.token1Decimals) : "");
  };

  const onChange1 = (v: string) => {
    const clean = v.replace(/[^0-9.]/g, "");
    setEditSide("1");
    setAmount1(clean);
    if (!clean) {
      setAmount0("");
      return;
    }
    if (priceBelowRange) {
      setAmount0("");
      return;
    }
    const p1 = safeParse(clean, live.token1Decimals);
    if (p1 === 0n) {
      setAmount0("");
      return;
    }
    const q = quoteLiquidityPair({
      sqrtPriceX96: live.sqrtPriceX96,
      tickLower,
      tickUpper,
      amount1: p1,
    });
    setAmount0(q.amount0 > 0n ? trimFormat(q.amount0, live.token0Decimals) : "");
  };

  const allowance0Q = useReadContract({
    address: live.pool.token0,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, positionManager] : undefined,
    query: { enabled: !!address },
  });
  const allowance1Q = useReadContract({
    address: live.pool.token1,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, positionManager] : undefined,
    query: { enabled: !!address },
  });

  const needsApprove0 = deposit0 > 0n && ((allowance0Q.data as bigint | undefined) ?? 0n) < deposit0;
  const needsApprove1 = deposit1 > 0n && ((allowance1Q.data as bigint | undefined) ?? 0n) < deposit1;

  const runMint = async (amounts: { amount0: bigint; amount1: bigint }) => {
    if (!address || !publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    mintTx.writeContract({
      address: positionManager,
      abi: NPM_ABI,
      functionName: "mint",
      args: [
        buildMintArgs({
          token0: live.pool.token0,
          token1: live.pool.token1,
          fee: live.pool.fee,
          tickLower,
          tickUpper,
          amount0Desired: amounts.amount0,
          amount1Desired: amounts.amount1,
          recipient: address,
        }),
      ],
      ...gas,
    });
  };

  const runApprove = async (token: `0x${string}`, step: "0" | "1") => {
    if (!publicClient) return;
    approveStepRef.current = step;
    const gas = await prepareTransactionWithGas(publicClient);
    approveTx.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [positionManager, maxUint256],
      ...gas,
    });
  };

  const startAddLiquidity = () => {
    if (!address) return;
    const amounts = resolveDeposit();
    if (!amounts || (amounts.amount0 === 0n && amounts.amount1 === 0n)) {
      toast("error", "Enter an amount", "Type how much you want to deposit.");
      return;
    }
    if (priceInRange && (amounts.amount0 === 0n || amounts.amount1 === 0n)) {
      toast("error", "Quote failed", "Could not compute the paired token amount. Try again.");
      return;
    }
    if (priceAboveRange && amounts.amount1 === 0n) {
      toast(
        "error",
        "Price above range",
        `Deposit ${live.token1Symbol} only, or widen your max price.`,
      );
      return;
    }
    if (priceBelowRange && amounts.amount0 === 0n) {
      toast(
        "error",
        "Price below range",
        `Deposit ${live.token0Symbol} only, or widen your min price.`,
      );
      return;
    }

    pendingMintRef.current = amounts;

    if (needsApprove0) {
      runApprove(live.pool.token0, "0").catch((e) => {
        pendingMintRef.current = null;
        toast("error", "Approve failed", (e as Error).message);
      });
      return;
    }
    if (needsApprove1) {
      runApprove(live.pool.token1, "1").catch((e) => {
        pendingMintRef.current = null;
        toast("error", "Approve failed", (e as Error).message);
      });
      return;
    }
    runMint(amounts).catch((e) => toast("error", "Mint failed", (e as Error).message));
  };

  useEffect(() => {
    if (!approveRcpt.isSuccess || !pendingMintRef.current) return;
    const amounts = pendingMintRef.current;
    const step = approveStepRef.current;

    if (step === "0" && amounts.amount1 > 0n) {
      runApprove(live.pool.token1, "1").catch((e) => {
        pendingMintRef.current = null;
        toast("error", "Approve failed", (e as Error).message);
      });
      return;
    }

    approveStepRef.current = null;
    runMint(amounts).catch((e) => {
      pendingMintRef.current = null;
      toast("error", "Mint failed", (e as Error).message);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  useEffect(() => {
    if (mintRcpt.isSuccess) {
      pendingMintRef.current = null;
      toast("success", "Liquidity added", "Your position NFT was minted on Capricorn.");
      setAmount0("");
      setAmount1("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintRcpt.isSuccess]);

  const busy = approveTx.isPending || approveRcpt.isLoading || mintTx.isPending || mintRcpt.isLoading;
  const canSubmit = priceInRange
    ? deposit0 > 0n && deposit1 > 0n
    : priceBelowRange
      ? deposit0 > 0n
      : priceAboveRange
        ? deposit1 > 0n
        : deposit0 > 0n || deposit1 > 0n;

  const usd0 = usdEstimate(amount0, token0Usd);
  const usd1 = usdEstimate(amount1, token1Usd);

  if (!address) {
    return (
      <p className="font-mono text-[12px] py-8 text-center" style={{ color: clmm.textMuted }}>
        Connect wallet to create a position
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <TokenAmountCard
        symbol={live.token0Symbol}
        address={live.pool.token0}
        logoUrl={logo0}
        balance={bal0}
        decimals={live.token0Decimals}
        value={amount0}
        onChange={onChange0}
        onMax={() => onChange0(trimFormat(bal0, live.token0Decimals))}
        usdLabel={usd0}
        dimmed={priceAboveRange}
        hint={priceAboveRange ? `Price above range — use ${live.token1Symbol} only` : undefined}
      />
      <TokenAmountCard
        symbol={live.token1Symbol}
        address={live.pool.token1}
        logoUrl={logo1}
        balance={bal1}
        decimals={live.token1Decimals}
        value={amount1}
        onChange={onChange1}
        onMax={() => onChange1(trimFormat(bal1, live.token1Decimals))}
        usdLabel={usd1}
        dimmed={priceBelowRange}
        hint={priceBelowRange ? `Price below range — use ${live.token0Symbol} only` : undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        <PriceBoundCard label="Minimum" value={formatPriceDisplay(priceLo)} sub={priceLabel} />
        <PriceBoundCard label="Maximum" value={formatPriceDisplay(priceHi)} sub={priceLabel} />
      </div>

      <div>
        <p className="font-grotesk text-[14px] mb-3" style={{ color: clmm.text }}>
          Price range
        </p>
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onRangePresetChange(p.id)}
              className="px-4 py-2 rounded-xl font-mono text-[12px] transition"
              style={
                rangePreset === p.id
                  ? { background: clmm.purpleBgHover, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }
                  : { background: clmm.panelHover, color: clmm.textMuted, border: `1px solid ${clmm.border}` }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!priceInRange && (parsed0 || parsed1) && (
        <p className="font-mono text-[10px] text-center leading-relaxed" style={{ color: clmm.textDim }}>
          {priceBelowRange
            ? `Pool price is below your range — deposit ${live.token0Symbol} only.`
            : priceAboveRange
              ? `Pool price is above your range — deposit ${live.token1Symbol} only.`
              : "Pool price is outside this range."}
        </p>
      )}

      <button
        type="button"
        onClick={startAddLiquidity}
        disabled={busy || !canSubmit}
        className="w-full py-4 rounded-full font-grotesk text-[14px] font-semibold tracking-wide transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: clmm.purpleBtn, color: clmm.bg }}
      >
        {busy ? "Working…" : needsApprove0 || needsApprove1 ? "Approve & deposit liquidity" : "Deposit liquidity"}
      </button>
    </div>
  );
}

function TokenAmountCard({
  symbol,
  address,
  logoUrl,
  balance,
  decimals,
  value,
  onChange,
  onMax,
  usdLabel,
  dimmed,
  hint,
}: {
  symbol: string;
  address: `0x${string}`;
  logoUrl: string | null;
  balance: bigint;
  decimals: number;
  value: string;
  onChange: (v: string) => void;
  onMax: () => void;
  usdLabel: string | null;
  dimmed?: boolean;
  hint?: string;
}) {
  const balanceZero = balance === 0n;
  return (
    <div
      className="rounded-2xl p-4 space-y-3 transition-opacity"
      style={{
        background: clmm.panelHover,
        border: `1px solid ${clmm.border}`,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px]" style={{ color: clmm.textDim }}>
          Amount
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="w-3.5 h-3.5 shrink-0" style={{ color: clmm.textDim }} />
          <span
            className="font-mono text-[11px] truncate"
            style={{ color: balanceZero ? clmm.red : clmm.textMuted }}
          >
            {formatBalanceCompact(balance, decimals, symbol)}
          </span>
          <button
            type="button"
            onClick={onMax}
            disabled={balanceZero || dimmed}
            className="shrink-0 px-2.5 py-0.5 rounded-lg font-mono text-[10px] font-medium transition hover:opacity-90 disabled:opacity-40"
            style={{ background: clmm.purpleBgHover, color: clmm.accent, border: `1px solid ${clmm.borderStrong}` }}
          >
            Max
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          disabled={dimmed}
          className="flex-1 min-w-0 bg-transparent font-grotesk text-[28px] sm:text-[32px] font-medium outline-none tabular-nums disabled:cursor-not-allowed"
          style={{ color: clmm.text }}
        />
        <div
          className="flex items-center gap-2 shrink-0 pl-2 pr-1 py-1 rounded-xl"
          style={{ background: clmm.purpleBg }}
        >
          <TokenIcon address={address} symbol={symbol} size={28} logoUrl={logoUrl} />
          <span className="font-grotesk text-[15px] pr-1" style={{ color: clmm.text }}>
            {symbol}
          </span>
        </div>
      </div>

      {usdLabel && (
        <p className="font-mono text-[11px]" style={{ color: clmm.textDim }}>
          {usdLabel}
        </p>
      )}
      {hint && (
        <p className="font-mono text-[10px]" style={{ color: clmm.textDim }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function PriceBoundCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-4 text-center"
      style={{ background: clmm.panelHover, border: `1px solid ${clmm.border}` }}
    >
      <p className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: clmm.textDim }}>
        {label}
      </p>
      <p className="font-grotesk text-[22px] sm:text-[26px] font-medium tabular-nums leading-tight" style={{ color: clmm.text }}>
        {value}
      </p>
      <p className="font-mono text-[10px] mt-1.5" style={{ color: clmm.textMuted }}>
        {sub}
      </p>
    </div>
  );
}

function formatBalanceCompact(amount: bigint, decimals: number, symbol: string): string {
  const n = Number(formatUnits(amount, decimals));
  if (!Number.isFinite(n) || n === 0) return `0 ${symbol}`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B ${symbol}`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M ${symbol}`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(2)}K ${symbol}`;
  if (n >= 1000) return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
  if (n < 0.0001) return `<0.0001 ${symbol}`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`;
}

function usdEstimate(amount: string, unitUsd: number | null): string | null {
  if (!unitUsd || !amount) return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return formatUsdCompact(n * unitUsd) ?? null;
}

function safeParse(v: string, decimals: number): bigint {
  try {
    return v ? parseUnits(v, decimals) : 0n;
  } catch {
    return 0n;
  }
}

function trimFormat(amount: bigint, decimals: number): string {
  if (amount === 0n) return "";
  const s = formatUnits(amount, decimals);
  if (!s || s === "0") return "";
  const trimmed = s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  return trimmed;
}
