import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Sprout, Plus, X, Clock, Wallet } from "lucide-react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from "wagmi";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import { LIVE_CHAIN_QUERY } from "@/lib/web3/nftImage";
import { NftImage } from "@/components/NftImage";
import { useOpenNftExplorer, stopPositionRowClick } from "@/components/NftExplorerLink";
import { parseUnits, formatUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { SuccessModal } from "@/components/SuccessModal";
import { useTransactionSuccess } from "@/lib/web3/useTransactionSuccess";
import { STREAM_FARM_ABI, CONTRACTS, ERC20_ABI } from "@/lib/web3/contracts";
import type { TokenInfo } from "@/lib/web3/tokens";
import { TokenIcon } from "@/components/TokenIcon";
import { useRemoteTokenMeta } from "@/lib/web3/useRemoteTokenMeta";
import { useDexTokenProfile } from "@/lib/web3/useDexTokenProfile";
import { TokenDexProfileSection } from "@/components/TokenDexProfileSection";
import { FarmManagePanel } from "@/components/FarmManagePanel";
import { useIsFarmOperator, useIsStreamFarmAdmin } from "@/lib/web3/useStreamFarmRoles";
import { parseFarmTuple } from "@/lib/web3/parseFarm";
import { bigintToUsd, useTokenPriceUsdLive } from "@/lib/web3/prices";
import { formatUsdTable } from "@/lib/capricorn/poolMetrics";
import { SharePositionButton } from "@/components/SharePositionButton";
import { SharedPositionBanner } from "@/components/SharedPositionBanner";
import { parsePositionSearchParam, validatePositionSearch } from "@/lib/positionShare";
import { useSharedFarmPositionExists } from "@/lib/web3/useSharedPositions";

export const Route = createFileRoute("/farm")({
  validateSearch: validatePositionSearch,
  component: FarmPage,
  head: () => ({ meta: [{ title: "Stream Farms — The Dog House" }, { name: "description", content: "Streaming reward farms on Monad." }] }),
});

const CREATE_TAB = "Create & Manage" as const;
const ALL_FARMS_TAB = "All Farms" as const;
const MY_POSITIONS_TAB = "My Positions" as const;
type Tab = typeof ALL_FARMS_TAB | typeof CREATE_TAB | typeof MY_POSITIONS_TAB;

function useContracts() {
  const chainId = useChainId();
  return CONTRACTS[chainId] ?? CONTRACTS[143];
}

/** Wagmi/viem may return tuple outputs as an array or as named fields. */
function parsePendingRewards(data: unknown): { token: string; amount: bigint }[] {
  if (!data) return [];
  let tokens: string[] = [];
  let amounts: bigint[] = [];
  if (Array.isArray(data)) {
    tokens = (data[0] as string[]) ?? [];
    amounts = (data[1] as bigint[]) ?? [];
  } else if (typeof data === "object") {
    const d = data as { tokens?: string[]; amounts?: bigint[]; 0?: string[]; 1?: bigint[] };
    tokens = d.tokens ?? d[0] ?? [];
    amounts = d.amounts ?? d[1] ?? [];
  }
  return tokens
    .map((token, i) => ({ token, amount: amounts[i] ?? 0n }))
    .filter((e) => e.token);
}

function FarmPage() {
  const { position: positionParam, tab: tabParam } = Route.useSearch();
  const sharedFarmId = parsePositionSearchParam(positionParam);
  const {
    exists: sharedFarmExists,
    loading: sharedFarmLoading,
    notFound: sharedFarmNotFound,
  } = useSharedFarmPositionExists(sharedFarmId);

  const [activeTab, setActiveTab] = useState<Tab>(ALL_FARMS_TAB);
  const [search, setSearch] = useState("");
  const { address } = useAccount();
  const contracts = useContracts();
  const { isFarmOperator, isLoading: operatorLoading } = useIsFarmOperator();
  const { isAdmin, isLoading: adminLoading } = useIsStreamFarmAdmin();
  const canManage = isFarmOperator || isAdmin;
  const manageLoading = operatorLoading || adminLoading;

  const visibleTabs = useMemo((): Tab[] => {
    const tabs: Tab[] = [ALL_FARMS_TAB];
    if (canManage) tabs.push(CREATE_TAB);
    tabs.push(MY_POSITIONS_TAB);
    return tabs;
  }, [canManage]);

  useEffect(() => {
    if (manageLoading) return;
    if (activeTab === CREATE_TAB && !canManage) {
      setActiveTab(ALL_FARMS_TAB);
    }
  }, [manageLoading, canManage, activeTab]);

  useEffect(() => {
    if (sharedFarmId !== undefined || tabParam === "positions") {
      setActiveTab(MY_POSITIONS_TAB);
    }
  }, [sharedFarmId, tabParam]);

  const farmCountQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "farmCount", query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 } });
  const farmCount = Number(farmCountQ.data ?? 0);

  const myPositionsQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "positionsOf",
    args: address ? [address] : undefined,
    query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 10_000 },
  });
  const myPositionCount = ((myPositionsQ.data as bigint[] | undefined) ?? []).length;

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#FFFFFF" }}>Stream Farms</h1>
            <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>
              Continuous reward streaming · Deposit · Earn · Withdraw anytime
            </p>
          </div>
        </div>

        {sharedFarmId !== undefined && (
          <SharedPositionBanner
            kind="farm"
            tokenId={sharedFarmId}
            loading={sharedFarmLoading}
            notFound={sharedFarmNotFound}
          >
            {sharedFarmExists && (
              <PositionCard
                tokenId={sharedFarmId}
                onPositionChange={() => myPositionsQ.refetch()}
              />
            )}
          </SharedPositionBanner>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-0.5 p-1 rounded-full" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
            {visibleTabs.map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap flex items-center gap-1.5"
                style={activeTab === t ? { background: "rgba(139,92,246,0.35)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.6)" } : { color: "rgba(255,255,255,0.5)" }}>
                {t}
                {t === MY_POSITIONS_TAB && myPositionCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full font-mono text-[9px]"
                    style={{ background: "rgba(167,139,250,0.35)", color: "#E9D5FF", border: "1px solid rgba(167,139,250,0.5)" }}
                  >
                    {myPositionCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          {activeTab === ALL_FARMS_TAB && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
              <Search className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.5)" }} strokeWidth={1.5} />
              <input type="text" placeholder="Search farms…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent font-mono text-[11px] outline-none w-32 sm:w-44" style={{ color: "#FFFFFF" }} />
            </div>
          )}
        </div>

        {activeTab === ALL_FARMS_TAB && (
          <>
            {myPositionCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab(MY_POSITIONS_TAB)}
                className="w-full mb-4 rounded-xl px-4 py-3.5 text-left transition hover:opacity-90"
                style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(167,139,250,0.45)" }}
              >
                <p className="font-grotesk text-[12px] uppercase tracking-wider" style={{ color: "#E9D5FF" }}>
                  You have {myPositionCount} active position{myPositionCount !== 1 ? "s" : ""}
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                  View staked amounts, claimable rewards, and claim →
                </p>
              </button>
            )}
            <AllFarmsTab farmCount={farmCount} />
          </>
        )}
        {activeTab === CREATE_TAB && (canManage ? <FarmManagePanel /> : manageLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(139,92,246,0.2)", borderTopColor: "#8B5CF6" }} />
          </div>
        ) : null)}
        {activeTab === MY_POSITIONS_TAB && (
          <div>
            <p className="font-mono text-[11px] mb-4 max-w-xl" style={{ color: "rgba(255,255,255,0.55)" }}>
              Your staked positions, claimable rewards, and estimated USD value — updated every few seconds.
            </p>
            <MyPositionsTab />
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              ALL FARMS
// ═══════════════════════════════════════════════════════════════════════════

function AllFarmsTab({ farmCount }: { farmCount: number }) {
  if (farmCount === 0) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)" }}>
            <Sprout className="w-5 h-5" style={{ color: "rgba(255,255,255,0.7)" }} strokeWidth={1.5} />
          </div>
          <p className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#FFFFFF" }}>No Farms Yet</p>
          <p className="font-mono text-[11px] mt-2 max-w-[320px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            Whitelisted creators can launch farms from Create &amp; Manage. Get your wallet approved by a protocol admin first.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {Array.from({ length: farmCount }, (_, i) => <FarmCard key={i} farmId={i} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              FARM CARD
// ═══════════════════════════════════════════════════════════════════════════

function FarmCard({ farmId }: { farmId: number }) {
  const [showDeposit, setShowDeposit] = useState(false);
  const { address } = useAccount();
  const contracts = useContracts();

  const farmQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getFarm", args: [BigInt(farmId)], query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 } });
  const farm = parseFarmTuple(farmQ.data);
  if (!farm) return <div className="rounded-xl p-5 animate-pulse h-36" style={{ border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.03)" }} />;

  const { stakeToken, totalStaked, active, lockDuration, earlyWithdrawBps, rewardStreamCount } = farm;
  const rewardCount = Number(rewardStreamCount);
  const lockDays = Number(lockDuration ?? 0) / 86400;
  const penaltyPct = Number(earlyWithdrawBps ?? 0) / 100;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "#0d0d0f" }}>
      <FarmCardInner farmId={farmId} stakeToken={stakeToken} totalStaked={totalStaked} active={active} lockDays={lockDays} penaltyPct={penaltyPct} rewardCount={rewardCount} showDeposit={showDeposit} setShowDeposit={setShowDeposit} />
    </div>
  );
}

