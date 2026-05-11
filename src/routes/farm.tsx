import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Sprout, Plus, X, Zap, Clock, Wallet } from "lucide-react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { STREAM_FARM_ABI, CONTRACTS, ERC20_ABI } from "@/lib/web3/contracts";
import { TokenPicker } from "@/components/TokenPicker";
import type { TokenInfo } from "@/lib/web3/tokens";

export const Route = createFileRoute("/farm")({
  component: FarmPage,
  head: () => ({ meta: [{ title: "Stream Farms — The Dog House" }, { name: "description", content: "Streaming reward farms on Monad." }] }),
});

const TABS = ["All Farms", "My Positions"] as const;
type Tab = (typeof TABS)[number];

function useContracts() {
  const chainId = useChainId();
  return CONTRACTS[chainId] ?? CONTRACTS[10143];
}

function FarmPage() {
  const [activeTab, setActiveTab] = useState<Tab>("All Farms");
  const [search, setSearch] = useState("");
  const { address } = useAccount();
  const contracts = useContracts();

  const farmCountQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "farmCount", query: { refetchInterval: 10_000 } });
  const farmCount = Number(farmCountQ.data ?? 0);

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>Stream Farms</h1>
            <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
              Continuous reward streaming · Deposit · Earn · Withdraw anytime
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-0.5 p-1 rounded-full" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
            {TABS.map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap"
                style={activeTab === t ? { background: "rgba(155,127,212,0.35)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" } : { color: "rgba(196,168,240,0.5)" }}>
                {t}
              </button>
            ))}
          </div>
          {activeTab === "All Farms" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
              <Search className="w-3.5 h-3.5" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
              <input type="text" placeholder="Search farms…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent font-mono text-[11px] outline-none w-32 sm:w-44" style={{ color: "#EDE0FF" }} />
            </div>
          )}
        </div>

        {activeTab === "All Farms" && <AllFarmsTab farmCount={farmCount} />}
        {activeTab === "My Positions" && <MyPositionsTab />}
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
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.35)" }}>
            <Sprout className="w-5 h-5" style={{ color: "rgba(196,168,240,0.7)" }} strokeWidth={1.5} />
          </div>
          <p className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#EDE0FF" }}>No Farms Yet</p>
          <p className="font-mono text-[11px] mt-2 max-w-[300px]" style={{ color: "rgba(196,168,240,0.55)" }}>
            Farms are created by the admin from the Admin dashboard. Check back soon!
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

  const farmQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getFarm", args: [BigInt(farmId)], query: { refetchInterval: 10_000 } });
  const data = farmQ.data as any;
  if (!data) return <div className="rounded-xl p-5 animate-pulse h-36" style={{ border: "1px solid rgba(155,127,212,0.2)", background: "rgba(155,127,212,0.03)" }} />;

  const [stakeToken, , totalStaked, active, lockDuration, earlyWithdrawBps, rewardStreamCount] = data;
  const rewardCount = Number(rewardStreamCount ?? 0);
  const lockDays = Number(lockDuration ?? 0) / 86400;
  const penaltyPct = Number(earlyWithdrawBps ?? 0) / 100;

  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
      <FarmCardInner farmId={farmId} stakeToken={stakeToken} totalStaked={totalStaked} active={active} lockDays={lockDays} penaltyPct={penaltyPct} rewardCount={rewardCount} showDeposit={showDeposit} setShowDeposit={setShowDeposit} />
    </div>
  );
}

