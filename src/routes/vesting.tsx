import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search, Timer } from "lucide-react";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { CreateVestingDialog } from "@/components/CreateVestingDialog";
import { SuccessModal } from "@/components/SuccessModal";
import { NewActionCTA } from "@/components/NewActionCTA";
import { useUserVestings, useContractAddresses, type VestingView } from "@/lib/web3/hooks";
import { VESTING_NFT_ABI } from "@/lib/web3/contracts";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { TokenIcon } from "@/components/TokenIcon";
import { useRemoteTokenMeta } from "@/lib/web3/useRemoteTokenMeta";
import { formatAmount } from "@/lib/web3/format";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import { bigintToUsd, useTokenPriceUsdLive } from "@/lib/web3/prices";
import { formatUsdTable } from "@/lib/capricorn/poolMetrics";
import { useOpenNftExplorer, stopPositionRowClick } from "@/components/NftExplorerLink";
import { SharePositionButton } from "@/components/SharePositionButton";
import { SharedPositionBanner } from "@/components/SharedPositionBanner";
import { parsePositionSearchParam, validatePositionSearch } from "@/lib/positionShare";
import { useSharedVesting } from "@/lib/web3/useSharedPositions";

export const Route = createFileRoute("/vesting")({
  validateSearch: validatePositionSearch,
  component: VestingPage,
  head: () => ({
    meta: [
      { title: "Vesting — The Dog House" },
      { name: "description", content: "Manage vesting schedules on Monad." },
    ],
  }),
});

const TABS = ["My Schedules", "Claimable"] as const;
type Tab = typeof TABS[number];