function FarmCardInner({ farmId, stakeToken, totalStaked, active, lockDays, penaltyPct, rewardCount, showDeposit, setShowDeposit }: any) {
  const [expanded, setExpanded] = useState(false);
  const { address } = useAccount();
  const contracts = useContracts();
  const symbolQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!stakeToken } });
  const decimalsQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!stakeToken } });
  const balanceQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address && !!stakeToken, refetchInterval: 10_000 } });

  const getRemoteMeta = useRemoteTokenMeta([stakeToken]);
  const remote = getRemoteMeta(stakeToken);
  const { profile: dexProfile, loading: dexProfileLoading } = useDexTokenProfile(stakeToken);
  const symbol = remote?.symbol ?? ((symbolQ.data as string) || "...");
  const decimals = remote?.decimals ?? ((decimalsQ.data as number) ?? 18);
  const userBalance = (balanceQ.data as bigint) ?? 0n;
  const stakedFormatted = Number(formatUnits(totalStaked ?? 0n, decimals)).toLocaleString();
  const balanceFormatted = Number(formatUnits(userBalance, decimals)).toLocaleString();

  return (
    <>
      <TokenDexProfileSection
        profile={dexProfile}
        loading={dexProfileLoading}
        symbol={symbol}
        name={remote?.name}
        logoUrl={remote?.logoURI}
        tokenAddress={stakeToken}
        actions={
          <>
            {address && active && (
              <button
                onClick={() => setShowDeposit(true)}
                className="px-3.5 py-1.5 rounded-lg font-grotesk text-[10px] uppercase tracking-wider transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: "rgba(139,92,246,0.35)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.55)" }}
              >
                Deposit
              </button>
            )}
            {rewardCount > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-white/[0.06]"
                style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
                title={expanded ? "Hide streams" : "Show streams"}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </>
        }
      />

      <div
        className="px-4 pb-4 pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <p className="font-mono text-[10px] mb-3 text-center sm:text-left" style={{ color: "rgba(255,255,255,0.45)" }}>
          {stakedFormatted} {symbol} staked · {rewardCount} stream{rewardCount !== 1 ? "s" : ""}
          {lockDays > 0 && ` · ${lockDays}d lock`}
          {penaltyPct > 0 && ` · ${penaltyPct}% exit fee`}
        </p>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-1 font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
          <span>TVL <span style={{ color: "#FFFFFF" }}>{stakedFormatted}</span></span>
          <span>Balance <span style={{ color: "#FFFFFF" }}>{balanceFormatted}</span></span>
          {!active && <span style={{ color: "rgba(255,100,100,0.8)" }}>Paused</span>}
        </div>

        {/* Expanded: reward streams */}
        {expanded && rewardCount > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(139,92,246,0.12)" }}>
            <RewardStreams farmId={farmId} count={rewardCount} />
          </div>
        )}
      </div>

      {showDeposit && (
        <DepositModal farmId={farmId} stakeToken={stakeToken} symbol={symbol} decimals={decimals} userBalance={userBalance} onClose={() => setShowDeposit(false)} />
      )}
    </>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
      <p className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</p>
      <p className="font-mono text-[13px]" style={{ color: accent ? "#A78BFA" : "#FFFFFF" }}>{value}</p>
    </div>
  );
}