function FarmCardInner({ farmId, stakeToken, totalStaked, active, lockDays, penaltyPct, rewardCount, showDeposit, setShowDeposit }: any) {
  const { address } = useAccount();
  const contracts = useContracts();
  const symbolQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!stakeToken } });
  const decimalsQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!stakeToken } });
  const balanceQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address && !!stakeToken, refetchInterval: 10_000 } });

  const symbol = (symbolQ.data as string) || "...";
  const decimals = (decimalsQ.data as number) ?? 18;
  const userBalance = (balanceQ.data as bigint) ?? 0n;

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-grotesk uppercase text-[16px] tracking-wider" style={{ color: "#EDE0FF" }}>{symbol} Farm</p>
            <span className="px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider"
              style={{ background: active ? "rgba(155,127,212,0.2)" : "rgba(255,120,120,0.15)", color: active ? "#C4A8F0" : "rgba(255,120,120,0.9)", border: `1px solid ${active ? "rgba(155,127,212,0.4)" : "rgba(255,120,120,0.3)"}` }}>
              {active ? "Live" : "Paused"}
            </span>
            {lockDays > 0 && (
              <span className="px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider flex items-center gap-1"
                style={{ background: "rgba(155,127,212,0.12)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.3)" }}>
                <Clock className="w-2.5 h-2.5" /> {lockDays}d lock
              </span>
            )}
          </div>
          <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.55)" }}>
            Farm #{farmId} · {rewardCount} reward stream{rewardCount !== 1 ? "s" : ""} · Streaming
          </p>
        </div>
        {address && active && (
          <button onClick={() => setShowDeposit(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-90 active:scale-[0.98]"
            style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Deposit
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatBox label="Total Staked" value={`${Number(formatUnits(totalStaked ?? 0n, decimals)).toLocaleString()} ${symbol}`} />
        <StatBox label="Your Balance" value={`${Number(formatUnits(userBalance, decimals)).toLocaleString()} ${symbol}`} />
        <StatBox label="Reward Streams" value={`${rewardCount}`} accent />
        <StatBox label="Early Exit Fee" value={penaltyPct > 0 ? `${penaltyPct}%` : "None"} />
      </div>

      {rewardCount > 0 && <RewardStreams farmId={farmId} count={rewardCount} />}

      {showDeposit && (
        <DepositModal farmId={farmId} stakeToken={stakeToken} symbol={symbol} decimals={decimals} userBalance={userBalance} onClose={() => setShowDeposit(false)} />
      )}
    </>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}>
      <p className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: "rgba(196,168,240,0.5)" }}>{label}</p>
      <p className="font-mono text-[13px]" style={{ color: accent ? "#9be8a4" : "#EDE0FF" }}>{value}</p>
    </div>
  );
}