// ── Single vesting row ────────────────────────────────────────────────────
function VestingRow({
  vesting,
  isLast,
  onClaimed,
}: {
  vesting: VestingView;
  isLast: boolean;
  onClaimed: () => void;
}) {
  const { vestingNFT } = useContractAddresses();
  const { address } = useAccount();
  const { toast } = useToast();
  const [successOpen, setSuccessOpen] = useState(false);
  const publicClient = usePublicClient();

  // Fetch token symbol + decimals on-chain
  const metaQ = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: vesting.token, abi: ERC20_ABI, functionName: "symbol"   as const },
      { address: vesting.token, abi: ERC20_ABI, functionName: "decimals" as const },
    ],
    query: { enabled: !!vesting.token, refetchInterval: 10_000 },
  });
  const getRemoteMeta = useRemoteTokenMeta([vesting.token]);
  const remote = getRemoteMeta(vesting.token);
  const symbol   =
    remote?.symbol ??
    ((metaQ.data?.[0]?.result as string | undefined) ?? vesting.token.slice(0, 6));
  const decimals =
    remote?.decimals ?? ((metaQ.data?.[1]?.result as number | undefined) ?? 18);

  const { priceUsd, loading: priceLoading } = useTokenPriceUsdLive(vesting.token);

  const tx   = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });
  const [justClaimed, setJustClaimed] = useState(false);

  useEffect(() => {
    if (rcpt.isSuccess) {
      setJustClaimed(true);
      setSuccessOpen(true);
      onClaimed();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcpt.isSuccess]);

  const doClaim = async () => {
    if (!publicClient) {
      toast("error", "Connection Error", "Please check your wallet connection");
      return;
    }

    try {
      // Prepare claim transaction with gas estimation
      const claimRequest = {
        address: vestingNFT,
        abi: VESTING_NFT_ABI,
        functionName: "claim",
        args: [vesting.id],
        account: address,
      };

      const gas = await prepareTransactionWithGas(publicClient);

      tx.writeContract({
        address: vestingNFT,
        abi: VESTING_NFT_ABI,
        functionName: "claim",
        args: [vesting.id],
        ...gas,
      });
    } catch (error) {
      console.error("[VestingClaim] Claim preparation failed:", error);
      toast("error", "Transaction Failed", "Failed to prepare claim transaction");
    }
  };

  // ── Linear vesting math (mirrors contract _claimableAmount) ──────────
  const nowSec      = Math.floor(Date.now() / 1000);
  const startTime   = Number(vesting.startTime);
  const duration    = Number(vesting.duration);
  const cliff       = Number(vesting.cliffDuration);
  const endTime     = startTime + duration;
  const cliffTime   = startTime + cliff;
  const hasCliff    = cliff > 0;

  // Ensure BigInt values (may come from cache as strings)
  const totalAmount = BigInt(vesting.totalAmount || 0);
  const claimed = BigInt(vesting.claimed || 0);
  const claimable = BigInt(vesting.claimable || 0);

  const totalUsd = bigintToUsd(totalAmount, decimals, priceUsd);
  const claimableUsd = bigintToUsd(claimable, decimals, priceUsd);

  // How much has linearly vested so far (before subtracting claimed)
  const vestedSoFar: bigint = (() => {
    if (nowSec < cliffTime) return 0n;
    if (nowSec >= endTime)  return totalAmount;
    const elapsed = BigInt(nowSec - startTime);
    return duration > 0 ? (totalAmount * elapsed) / BigInt(duration) : 0n;
  })();

  // Progress = vested so far / total
  const vestedPct = totalAmount > 0n
    ? Number((vestedSoFar * 10000n) / totalAmount) / 100
    : 0;

  // Claimed pct
  const claimedPct = totalAmount > 0n
    ? Number((claimed * 10000n) / totalAmount) / 100
    : 0;

  const inCliff    = hasCliff && nowSec < cliffTime;
  const fullyVested = nowSec >= endTime;
  const endDate    = new Date(endTime * 1000).toLocaleDateString();
  const cliffDate  = hasCliff ? new Date(cliffTime * 1000).toLocaleDateString() : null;

  // Time remaining label
  const timeLabel = (() => {
    if (vesting.revoked) return "Revoked";
    if (fullyVested)     return "Fully vested";
    if (inCliff) {
      const secsLeft = cliffTime - nowSec;
      const daysLeft = Math.ceil(secsLeft / 86400);
      return `Cliff: ${daysLeft}d left`;
    }
    const secsLeft = endTime - nowSec;
    const daysLeft = Math.ceil(secsLeft / 86400);
    return `${daysLeft}d remaining`;
  })();

  return (
    <>
      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Vesting"
        heading="Tokens Claimed"
        subtext="Your vested tokens have been released."
        rows={[
          { label: "Token",  value: symbol },
          { label: "Amount", value: `${formatAmount(claimable, decimals)} ${symbol}` },
          { label: "NFT ID", value: `#${vesting.id.toString()}` },
        ]}
      />

      <VestingRowUI
        nftContract={vestingNFT}
        symbol={symbol}
        decimals={decimals}
        logoUrl={remote?.logoURI}
        vesting={vesting}
        totalAmount={totalAmount}
        claimed={claimed}
        claimable={claimable}
        totalUsd={totalUsd}
        claimableUsd={claimableUsd}
        priceLoading={priceLoading}
        vestedPct={vestedPct}
        claimedPct={claimedPct}
        inCliff={inCliff}
        fullyVested={fullyVested}
        hasCliff={hasCliff}
        cliff={cliff}
        duration={duration}
        endDate={endDate}
        cliffDate={cliffDate}
        timeLabel={timeLabel}
        justClaimed={justClaimed}
        doClaim={doClaim}
        txPending={tx.isPending || rcpt.isLoading}
        isLast={isLast}
      />
    </>
  );
}