function RewardStreams({ farmId, count }: { farmId: number; count: number }) {
  const contracts = useContracts();
  const streamsQ = useReadContracts({
    allowFailure: true,
    contracts: Array.from({ length: count }, (_, i) => ({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getRewardStream" as const, args: [BigInt(farmId), BigInt(i)] as const })),
    query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 },
  });

  return (
    <div className="mt-3 space-y-2">
      <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Reward Streams</p>
      {Array.from({ length: count }, (_, i) => {
        const d = streamsQ.data?.[i];
        if (d?.status !== "success") return null;
        const [token, rewardRate, startTime, endTime, totalBudget, , totalClaimed] = d.result as readonly [
          `0x${string}`, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
        ];
        return <RewardStreamRow key={i} token={token} rewardRate={rewardRate} startTime={startTime} endTime={endTime} totalBudget={totalBudget} totalClaimed={totalClaimed} />;
      })}
    </div>
  );
}

function RewardStreamRow({ token, rewardRate, startTime, endTime, totalBudget, totalClaimed }: {
  token: `0x${string}`; rewardRate: bigint; startTime: bigint; endTime: bigint; totalBudget: bigint; totalClaimed: bigint;
}) {
  const symbolQ = useReadContract({ address: token, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!token } });
  const decimalsQ = useReadContract({ address: token, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!token } });
  const getRemoteMeta = useRemoteTokenMeta([token]);
  const remote = getRemoteMeta(token);
  const sym = remote?.symbol ?? ((symbolQ.data as string) || "...");
  const dec = (decimalsQ.data as number) ?? 18;
  const now = Math.floor(Date.now() / 1000);
  const start = Number(startTime); const end = Number(endTime);
  const isActive = now >= start && now < end;
  const isEnded = now >= end;
  const progress = end > start ? Math.min(100, ((now - start) / (end - start)) * 100) : 0;
  const ratePerDay = Number(formatUnits(BigInt(rewardRate) * 86400n / BigInt(1e18), dec));

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="min-w-0">
          <p className="font-mono text-[11px]" style={{ color: "#FFFFFF" }}>{sym} <span style={{ color: "rgba(255,255,255,0.5)" }}>· {ratePerDay.toFixed(2)}/day</span></p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.15)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "#8B5CF6" }} />
            </div>
            <span className="font-mono text-[8px]" style={{ color: "rgba(255,255,255,0.4)" }}>{isEnded ? "Ended" : isActive ? "Active" : "Pending"}</span>
          </div>
        </div>
      </div>
      <p className="font-mono text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.5)" }}>
        {Number(formatUnits(totalClaimed, dec)).toLocaleString()} / {Number(formatUnits(totalBudget, dec)).toLocaleString()} {sym} claimed
      </p>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//                              DEPOSIT MODAL