function RewardStreams({ farmId, count }: { farmId: number; count: number }) {
  const contracts = useContracts();
  const streamsQ = useReadContracts({
    allowFailure: true,
    contracts: Array.from({ length: count }, (_, i) => ({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getRewardStream" as const, args: [BigInt(farmId), BigInt(i)] as const })),
    query: { refetchInterval: 10_000 },
  });

  return (
    <div className="mt-3 space-y-2">
      <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>Reward Streams</p>
      {Array.from({ length: count }, (_, i) => {
        const d = streamsQ.data?.[i];
        if (d?.status !== "success") return null;
        const [token, rewardRate, startTime, endTime, totalBudget, totalDistributed] = d.result as any;
        return <RewardStreamRow key={i} token={token} rewardRate={rewardRate} startTime={startTime} endTime={endTime} totalBudget={totalBudget} totalDistributed={totalDistributed} />;
      })}
    </div>
  );
}

function RewardStreamRow({ token, rewardRate, startTime, endTime, totalBudget, totalDistributed }: any) {
  const symbolQ = useReadContract({ address: token, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!token } });
  const decimalsQ = useReadContract({ address: token, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!token } });
  const sym = (symbolQ.data as string) || "...";
  const dec = (decimalsQ.data as number) ?? 18;
  const now = Math.floor(Date.now() / 1000);
  const start = Number(startTime); const end = Number(endTime);
  const isActive = now >= start && now < end;
  const isEnded = now >= end;
  const progress = end > start ? Math.min(100, ((now - start) / (end - start)) * 100) : 0;
  const ratePerDay = Number(formatUnits(BigInt(rewardRate) * 86400n / BigInt(1e18), dec));

  return (
    <div className="rounded-lg p-3 flex items-center justify-between gap-3" style={{ background: "rgba(155,127,212,0.04)", border: "1px solid rgba(155,127,212,0.15)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? "#9be8a4" : "rgba(196,168,240,0.4)" }} strokeWidth={1.5} />
        <div className="min-w-0">
          <p className="font-mono text-[11px] truncate" style={{ color: "#EDE0FF" }}>{sym} · <span style={{ color: "rgba(196,168,240,0.6)" }}>{ratePerDay.toFixed(2)}/day</span></p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: "rgba(155,127,212,0.2)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: isEnded ? "rgba(196,168,240,0.4)" : "#9be8a4" }} />
            </div>
            <span className="font-mono text-[8px]" style={{ color: "rgba(196,168,240,0.5)" }}>{isEnded ? "Ended" : isActive ? "Streaming" : "Pending"}</span>
          </div>
        </div>
      </div>
      <p className="font-mono text-[10px] shrink-0" style={{ color: "rgba(196,168,240,0.6)" }}>
        {Number(formatUnits(totalDistributed, dec)).toLocaleString()} / {Number(formatUnits(totalBudget, dec)).toLocaleString()} {sym}
      </p>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//                              DEPOSIT MODAL
// ═══════════════════════════════════════════════════════════════════════════

function DepositModal({ farmId, stakeToken, symbol, decimals, userBalance, onClose }: { farmId: number; stakeToken: `0x${string}`; symbol: string; decimals: number; userBalance: bigint; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [lockTier, setLockTier] = useState(0);
  const { toast } = useToast();
  const contracts = useContracts();

  const boostQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getBoostTiers" });
  const boostData = boostQ.data as any;
  const durations: bigint[] = boostData?.[0] ?? [];
  const multipliers: bigint[] = boostData?.[1] ?? [];

  // Approve
  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  // Deposit
  const depositTx = useWriteContract();
  const depositRcpt = useWaitForTransactionReceipt({ hash: depositTx.data });

  const parsedAmount = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();

  // Check allowance
  const { address } = useAccount();
  const allowanceQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "allowance", args: address ? [address, contracts.streamFarm] : undefined, query: { enabled: !!address, refetchInterval: 5_000 } });
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = parsedAmount > 0n && allowance < parsedAmount;

  const handleApprove = () => {
    approveTx.writeContract({ address: stakeToken, abi: ERC20_ABI, functionName: "approve", args: [contracts.streamFarm, parsedAmount] });
  };

  const handleDeposit = () => {
    if (!parsedAmount || parsedAmount === 0n) return;
    depositTx.writeContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "deposit", args: [BigInt(farmId), parsedAmount, BigInt(lockTier)] });
  };

  if (depositRcpt.isSuccess) {
    toast("success", "Deposited!", `${amount} ${symbol} deposited into farm. You received an NFT position.`);
    onClose();
  }

  const boostLabel = (tier: number) => {
    if (tier === 0) return "No lock · 1x";
    const idx = tier - 1;
    const days = Number(durations[idx] ?? 0n) / 86400;
    const mult = Number(multipliers[idx] ?? 1000000000000000000n) / 1e18;
    return `${days}d lock · ${mult}x`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(6,4,15,0.85)", backdropFilter: "blur(8px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "#0D0B18", border: "1px solid rgba(155,127,212,0.35)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(155,127,212,0.2)" }}>
          <div>
            <p className="font-grotesk uppercase text-[15px] tracking-wider" style={{ color: "#EDE0FF" }}>Deposit {symbol}</p>
            <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(196,168,240,0.5)" }}>Farm #{farmId} · Earn streaming rewards</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[rgba(155,127,212,0.15)]" style={{ color: "rgba(196,168,240,0.6)" }}>
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.55)" }}>Amount</label>
              <button onClick={() => setAmount(formatUnits(userBalance, decimals))} className="font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80" style={{ color: "rgba(196,168,240,0.55)" }}>
                Max: {Number(formatUnits(userBalance, decimals)).toLocaleString()}
              </button>
            </div>
            <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0"
              className="w-full bg-transparent rounded-xl px-4 py-3 font-grotesk text-[20px] outline-none"
              style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }} />
          </div>

          {/* Boost tier selector */}
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Lock Boost (optional)</label>
            <div className="grid grid-cols-2 gap-2">
              {[0, ...durations.map((_, i) => i + 1)].map((tier) => (
                <button key={tier} onClick={() => setLockTier(tier)}
                  className="px-3 py-2 rounded-lg font-mono text-[10px] transition text-left"
                  style={{ background: lockTier === tier ? "rgba(155,127,212,0.2)" : "rgba(155,127,212,0.05)", border: `1px solid ${lockTier === tier ? "rgba(155,127,212,0.5)" : "rgba(155,127,212,0.2)"}`, color: lockTier === tier ? "#EDE0FF" : "rgba(196,168,240,0.6)" }}>
                  {boostLabel(tier)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            {needsApproval ? (
              <button onClick={handleApprove} disabled={approveTx.isPending || approveRcpt.isLoading}
                className="flex-1 rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40 active:scale-[0.99]"
                style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
                {approveTx.isPending || approveRcpt.isLoading ? "Approving..." : "Approve"}
              </button>
            ) : (
              <button onClick={handleDeposit} disabled={!parsedAmount || parsedAmount === 0n || parsedAmount > userBalance || depositTx.isPending || depositRcpt.isLoading}
                className="flex-1 rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40 active:scale-[0.99]"
                style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.55)" }}>
                {depositTx.isPending || depositRcpt.isLoading ? "Depositing..." : "Deposit"}
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
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//                              MY POSITIONS TAB
// ═══════════════════════════════════════════════════════════════════════════

function MyPositionsTab() {
  const { address } = useAccount();
  const contracts = useContracts();

  const positionsQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "positionsOf", args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 10_000 } });
  const positions = (positionsQ.data as bigint[] | undefined) ?? [];

  if (!address) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Wallet className="w-8 h-8 mb-3" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
          <p className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#EDE0FF" }}>Connect Wallet</p>
          <p className="font-mono text-[11px] mt-1.5" style={{ color: "rgba(196,168,240,0.55)" }}>Connect your wallet to view your positions</p>
        </div>
      </div>
    );
  }

  if (positionsQ.isLoading) {
    return <div className="text-center py-12"><div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: "rgba(155,127,212,0.2)", borderTopColor: "rgba(155,127,212,0.8)" }} /></div>;
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Sprout className="w-8 h-8 mb-3" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
          <p className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#EDE0FF" }}>No Positions</p>
          <p className="font-mono text-[11px] mt-1.5 max-w-[300px]" style={{ color: "rgba(196,168,240,0.55)" }}>Deposit into a farm to start earning streaming rewards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.6)" }}>{positions.length} position{positions.length !== 1 ? "s" : ""}</p>
      <div className="grid gap-4">
        {positions.map((id) => <PositionCard key={id.toString()} tokenId={id} />)}
      </div>
    </div>
  );
}

