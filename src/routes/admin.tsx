import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { Plus } from "lucide-react";
import { useToast } from "@/components/Toast";
import { YIELD_FARM_NFT_ABI, ERC20_ABI } from "@/lib/web3/contracts";
import { TokenPicker } from "@/components/TokenPicker";
import type { TokenInfo } from "@/lib/web3/tokens";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — The Dog House" }] }),
});

const ADMIN_ADDRESS = "0x0F5ddCFA6b2BbD7E24f8B98a3634273A4B5a834C" as `0x${string}`;
const YIELD_FARM_NFT = "0x330b72ea1A45b392BfccE383d1876F5e3d7bb74d" as `0x${string}`;
const TABS = ["Pools", "Rewards", "Settings", "Stats"] as const;
type Tab = (typeof TABS)[number];

// ─────────────────────────────────────────────────────────────────────────────

function AdminPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("Pools");
  const isAdmin = address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  if (isConnected && !isAdmin) return <Navigate to="/" />;
  if (!isConnected) return <Navigate to="/" />;

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        {/* Header — text only, no icon */}
        <div className="mb-7">
          <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>
            Admin Dashboard
          </h1>
          <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
            Manage farms, pools, and platform settings
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 p-1 rounded-full mb-6" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="flex-1 px-4 py-2 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap"
              style={activeTab === t
                ? { background: "rgba(155,127,212,0.35)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" }
                : { color: "rgba(196,168,240,0.5)" }}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === "Pools"    && <PoolsTab />}
        {activeTab === "Rewards"  && <RewardsTab />}
        {activeTab === "Settings" && <SettingsTab />}
        {activeTab === "Stats"    && <StatsTab />}
      </div>
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  POOLS TAB — full width table
// ═══════════════════════════════════════════════════════════════════════════