// ═══════════════════════════════════════════════════════════════════════════

function DepositModal({ farmId, stakeToken, symbol, decimals, userBalance, onClose }: { farmId: number; stakeToken: `0x${string}`; symbol: string; decimals: number; userBalance: bigint; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const { toast } = useToast();
  const contracts = useContracts();
  const publicClient = usePublicClient();
  const autoDepositRef = useRef(false);

  const farmQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "getFarm",
    args: [BigInt(farmId)],
    query: { ...LIVE_CHAIN_QUERY },
  });
  const farm = parseFarmTuple(farmQ.data);
  const farmLockDays = farm ? Number(farm.lockDuration) / 86400 : 0;

  // Approve
  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  // Deposit
  const depositTx = useWriteContract();
  const depositRcpt = useWaitForTransactionReceipt({ hash: depositTx.data });

  const parsedAmount = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();

  // Check allowance
  const { address } = useAccount();
  const allowanceQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "allowance", args: address ? [address, contracts.streamFarm] : undefined, query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 5_000 } });
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = parsedAmount > 0n && allowance < parsedAmount;

  const runDeposit = async () => {
    if (!parsedAmount || parsedAmount === 0n || !publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    depositTx.writeContract({
      address: contracts.streamFarm,
      abi: STREAM_FARM_ABI,
      functionName: "deposit",
      args: [BigInt(farmId), parsedAmount, 0n],
      ...gas,
    });
  };

  const handleApproveAndDeposit = async () => {
    if (!parsedAmount || parsedAmount === 0n || !publicClient) return;
    autoDepositRef.current = true;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      approveTx.writeContract({
        address: stakeToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.streamFarm, parsedAmount],
        ...gas,
      });
    } catch {
      autoDepositRef.current = false;
      toast("error", "Transaction Failed", "Failed to prepare approval");
    }
  };

  const handleDeposit = async () => {
    try {
      await runDeposit();
    } catch {
      toast("error", "Transaction Failed", "Failed to prepare deposit");
    }
  };

  useEffect(() => {
    if (!approveRcpt.isSuccess || !autoDepositRef.current || !publicClient) return;
    autoDepositRef.current = false;
    runDeposit().catch(() => toast("error", "Transaction Failed", "Failed to deposit after approval"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess, publicClient]);

  useTransactionSuccess(depositTx, depositRcpt, () => setSuccessOpen(true));

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    depositTx.reset();
    approveTx.reset();
    onClose();
  };

  return (
    <>
      <SuccessModal
        open={successOpen}
        onClose={handleSuccessClose}
        title="Stream Farms"
        heading="Deposit Complete"
        subtext="Your stake is active and you received an NFT position."
        rows={[
          { label: "Farm", value: `#${farmId}` },
          { label: "Amount", value: `${amount} ${symbol}` },
          ...(farmLockDays > 0
            ? [{ label: "Farm lock", value: `${farmLockDays} day${farmLockDays === 1 ? "" : "s"} (set by creator)` }]
            : []),
        ]}
      />
    {!successOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "#0D0B18", border: "1px solid rgba(139,92,246,0.35)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(139,92,246,0.2)" }}>
          <div>
            <p className="font-grotesk uppercase text-[15px] tracking-wider" style={{ color: "#FFFFFF" }}>Deposit {symbol}</p>
            <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Farm #{farmId} · Earn streaming rewards
              {farmLockDays > 0 && ` · ${farmLockDays}d lock`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[rgba(139,92,246,0.15)]" style={{ color: "rgba(255,255,255,0.6)" }}>
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>Amount</label>
              <button onClick={() => setAmount(formatUnits(userBalance, decimals))} className="font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80" style={{ color: "rgba(255,255,255,0.55)" }}>
                Max: {Number(formatUnits(userBalance, decimals)).toLocaleString()}
              </button>
            </div>
            <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0"
              className="w-full bg-transparent rounded-xl px-4 py-3 font-grotesk text-[20px] outline-none"
              style={{ color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.06)" }} />
          </div>

          {farmLockDays > 0 && (
            <p className="font-mono text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              This farm has a {farmLockDays}-day lock set by the creator. Enter your amount and deposit — no extra options needed.
            </p>
          )}

          {(approveTx.isPending || approveRcpt.isLoading) && (
            <p className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>Step 1 of 2 — Approving {symbol}…</p>
          )}
          {(depositTx.isPending || depositRcpt.isLoading) && (
            <p className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>{needsApproval ? "Step 2 of 2 — " : ""}Depositing…</p>
          )}

          <div className="flex gap-3">
            {needsApproval ? (
              <button
                onClick={handleApproveAndDeposit}
                disabled={!parsedAmount || parsedAmount === 0n || parsedAmount > userBalance || approveTx.isPending || approveRcpt.isLoading || depositTx.isPending || depositRcpt.isLoading}
                className="flex-1 rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40 active:scale-[0.99]"
                style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}
              >
                {approveTx.isPending || approveRcpt.isLoading ? "Approving…" : depositTx.isPending || depositRcpt.isLoading ? "Depositing…" : `Approve & Deposit`}
              </button>
            ) : (
              <button
                onClick={handleDeposit}
                disabled={!parsedAmount || parsedAmount === 0n || parsedAmount > userBalance || depositTx.isPending || depositRcpt.isLoading}
                className="flex-1 rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40 active:scale-[0.99]"
                style={{ background: "rgba(139,92,246,0.25)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.55)" }}
              >
                {depositTx.isPending || depositRcpt.isLoading ? "Depositing…" : "Deposit"}
              </button>
            )}
          </div>

          {(depositTx.error || approveTx.error) && (
            <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
              {((depositTx.error || approveTx.error) as any)?.shortMessage ?? (depositTx.error || approveTx.error)?.message}
            </p>
          )}
        </div>
      </div>
    </div>
    )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//                              MY POSITIONS TAB
// ═══════════════════════════════════════════════════════════════════════════

function MyPositionsTab() {
  const { address } = useAccount();
  const contracts = useContracts();

  const positionsQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "positionsOf",
    args: address ? [address] : undefined,
    query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 10_000 },
  });
  const positions = (positionsQ.data as bigint[] | undefined) ?? [];

  if (!address) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Wallet className="w-8 h-8 mb-3" style={{ color: "rgba(255,255,255,0.5)" }} strokeWidth={1.5} />
          <p className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#FFFFFF" }}>Connect Wallet</p>
          <p className="font-mono text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>Connect your wallet to view your positions</p>
        </div>
      </div>
    );
  }

  if (positionsQ.isLoading) {
    return <div className="text-center py-12"><div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: "rgba(139,92,246,0.2)", borderTopColor: "rgba(139,92,246,0.8)" }} /></div>;
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Sprout className="w-8 h-8 mb-3" style={{ color: "rgba(255,255,255,0.5)" }} strokeWidth={1.5} />
          <p className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#FFFFFF" }}>No Positions</p>
          <p className="font-mono text-[11px] mt-1.5 max-w-[300px]" style={{ color: "rgba(255,255,255,0.55)" }}>Deposit into a farm to start earning streaming rewards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)" }}>
        <p className="font-grotesk text-[13px] uppercase tracking-wider" style={{ color: "#FFFFFF" }}>My Positions</p>
        <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
          {positions.length} active position{positions.length !== 1 ? "s" : ""} · Staked amounts, claimable rewards, and claim actions below
        </p>
      </div>
      <div className="grid gap-4">
        {positions.map((id) => (
          <PositionCard
            key={id.toString()}
            tokenId={id}
            onPositionChange={() => positionsQ.refetch()}
          />
        ))}
      </div>
    </div>
  );
}