function PositionCard({ tokenId }: { tokenId: bigint }) {
  const contracts = useContracts();
  const { toast } = useToast();

  const posQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getPosition", args: [tokenId], query: { refetchInterval: 10_000 } });
  const pendingQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "pendingRewards", args: [tokenId], query: { refetchInterval: 10_000 } });

  const posData = posQ.data as any;
  const pendingData = pendingQ.data as any;

  const claimTx = useWriteContract();
  const claimRcpt = useWaitForTransactionReceipt({ hash: claimTx.data });
  const withdrawTx = useWriteContract();
  const withdrawRcpt = useWaitForTransactionReceipt({ hash: withdrawTx.data });

  if (!posData) return <div className="rounded-xl p-5 animate-pulse h-28" style={{ border: "1px solid rgba(155,127,212,0.2)", background: "rgba(155,127,212,0.03)" }} />;

  const [farmId, amount, shares, depositTime, lockExpiry, boostMultiplier] = posData;

  const handleClaim = () => { claimTx.writeContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "claim", args: [tokenId] }); };
  const handleWithdraw = () => { withdrawTx.writeContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "withdraw", args: [tokenId] }); };

  if (claimRcpt.isSuccess) toast("success", "Rewards claimed!", "Your pending rewards have been sent to your wallet.");
  if (withdrawRcpt.isSuccess) toast("success", "Withdrawn!", "Position closed and tokens returned.");

  const now = Math.floor(Date.now() / 1000);
  const locked = Number(lockExpiry) > now;
  const boost = Number(boostMultiplier) / 1e18;

  return (
    <PositionCardInner tokenId={tokenId} farmId={farmId} amount={amount} boost={boost} locked={locked} lockExpiry={lockExpiry} pendingData={pendingData}
      onClaim={handleClaim} onWithdraw={handleWithdraw} claimPending={claimTx.isPending || claimRcpt.isLoading} withdrawPending={withdrawTx.isPending || withdrawRcpt.isLoading}
      error={claimTx.error || withdrawTx.error} />
  );
}