function PoolsTab() {
  const [showCreate, setShowCreate] = useState(false);
  const poolLengthQuery = useReadContract({
    address: YIELD_FARM_NFT, abi: YIELD_FARM_NFT_ABI, functionName: "poolLength",
    query: { refetchInterval: 10_000 },
  });
  const poolCount = Number(poolLengthQuery.data ?? 0);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-5">
        <p className="font-grotesk uppercase text-[16px] tracking-wider" style={{ color: "rgba(237,224,255,0.9)" }}>
          Farm Pools ({poolCount})
        </p>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-90"
          style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          {showCreate ? "Cancel" : "Create Pool"}
        </button>
      </div>

      {showCreate && <CreatePoolForm onClose={() => setShowCreate(false)} />}

      {poolCount === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid rgba(155,127,212,0.3)" }}>
          <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>No Pools Yet</p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.55)" }}>Create your first farm pool to get started</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden w-full" style={{ border: "1px solid rgba(155,127,212,0.3)" }}>
          {/* Table header */}
          <div
            className="hidden sm:grid px-5 py-3 font-mono text-[9px] uppercase tracking-[0.2em]"
            style={{ gridTemplateColumns: "60px 1fr 1fr 1fr 90px", background: "rgba(155,127,212,0.08)", borderBottom: "1px solid rgba(155,127,212,0.2)", color: "rgba(196,168,240,0.6)" }}
          >
            <div>Pool</div>
            <div>Stake Token</div>
            <div className="text-right">Total Staked</div>
            <div className="text-right">Creator</div>
            <div className="text-right">Status</div>
          </div>
          {Array.from({ length: poolCount }, (_, i) => (
            <PoolRow key={i} poolId={i} isLast={i === poolCount - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoolRow({ poolId, isLast }: { poolId: number; isLast: boolean }) {
  const poolInfoQuery = useReadContract({
    address: YIELD_FARM_NFT, abi: YIELD_FARM_NFT_ABI, functionName: "getPoolInfo",
    args: [BigInt(poolId)], query: { refetchInterval: 10_000 },
  });
  const info = poolInfoQuery.data as any;
  const stakeToken: string | undefined = info?.stakeToken ?? info?.[0];
  const totalStaked: bigint | undefined = info?.totalStaked ?? info?.[2];
  const creator: string | undefined    = info?.creator    ?? info?.[1];
  const active: boolean | undefined    = info?.active     ?? info?.[5];

  const symQ = useReadContract({
    address: stakeToken as `0x${string}`, abi: ERC20_ABI, functionName: "symbol",
    query: { enabled: !!stakeToken, refetchInterval: 10_000 },
  });
  const symbol = (symQ.data as string | undefined) ?? "—";

  return (
    <div
      className="grid sm:grid-cols-[60px_1fr_1fr_1fr_90px] grid-cols-[60px_1fr_90px] px-5 py-3.5 items-center hover:bg-[rgba(155,127,212,0.03)] transition-colors"
      style={{ borderBottom: isLast ? "none" : "1px solid rgba(155,127,212,0.12)" }}
    >
      <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.6)" }}>#{poolId}</p>
      <div className="min-w-0">
        <p className="font-grotesk uppercase text-[12px] tracking-wider" style={{ color: "#EDE0FF" }}>{symbol}</p>
        <p className="font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.4)" }}>
          {stakeToken ? `${stakeToken.slice(0, 8)}…${stakeToken.slice(-6)}` : "Loading…"}
        </p>
      </div>
      <p className="hidden sm:block text-right font-mono text-[11px] tabular-nums" style={{ color: "rgba(237,224,255,0.85)" }}>
        {totalStaked !== undefined ? totalStaked.toString() : "—"}
      </p>
      <p className="hidden sm:block text-right font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.4)" }}>
        {creator ? `${creator.slice(0, 8)}…${creator.slice(-6)}` : "—"}
      </p>
      <div className="text-right">
        <span
          className="px-2 py-0.5 rounded-full font-mono text-[8px] uppercase tracking-wider"
          style={{
            background: active ? "rgba(155,232,164,0.12)" : "rgba(255,120,120,0.12)",
            color: active ? "#9be8a4" : "rgba(255,120,120,0.9)",
            border: `1px solid ${active ? "rgba(155,232,164,0.25)" : "rgba(255,120,120,0.25)"}`,
          }}
        >
          {active ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}

function CreatePoolForm({ onClose }: { onClose: () => void }) {
  const [stakeToken, setStakeToken] = useState<(TokenInfo & { balance: bigint }) | undefined>();
  const { toast } = useToast();
  const createTx   = useWriteContract();
  const createRcpt = useWaitForTransactionReceipt({ hash: createTx.data });

  const handleCreate = () => {
    if (!stakeToken) return;
    createTx.writeContract({ address: YIELD_FARM_NFT, abi: YIELD_FARM_NFT_ABI, functionName: "createPool", args: [stakeToken.address] });
  };
  if (createRcpt.isSuccess) { toast("success", "Pool created", "New farm pool created!"); onClose(); }

  return (
    <div className="rounded-xl p-5 mb-5 space-y-4" style={{ border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.04)" }}>
      <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>Create New Pool</p>
      <div>
        <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Stake Token</label>
        <TokenPicker selected={stakeToken} onSelect={setStakeToken} excludeNative />
      </div>
      <button
        onClick={handleCreate}
        disabled={!stakeToken || createTx.isPending || createRcpt.isLoading}
        className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40"
        style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
      >
        {createTx.isPending || createRcpt.isLoading ? "Creating…" : "Create Pool"}
      </button>
      {createTx.error && (
        <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
          {(createTx.error as any)?.shortMessage ?? createTx.error.message}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  REWARDS TAB — full width
// ═══════════════════════════════════════════════════════════════════════════

function RewardsTab() {
  const [poolId, setPoolId]             = useState("");
  const [rewardToken, setRewardToken]   = useState<(TokenInfo & { balance: bigint }) | undefined>();
  const [rewardPerSecond, setRPS]       = useState("");
  const [duration, setDuration]         = useState("");
  const [totalSupply, setTotalSupply]   = useState("");
  const { toast } = useToast();

  const addRewardTx   = useWriteContract();
  const addRewardRcpt = useWaitForTransactionReceipt({ hash: addRewardTx.data });

  const handleAddReward = () => {
    if (!rewardToken || !poolId || !rewardPerSecond || !totalSupply) return;
    addRewardTx.writeContract({
      address: YIELD_FARM_NFT, abi: YIELD_FARM_NFT_ABI, functionName: "addReward",
      args: [
        BigInt(poolId),
        rewardToken.address,
        parseUnits(rewardPerSecond, rewardToken.decimals),
        BigInt(duration ? parseInt(duration) * 86400 : 0),
        parseUnits(totalSupply, rewardToken.decimals),
      ],
    });
  };

  if (addRewardRcpt.isSuccess) {
    toast("success", "Reward added", "Reward token added to pool!");
    setPoolId(""); setRewardToken(undefined); setRPS(""); setDuration(""); setTotalSupply("");
    addRewardTx.reset();
  }

  return (
    <div className="w-full">
      <p className="font-grotesk uppercase text-[16px] tracking-wider mb-5" style={{ color: "rgba(237,224,255,0.9)" }}>
        Add Reward to Pool
      </p>

      <div className="rounded-xl p-6 space-y-5 w-full" style={{ border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.04)" }}>
        {/* Pool ID + Reward Token side by side on desktop */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Pool ID</label>
            <input
              type="number" value={poolId} onChange={(e) => setPoolId(e.target.value)} placeholder="0"
              className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[13px] outline-none"
              style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
            />
          </div>
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Reward Token</label>
            <TokenPicker selected={rewardToken} onSelect={setRewardToken} excludeNative />
          </div>
        </div>

        {/* Per Second + Duration + Total Supply in a row */}
        <div className="grid sm:grid-cols-3 gap-5">
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Reward Per Second</label>
            <input
              type="text" value={rewardPerSecond} onChange={(e) => setRPS(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="1.0"
              className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[13px] outline-none"
              style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
            />
          </div>
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Duration (days)</label>
            <input
              type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30"
              className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[13px] outline-none"
              style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
            />
          </div>
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Total Supply</label>
            <input
              type="text" value={totalSupply} onChange={(e) => setTotalSupply(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="10000"
              className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[13px] outline-none"
              style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
            />
          </div>
        </div>

        <button
          onClick={handleAddReward}
          disabled={!rewardToken || !poolId || !rewardPerSecond || !totalSupply || addRewardTx.isPending || addRewardRcpt.isLoading}
          className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40"
          style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
        >
          {addRewardTx.isPending || addRewardRcpt.isLoading ? "Adding…" : "Add Reward"}
        </button>

        {addRewardTx.error && (
          <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
            {(addRewardTx.error as any)?.shortMessage ?? addRewardTx.error.message}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SETTINGS TAB — no icons
// ═══════════════════════════════════════════════════════════════════════════

function SettingsTab() {
  return (
    <div className="w-full space-y-4">
      <p className="font-grotesk uppercase text-[16px] tracking-wider mb-5" style={{ color: "rgba(237,224,255,0.9)" }}>
        Platform Settings
      </p>
      <SettingRow title="Pool Creation Fee"  description="Fee required to create a new pool"  value="100 tokens" />
      <SettingRow title="Platform Fee"       description="Fee taken on withdrawals"            value="1%" />
      <SettingRow title="Emission Rate"      description="Base emission rate per second"       value="1.0 tokens/sec" />
    </div>
  );
}

function SettingRow({ title, description, value }: { title: string; description: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 rounded-xl"
      style={{ border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.04)" }}
    >
      <div>
        <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>{title}</p>
        <p className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(196,168,240,0.5)" }}>{description}</p>
      </div>
      <p className="font-mono text-[12px] shrink-0 ml-6" style={{ color: "rgba(237,224,255,0.9)" }}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  STATS TAB — no icons
// ═══════════════════════════════════════════════════════════════════════════

function StatsTab() {
  const poolLengthQuery = useReadContract({
    address: YIELD_FARM_NFT, abi: YIELD_FARM_NFT_ABI, functionName: "poolLength",
    query: { refetchInterval: 10_000 },
  });
  const poolCount = Number(poolLengthQuery.data ?? 0);

  return (
    <div className="w-full">
      <p className="font-grotesk uppercase text-[16px] tracking-wider mb-5" style={{ color: "rgba(237,224,255,0.9)" }}>
        Platform Statistics
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pools"   value={poolCount.toString()} />
        <StatCard label="Total TVL"     value="$0" />
        <StatCard label="Total Rewards" value="0" />
        <StatCard label="Active Farms"  value="0" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.04)" }}>
      <p className="font-mono text-[9px] uppercase tracking-wider mb-3" style={{ color: "rgba(196,168,240,0.55)" }}>{label}</p>
      <p className="font-grotesk text-[24px] tabular-nums" style={{ color: "#EDE0FF" }}>{value}</p>
    </div>
  );
}