function PositionCard({ tokenId, onPositionChange }: { tokenId: bigint; onPositionChange?: () => void }) {
  const contracts = useContracts();
  const { toast } = useToast();
  const publicClient = usePublicClient();
  const [successOpen, setSuccessOpen] = useState(false);
  const [successConfig, setSuccessConfig] = useState<{
    heading: string;
    subtext: string;
    rows: { label: string; value: string }[];
    refreshOnClose?: boolean;
  } | null>(null);

  const posQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getPosition", args: [tokenId], query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 } });
  const pendingQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "pendingRewards", args: [tokenId], query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 } });

  const posData = posQ.data as any;
  const pendingData = pendingQ.data as any;

  const claimTx = useWriteContract();
  const claimRcpt = useWaitForTransactionReceipt({ hash: claimTx.data });
  const withdrawTx = useWriteContract();
  const withdrawRcpt = useWaitForTransactionReceipt({ hash: withdrawTx.data });
  const emergencyTx = useWriteContract();
  const emergencyRcpt = useWaitForTransactionReceipt({ hash: emergencyTx.data });

  const showSuccess = (config: NonNullable<typeof successConfig>) => {
    setSuccessConfig(config);
    setSuccessOpen(true);
  };

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    if (successConfig?.refreshOnClose) onPositionChange?.();
    setSuccessConfig(null);
    claimTx.reset();
    withdrawTx.reset();
    emergencyTx.reset();
  };

  // IMPORTANT: All hooks MUST be above any early return
  useTransactionSuccess(claimTx, claimRcpt, () =>
    showSuccess({
      heading: "Rewards Claimed",
      subtext: "Your pending rewards have been sent to your wallet.",
      rows: [{ label: "Position", value: `#${tokenId.toString()}` }],
      refreshOnClose: true,
    }),
  );

  useTransactionSuccess(withdrawTx, withdrawRcpt, () =>
    showSuccess({
      heading: "Withdrawn",
      subtext: "Your position was closed and stake returned to your wallet.",
      rows: [{ label: "Position", value: `#${tokenId.toString()}` }],
      refreshOnClose: true,
    }),
  );

  useTransactionSuccess(emergencyTx, emergencyRcpt, () =>
    showSuccess({
      heading: "Emergency Withdrawn",
      subtext: "Your stake was returned. Unclaimed rewards were forfeited.",
      rows: [{ label: "Position", value: `#${tokenId.toString()}` }],
      refreshOnClose: true,
    }),
  );

  if (!posData) return <div className="rounded-xl p-5 animate-pulse h-28" style={{ border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.03)" }} />;

  const [farmId, amount, shares, depositTime, lockExpiry, boostMultiplier] = posData;

  const handleClaim = async () => {
    if (!publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    claimTx.writeContract({
      address: contracts.streamFarm,
      abi: STREAM_FARM_ABI,
      functionName: "claim",
      args: [tokenId],
      ...gas,
    });
  };

  const handleWithdraw = async () => {
    if (!publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    withdrawTx.writeContract({
      address: contracts.streamFarm,
      abi: STREAM_FARM_ABI,
      functionName: "withdraw",
      args: [tokenId],
      ...gas,
    });
  };

  const handleEmergencyWithdraw = async () => {
    if (!publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    emergencyTx.writeContract({
      address: contracts.streamFarm,
      abi: STREAM_FARM_ABI,
      functionName: "emergencyWithdraw",
      args: [tokenId],
      ...gas,
    });
  };

  const now = Math.floor(Date.now() / 1000);
  const locked = Number(lockExpiry) > now;
  const boost = Number(boostMultiplier) / 1e18;

  return (
    <>
      {successConfig && (
        <SuccessModal
          open={successOpen}
          onClose={handleSuccessClose}
          title="Stream Farms"
          heading={successConfig.heading}
          subtext={successConfig.subtext}
          rows={successConfig.rows}
        />
      )}
    <PositionCardInner tokenId={tokenId} farmId={farmId} amount={amount} boost={boost} locked={locked} lockExpiry={lockExpiry} pendingData={pendingData}
      onClaim={handleClaim} onWithdraw={handleWithdraw} onEmergencyWithdraw={handleEmergencyWithdraw}
      claimPending={claimTx.isPending || claimRcpt.isLoading}
      withdrawPending={withdrawTx.isPending || withdrawRcpt.isLoading || emergencyTx.isPending || emergencyRcpt.isLoading}
      error={claimTx.error || withdrawTx.error || emergencyTx.error} />
    </>
  );
}

function PositionCardInner({ tokenId, farmId, amount, boost, locked, lockExpiry, pendingData, onClaim, onWithdraw, onEmergencyWithdraw, claimPending, withdrawPending, error }: any) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const contracts = useContracts();
  const farmQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getFarm", args: [farmId], query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 } });
  const stakeToken = parseFarmTuple(farmQ.data)?.stakeToken;

  const symbolQ = useReadContract({ address: stakeToken ?? "0x0000000000000000000000000000000000000000", abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!stakeToken } });
  const decimalsQ = useReadContract({ address: stakeToken ?? "0x0000000000000000000000000000000000000000", abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!stakeToken } });
  const getRemoteMeta = useRemoteTokenMeta(stakeToken ? [stakeToken] : []);
  const remote = getRemoteMeta(stakeToken);
  const { profile: dexProfile, loading: dexProfileLoading } = useDexTokenProfile(stakeToken);
  const symbol = remote?.symbol ?? ((symbolQ.data as string) || "...");
  const decimals = remote?.decimals ?? ((decimalsQ.data as number) ?? 18);
  const { priceUsd: stakePriceUsd, loading: stakePriceLoading } = useTokenPriceUsdLive(stakeToken ?? "");

  const rewardEntries = useMemo(() => parsePendingRewards(pendingData), [pendingData]);
  const hasPending = rewardEntries.some((e) => e.amount > 0n);

  const now = Math.floor(Date.now() / 1000);
  const lockDaysLeft = locked ? Math.ceil((Number(lockExpiry) - now) / 86400) : 0;
  const stakedFormatted = Number(formatUnits(amount ?? 0n, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  const stakedUsd = bigintToUsd(amount ?? 0n, decimals, stakePriceUsd);
  const openExplorer = useOpenNftExplorer(contracts.streamFarm, tokenId);
  const boostLabel = boost > 1 ? `${boost.toFixed(2).replace(/\.?0+$/, "")}x` : "1x";

  return (
    <div
      className="rounded-xl overflow-hidden transition"
      style={{ border: "1px solid rgba(255,255,255,0.1)", background: "#0d0d0f" }}
    >
      {stakeToken ? (
        <TokenDexProfileSection
          profile={dexProfile}
          loading={dexProfileLoading}
          symbol={symbol}
          name={remote?.name}
          logoUrl={remote?.logoURI}
          tokenAddress={stakeToken}
          actions={
            <div className="flex items-center gap-2 shrink-0">
              <SharePositionButton kind="farm" tokenId={tokenId} />
              <span
                className="px-2.5 py-1 rounded-full font-mono text-[9px] uppercase tracking-wider"
                style={{
                  background: hasPending ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.06)",
                  color: hasPending ? "#C4B5FD" : "rgba(255,255,255,0.45)",
                  border: `1px solid ${hasPending ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.15)"}`,
                }}
              >
                {hasPending ? "Rewards ready" : "Active"}
              </span>
            </div>
          }
        />
      ) : (
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <NftImage contract={contracts.streamFarm} tokenId={tokenId} size={44} fallbackLetter={symbol} />
          <div>
            <p className="font-grotesk text-[16px] font-semibold" style={{ color: "#FFFFFF" }}>{symbol} Farm</p>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Position #{tokenId.toString()} · Farm #{farmId?.toString()}
            </p>
          </div>
        </div>
      )}

      <div
        className="px-4 sm:px-5 pb-5 pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        {!stakeToken && (
          <p className="font-mono text-[10px] mb-4 text-center sm:text-left" style={{ color: "rgba(255,255,255,0.5)" }}>
            Position #{tokenId.toString()} · Farm #{farmId?.toString()}
          </p>
        )}

      {/* Stats grid — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <PositionStatBox
          label="Total staked"
          value={`${stakedFormatted} ${symbol}`}
          sub={stakePriceLoading ? "…" : stakedUsd > 0 ? formatUsdTable(stakedUsd) : "—"}
          accent
        />
        <FarmClaimableStat entries={rewardEntries} />
        <PositionStatBox
          label="Lock status"
          value={locked ? `${lockDaysLeft}d left` : "Unlocked"}
          sub={locked ? "Stake locked" : "Withdraw anytime"}
          accent={locked}
        />
        <PositionStatBox label="Boost" value={boostLabel} sub={boost > 1 ? "Lock boost active" : "No boost"} />
      </div>

      {/* Rewards breakdown — always visible */}
      <div
        className="rounded-xl px-4 py-3.5 mb-5"
        style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(139,92,246,0.25)" }}
      >
        <p className="font-mono text-[9px] uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
          Rewards breakdown
        </p>
        {rewardEntries.length === 0 ? (
          <p className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            No reward streams on this farm yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {rewardEntries.map((e, i) => (
              <PendingRewardLine key={`${e.token}-${i}`} token={e.token} amount={e.amount} highlight={e.amount > 0n} />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2.5" onClick={stopPositionRowClick}>
        <button
          type="button"
          onClick={onClaim}
          disabled={!hasPending || claimPending}
          className="flex-1 rounded-xl py-3.5 font-grotesk text-[12px] font-semibold uppercase tracking-wider transition disabled:opacity-45 active:scale-[0.99]"
          style={{
            background: hasPending ? "rgba(139,92,246,0.45)" : "rgba(139,92,246,0.12)",
            color: "#FFFFFF",
            border: `1px solid ${hasPending ? "rgba(167,139,250,0.7)" : "rgba(139,92,246,0.25)"}`,
          }}
        >
          {claimPending ? "Claiming…" : hasPending ? "Claim rewards" : "Nothing to claim"}
        </button>
        <button
          type="button"
          onClick={onWithdraw}
          disabled={withdrawPending || locked}
          className="sm:w-36 rounded-xl py-3.5 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-45 active:scale-[0.99]"
          style={{ background: "rgba(139,92,246,0.1)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.35)" }}
          title={locked ? `Locked for ${lockDaysLeft} more days` : undefined}
        >
          {withdrawPending ? "Withdrawing…" : locked ? "Locked" : "Withdraw"}
        </button>
        <button
          type="button"
          onClick={openExplorer}
          className="sm:w-36 rounded-xl py-3.5 font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-90"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          View NFT
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="mt-3 font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        {showAdvanced ? "Hide" : "Show"} advanced options
      </button>

      {showAdvanced && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(139,92,246,0.15)" }}>
          <p className="font-mono text-[10px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            Emergency withdraw returns your stake only and forfeits unclaimed rewards. Use if normal withdraw fails (e.g. too many reward streams).
          </p>
          <button
            type="button"
            onClick={onEmergencyWithdraw}
            disabled={withdrawPending}
            className="px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(255,120,80,0.12)", color: "#FCA5A5", border: "1px solid rgba(255,120,80,0.35)" }}
          >
            Emergency withdraw
          </button>
        </div>
      )}

      {error && (
        <p className="font-mono text-[10px] mt-3 break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
          {(error as any)?.shortMessage ?? error?.message}
        </p>
      )}
      </div>
    </div>
  );
}

function PositionStatBox({
  label,
  value,
  sub,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 min-w-0"
      style={{
        background: "rgba(0,0,0,0.35)",
        border: highlight ? "1px solid rgba(167,139,250,0.65)" : "1px solid rgba(139,92,246,0.2)",
      }}
    >
      <p className="font-mono text-[8px] uppercase tracking-wider truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <p
        className="font-mono text-[11px] sm:text-[12px] mt-1 font-medium truncate"
        style={{ color: accent ? "#C4B5FD" : "#FFFFFF" }}
      >
        {value}
      </p>
      {sub && (
        <p className="font-mono text-[9px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function FarmClaimableStat({ entries }: { entries: { token: string; amount: bigint }[] }) {
  const { totalUsd, loading, summary } = useRewardEntriesUsd(entries);
  const hasClaimable = entries.some((e) => e.amount > 0n);
  return (
    <PositionStatBox
      label="Claimable now"
      value={summary}
      sub={loading ? "Fetching prices…" : totalUsd > 0 ? formatUsdTable(totalUsd) : entries.length > 0 ? "Earned (no USD price)" : "—"}
      accent={hasClaimable}
      highlight={hasClaimable}
    />
  );
}

function useRewardEntriesUsd(entries: { token: string; amount: bigint }[]) {
  const metaQ = useReadContracts({
    allowFailure: true,
    contracts: entries.flatMap((e) => [
      { address: e.token as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" as const },
      { address: e.token as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" as const },
    ]),
    query: { enabled: entries.length > 0, refetchInterval: 10_000 },
  });

  const [totalUsd, setTotalUsd] = useState(0);
  const [loading, setLoading] = useState(entries.length > 0);

  useEffect(() => {
    if (entries.length === 0) {
      setTotalUsd(0);
      setLoading(false);
      return;
    }
    if (!metaQ.data) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { getTokenPriceUsd } = await import("@/lib/web3/dexscreener");
      let sum = 0;

      for (let i = 0; i < entries.length; i++) {
        const { token, amount } = entries[i];
        const dec = (metaQ.data?.[i * 2 + 1]?.result as number | undefined) ?? 18;
        const price = await getTokenPriceUsd(token).catch(() => null);
        sum += bigintToUsd(amount, dec, price ?? 0);
      }

      if (!cancelled) {
        setTotalUsd(sum);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries, metaQ.data]);

  const summary = (() => {
    if (entries.length === 0) return "0";
    if (!metaQ.data) return "…";
    const parts: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].amount === 0n) continue;
      const sym = (metaQ.data[i * 2]?.result as string | undefined) ?? "…";
      const dec = (metaQ.data[i * 2 + 1]?.result as number | undefined) ?? 18;
      const formatted = Number(formatUnits(entries[i].amount, dec)).toLocaleString(undefined, { maximumFractionDigits: 4 });
      parts.push(`${formatted} ${sym}`);
    }
    return parts.length > 0 ? parts.join(" + ") : "0";
  })();

  return { totalUsd, loading, summary };
}

function PendingRewardLine({ token, amount, highlight }: { token: string; amount: bigint; highlight?: boolean }) {
  const symbolQ = useReadContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!token } });
  const decimalsQ = useReadContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!token } });
  const { priceUsd, loading } = useTokenPriceUsdLive(token);
  const sym = (symbolQ.data as string) || "...";
  const dec = (decimalsQ.data as number) ?? 18;
  const formatted = Number(formatUnits(amount, dec)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  const usd = bigintToUsd(amount, dec, priceUsd);

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
        {sym}
      </span>
      <div className="text-right min-w-0">
        <p className="font-mono text-[11px] font-medium truncate" style={{ color: highlight ? "#C4B5FD" : "rgba(255,255,255,0.55)" }}>
          {formatted} {sym}
        </p>
        <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          {loading ? "…" : usd > 0 ? formatUsdTable(usd) : amount > 0n ? "—" : "$0.00"}
        </p>
      </div>
    </div>
  );
}