function PositionCardInner({ tokenId, farmId, amount, boost, locked, lockExpiry, pendingData, onClaim, onWithdraw, claimPending, withdrawPending, error }: any) {
  const contracts = useContracts();
  const farmQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "getFarm", args: [farmId], query: { refetchInterval: 30_000 } });
  const farmData = farmQ.data as any;
  const stakeToken = farmData?.[0];

  const symbolQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!stakeToken } });
  const decimalsQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!stakeToken } });
  const symbol = (symbolQ.data as string) || "...";
  const decimals = (decimalsQ.data as number) ?? 18;

  const pendingTokens: string[] = pendingData?.[0] ?? [];
  const pendingAmounts: bigint[] = pendingData?.[1] ?? [];
  const hasPending = pendingAmounts.some((a: bigint) => a > 0n);

  const now = Math.floor(Date.now() / 1000);
  const lockDaysLeft = locked ? Math.ceil((Number(lockExpiry) - now) / 86400) : 0;

  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#EDE0FF" }}>Position #{tokenId.toString()}</p>
            {locked && <span className="px-2 py-0.5 rounded-full font-mono text-[8px] uppercase" style={{ background: "rgba(155,127,212,0.12)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.3)" }}>Locked {lockDaysLeft}d</span>}
            {boost > 1 && <span className="px-2 py-0.5 rounded-full font-mono text-[8px] uppercase" style={{ background: "rgba(155,127,212,0.12)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.3)" }}>{boost}x boost</span>}
          </div>
          <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.55)" }}>Farm #{farmId?.toString()} · {symbol}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClaim} disabled={claimPending || !hasPending}
            className="px-3 py-2 rounded-full font-grotesk text-[10px] uppercase tracking-wider transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
            {claimPending ? "..." : "Claim"}
          </button>
          <button onClick={onWithdraw} disabled={withdrawPending}
            className="px-3 py-2 rounded-full font-grotesk text-[10px] uppercase tracking-wider transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "rgba(155,127,212,0.12)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.4)" }}>
            {withdrawPending ? "..." : "Withdraw"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatBox label="Staked" value={`${Number(formatUnits(amount ?? 0n, decimals)).toLocaleString()} ${symbol}`} />
        <StatBox label="Boost" value={`${boost}x`} accent={boost > 1} />
        <div className="rounded-lg p-3 col-span-2 lg:col-span-1" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}>
          <p className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: "rgba(196,168,240,0.5)" }}>Pending Rewards</p>
          {pendingAmounts.length === 0 ? (
            <p className="font-mono text-[12px]" style={{ color: "rgba(196,168,240,0.4)" }}>—</p>
          ) : (
            <div className="space-y-0.5">
              {pendingAmounts.map((amt: bigint, i: number) => amt > 0n ? <PendingRewardLine key={i} token={pendingTokens[i]} amount={amt} /> : null)}
              {!hasPending && <p className="font-mono text-[12px]" style={{ color: "rgba(196,168,240,0.4)" }}>None yet</p>}
            </div>
          )}
        </div>
      </div>

      {error && <p className="font-mono text-[10px] mt-3 break-words" style={{ color: "rgba(255,100,100,0.9)" }}>{(error as any)?.shortMessage ?? error?.message}</p>}
    </div>
  );
}

function PendingRewardLine({ token, amount }: { token: string; amount: bigint }) {
  const symbolQ = useReadContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!token } });
  const decimalsQ = useReadContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!token } });
  const sym = (symbolQ.data as string) || "...";
  const dec = (decimalsQ.data as number) ?? 18;
  return <p className="font-mono text-[12px]" style={{ color: "#9be8a4" }}>{Number(formatUnits(amount, dec)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {sym}</p>;
}