function VestingRowUI({
  nftContract,
  symbol,
  decimals,
  logoUrl,
  vesting,
  totalAmount,
  claimed,
  claimable,
  totalUsd,
  claimableUsd,
  priceLoading,
  vestedPct,
  claimedPct,
  inCliff,
  fullyVested,
  hasCliff,
  cliff,
  duration,
  endDate,
  cliffDate,
  timeLabel,
  justClaimed,
  doClaim,
  txPending,
  isLast,
}: {
  nftContract: `0x${string}`;
  symbol: string;
  decimals: number;
  logoUrl?: string | null;
  vesting: VestingView;
  totalAmount: bigint;
  claimed: bigint;
  claimable: bigint;
  totalUsd: number;
  claimableUsd: number;
  priceLoading: boolean;
  vestedPct: number;
  claimedPct: number;
  inCliff: boolean;
  fullyVested: boolean;
  hasCliff: boolean;
  cliff: number;
  duration: number;
  endDate: string;
  cliffDate: string | null;
  timeLabel: string;
  justClaimed: boolean;
  doClaim: () => void;
  txPending: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const openExplorer = useOpenNftExplorer(nftContract, vesting.id);

  return (
    <div
      className="px-5 py-4 hover:bg-[rgba(139,92,246,0.03)] transition-colors cursor-pointer"
      style={{ borderBottom: isLast ? "none" : "1px solid rgba(139,92,246,0.15)" }}
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
      {/* Compact row: token, progress bar, action */}
      <div className="flex items-center gap-3">
        {/* Token icon + name */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <TokenIcon address={vesting.token} symbol={symbol} size={28} logoUrl={logoUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-grotesk uppercase text-[12px] tracking-wider truncate" style={{ color: "#FFFFFF" }}>{symbol}</p>
              <span className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>#{vesting.id.toString()}</span>
            </div>
            {/* Progress bar inline */}
            <div className="relative w-full h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: "rgba(139,92,246,0.12)" }}>
              <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(vestedPct, 100)}%`, background: "rgba(139,92,246,0.45)" }} />
              <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(claimedPct, 100)}%`, background: "#8B5CF6" }} />
              {hasCliff && duration > 0 && (
                <div className="absolute top-0 h-full w-px" style={{ left: `${Math.min((cliff / duration) * 100, 100)}%`, background: "rgba(255,180,50,0.7)" }} />
              )}
            </div>
          </div>
        </div>

        {/* Status + action */}
        <div className="flex items-center gap-2 shrink-0" onClick={stopPositionRowClick}>
          <SharePositionButton kind="vesting" tokenId={vesting.id} />
          {vesting.revoked ? (
            <span className="font-mono text-[9px] uppercase" style={{ color: "rgba(255,100,100,0.7)" }}>Revoked</span>
          ) : justClaimed ? (
            <span className="font-mono text-[9px] uppercase" style={{ color: "#A78BFA" }}>Claimed ✓</span>
          ) : claimable > 0n ? (
            <button
              onClick={doClaim}
              disabled={txPending}
              className="px-3 py-1.5 rounded-full font-grotesk text-[10px] uppercase tracking-wider disabled:opacity-50 transition"
              style={{ background: "rgba(139,92,246,0.25)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.6)" }}
            >
              {txPending ? "…" : "Claim"}
            </button>
          ) : (
            <span className="font-mono text-[9px] uppercase" style={{ color: fullyVested ? "#A78BFA" : "rgba(139,92,246,0.55)" }}>
              {inCliff ? "In cliff" : fullyVested ? "Done ✓" : "Vesting"}
            </span>
          )}

          {/* More button */}
          <button
            type="button"
            onClick={(e) => {
              stopPositionRowClick(e);
              setExpanded((v) => !v);
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center transition hover:bg-[rgba(139,92,246,0.15)]"
            style={{ color: "rgba(255,255,255,0.5)" }}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide vesting details" : "Show vesting details"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="mt-3 pt-3"
          style={{ borderTop: "1px solid rgba(139,92,246,0.1)" }}
          onClick={stopPositionRowClick}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Total</p>
              <p className="font-mono text-[11px] mt-0.5" style={{ color: "#FFFFFF" }}>{formatAmount(totalAmount, decimals)} {symbol}</p>
              <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                {priceLoading ? "…" : totalUsd > 0 ? formatUsdTable(totalUsd) : "—"}
              </p>
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Claimed</p>
              <p className="font-mono text-[11px] mt-0.5" style={{ color: "#FFFFFF" }}>{formatAmount(claimed, decimals)} {symbol}</p>
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Claimable</p>
              <p className="font-mono text-[11px] mt-0.5" style={{ color: claimable > 0n ? "#A78BFA" : "rgba(255,255,255,0.6)" }}>{formatAmount(claimable, decimals)} {symbol}</p>
              <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                {priceLoading ? "…" : claimableUsd > 0 ? formatUsdTable(claimableUsd) : "—"}
              </p>
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>End Date</p>
              <p className="font-mono text-[11px] mt-0.5" style={{ color: fullyVested ? "#A78BFA" : "rgba(255,255,255,0.6)" }}>{endDate}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {claimedPct.toFixed(1)}% claimed · {vestedPct.toFixed(1)}% vested
            </span>
            <span className="font-mono text-[9px]" style={{ color: inCliff ? "rgba(255,180,50,0.85)" : fullyVested ? "#A78BFA" : "rgba(255,255,255,0.5)" }}>
              {timeLabel}{hasCliff && cliffDate ? ` · cliff ${cliffDate}` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
function VestingPage() {
  const { position: positionParam } = Route.useSearch();
  const sharedVestingId = parsePositionSearchParam(positionParam);
  const { vesting: sharedVesting, loading: sharedLoading, notFound: sharedNotFound } =
    useSharedVesting(sharedVestingId);

  const [activeTab, setActiveTab] = useState<Tab>("My Schedules");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { address } = useAccount();
  const { vestings, isLoading } = useUserVestings();

  // Fetch token symbols for search
  const uniqueTokens = useMemo(() => [...new Set(vestings.map((v) => v.token))], [vestings]);
  const symbolsQ = useReadContracts({
    allowFailure: true,
    contracts: uniqueTokens.map((t) => ({ address: t, abi: ERC20_ABI, functionName: "symbol" as const })),
    query: { enabled: uniqueTokens.length > 0, refetchInterval: 10_000 },
  });
  const symbolMap = useMemo(() => {
    const m: Record<string, string> = {};
    uniqueTokens.forEach((t, i) => {
      m[t.toLowerCase()] = (symbolsQ.data?.[i]?.result as string | undefined) ?? t.slice(0, 6);
    });
    return m;
  }, [uniqueTokens, symbolsQ.data]);

  const filtered = useMemo(() => {
    let list = vestings;
    if (activeTab === "Claimable") list = list.filter((v) => BigInt(v.claimable || 0) > 0n);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((v) =>
        v.token.toLowerCase().includes(s) ||
        (symbolMap[v.token.toLowerCase()] ?? "").toLowerCase().includes(s) ||
        v.id.toString().includes(s)
      );
    }
    return list;
  }, [vestings, activeTab, search, symbolMap]);

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">

        <div className="flex items-center justify-between gap-3 mb-7">
          <div>
            <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#FFFFFF" }}>
              Vesting
            </h1>
            <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>
              Linear &amp; cliff vesting · NFT positions · transferable
            </p>
          </div>
          <NewActionCTA label="New Schedule" onClick={() => setShowCreate(true)} />
        </div>

        {sharedVestingId !== undefined && (
          <SharedPositionBanner
            kind="vesting"
            tokenId={sharedVestingId}
            loading={sharedLoading}
            notFound={sharedNotFound}
          >
            {sharedVesting && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
                <VestingRow
                  vesting={sharedVesting}
                  isLast
                  onClaimed={() => {}}
                />
              </div>
            )}
          </SharedPositionBanner>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div
            className="flex items-center gap-0.5 p-1 rounded-full"
            style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}
          >
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap"
                style={
                  activeTab === t
                    ? { background: "rgba(139,92,246,0.35)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.6)" }
                    : { color: "rgba(255,255,255,0.5)" }
                }
              >
                {t}
              </button>
            ))}
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-full"
            style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}
          >
            <Search className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.5)" }} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search by token or NFT ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent font-mono text-[11px] outline-none w-40 sm:w-56"
              style={{ color: "#FFFFFF" }}
            />
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
          {!address ? (
            <Empty title="Wallet not connected" sub="Connect your wallet to see your schedules." />
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(139,92,246,0.2)", borderTopColor: "rgba(139,92,246,0.8)" }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <Empty
              title={activeTab === "Claimable" ? "Nothing to claim" : "No schedules yet"}
              sub={activeTab === "Claimable" ? "Nothing is claimable right now." : "Create a vesting schedule with + New."}
            />
          ) : (
            filtered.map((v, i) => (
              <VestingRow
                key={v.id.toString()}
                vesting={v}
                isLast={i === filtered.length - 1}
                onClaimed={() => {/* data auto-refetches via wagmi */}}
              />
            ))
          )}
        </div>
      </div>

      <CreateVestingDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </AppShell>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)" }}
      >
        <Timer className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} strokeWidth={1.5} />
      </div>
      <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#FFFFFF" }}>{title}</p>
      <p className="font-mono text-[10px] mt-1.5 max-w-[220px]" style={{ color: "rgba(255,255,255,0.55)" }}>{sub}</p>
    </div>
  );
}
