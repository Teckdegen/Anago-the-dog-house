import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { Shield, Plus, Settings, TrendingUp, Users, DollarSign } from "lucide-react";
import { useToast } from "@/components/Toast";
import { YIELD_FARM_NFT_ABI, ERC20_ABI } from "@/lib/web3/contracts";
import { TokenPicker } from "@/components/TokenPicker";
import type { TokenInfo } from "@/lib/web3/tokens";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — The Dog House" },
    ],
  }),
});

// ADMIN WALLET - ONLY THIS ADDRESS CAN ACCESS
const ADMIN_ADDRESS = "0x0F5ddCFA6b2BbD7E24f8B98a3634273A4B5a834C" as `0x${string}`;

// YieldFarmNFT Contract Address
const YIELD_FARM_NFT = "0x330b72ea1A45b392BfccE383d1876F5e3d7bb74d" as `0x${string}`;

const TABS = ["Pools", "Rewards", "Settings", "Stats"] as const;
type Tab = (typeof TABS)[number];

function AdminPage() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("Pools");

  // Check if user is admin
  const isAdmin = address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  // Redirect non-admin users
  if (isConnected && !isAdmin) {
    return <Navigate to="/" />;
  }

  // Show nothing if not connected
  if (!isConnected) {
    return <Navigate to="/" />;
  }

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(155,127,212,0.2)", border: "1px solid rgba(155,127,212,0.5)" }}
          >
            <Shield className="w-6 h-6" style={{ color: "#C4A8F0" }} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>
              Admin Dashboard
            </h1>
            <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
              Manage farms, pools, and platform settings
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 p-1 rounded-full mb-6" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="flex-1 px-4 py-2 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap"
              style={
                activeTab === t
                  ? { background: "rgba(155,127,212,0.35)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" }
                  : { color: "rgba(196,168,240,0.5)" }
              }
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "Pools" && <PoolsTab />}
        {activeTab === "Rewards" && <RewardsTab />}
        {activeTab === "Settings" && <SettingsTab />}
        {activeTab === "Stats" && <StatsTab />}
      </div>
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              POOLS TAB
// ═══════════════════════════════════════════════════════════════════════════

function PoolsTab() {
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  // Get pool count
  const poolLengthQuery = useReadContract({
    address: YIELD_FARM_NFT,
    abi: YIELD_FARM_NFT_ABI,
    functionName: "poolLength",
    query: { refetchInterval: 10_000 },
  });

  const poolCount = Number(poolLengthQuery.data ?? 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-grotesk uppercase text-[16px] tracking-wider" style={{ color: "rgba(237,224,255,0.9)" }}>
          Farm Pools ({poolCount})
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-90"
          style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" }}
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          Create Pool
        </button>
      </div>

      {showCreate ? (
        <CreatePoolForm onClose={() => setShowCreate(false)} />
      ) : (
        <PoolsList poolCount={poolCount} />
      )}
    </div>
  );
}

function CreatePoolForm({ onClose }: { onClose: () => void }) {
  const [stakeToken, setStakeToken] = useState<(TokenInfo & { balance: bigint }) | undefined>();
  const { toast } = useToast();

  const createTx = useWriteContract();
  const createRcpt = useWaitForTransactionReceipt({ hash: createTx.data });

  const handleCreate = () => {
    if (!stakeToken) return;

    createTx.writeContract({
      address: YIELD_FARM_NFT,
      abi: YIELD_FARM_NFT_ABI,
      functionName: "createPool",
      args: [stakeToken.address],
    });
  };

  if (createRcpt.isSuccess) {
    toast("success", "Pool created", "New farm pool created successfully!");
    onClose();
  }

  return (
    <div className="rounded-xl p-6" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#EDE0FF" }}>
          Create New Pool
        </h3>
        <button
          onClick={onClose}
          className="font-mono text-[10px] uppercase tracking-wider transition hover:opacity-80"
          style={{ color: "rgba(196,168,240,0.6)" }}
        >
          Cancel
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
            Stake Token
          </label>
          <TokenPicker selected={stakeToken} onSelect={setStakeToken} excludeNative />
        </div>

        <button
          onClick={handleCreate}
          disabled={!stakeToken || createTx.isPending || createRcpt.isLoading}
          className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40"
          style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
        >
          {createTx.isPending || createRcpt.isLoading ? "Creating..." : "Create Pool"}
        </button>

        {createTx.error && (
          <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
            {createTx.error.message}
          </p>
        )}
      </div>
    </div>
  );
}

function PoolsList({ poolCount }: { poolCount: number }) {
  if (poolCount === 0) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>
          No Pools Yet
        </p>
        <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.55)" }}>
          Create your first farm pool to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {Array.from({ length: poolCount }, (_, i) => (
        <PoolCard key={i} poolId={i} />
      ))}
    </div>
  );
}

function PoolCard({ poolId }: { poolId: number }) {
  const poolInfoQuery = useReadContract({
    address: YIELD_FARM_NFT,
    abi: YIELD_FARM_NFT_ABI,
    functionName: "getPoolInfo",
    args: [BigInt(poolId)],
    query: { refetchInterval: 10_000 },
  });

  const [stakeToken, totalStaked, active] = poolInfoQuery.data ?? [];

  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-grotesk uppercase text-[14px] tracking-wider" style={{ color: "#EDE0FF" }}>
            Pool #{poolId}
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.55)" }}>
            {stakeToken ? `${stakeToken.slice(0, 6)}...${stakeToken.slice(-4)}` : "Loading..."}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px]" style={{ color: "rgba(237,224,255,0.9)" }}>
            {totalStaked ? totalStaked.toString() : "0"} staked
          </p>
          <p className="font-mono text-[9px] mt-1" style={{ color: active ? "#9be8a4" : "rgba(255,120,120,0.9)" }}>
            {active ? "Active" : "Inactive"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              REWARDS TAB
// ═══════════════════════════════════════════════════════════════════════════

function RewardsTab() {
  const [poolId, setPoolId] = useState("");
  const [rewardToken, setRewardToken] = useState<(TokenInfo & { balance: bigint }) | undefined>();
  const [rewardPerSecond, setRewardPerSecond] = useState("");
  const [duration, setDuration] = useState("");
  const [totalSupply, setTotalSupply] = useState("");

  const { toast } = useToast();
  const addRewardTx = useWriteContract();
  const addRewardRcpt = useWaitForTransactionReceipt({ hash: addRewardTx.data });

  const handleAddReward = () => {
    if (!rewardToken || !poolId || !rewardPerSecond || !totalSupply) return;

    const durationSeconds = duration ? parseInt(duration) * 86400 : 0; // days to seconds

    addRewardTx.writeContract({
      address: YIELD_FARM_NFT,
      abi: YIELD_FARM_NFT_ABI,
      functionName: "addReward",
      args: [
        BigInt(poolId),
        rewardToken.address,
        parseUnits(rewardPerSecond, rewardToken.decimals),
        BigInt(durationSeconds),
        parseUnits(totalSupply, rewardToken.decimals),
      ],
    });
  };

  if (addRewardRcpt.isSuccess) {
    toast("success", "Reward added", "Reward token added to pool successfully!");
    setPoolId("");
    setRewardToken(undefined);
    setRewardPerSecond("");
    setDuration("");
    setTotalSupply("");
    addRewardTx.reset();
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-grotesk uppercase text-[16px] tracking-wider mb-5" style={{ color: "rgba(237,224,255,0.9)" }}>
        Add Reward to Pool
      </h2>

      <div className="rounded-xl p-6 space-y-5" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
            Pool ID
          </label>
          <input
            type="number"
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[13px] outline-none"
            style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
          />
        </div>

        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
            Reward Token
          </label>
          <TokenPicker selected={rewardToken} onSelect={setRewardToken} excludeNative />
        </div>

        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
            Reward Per Second
          </label>
          <input
            type="text"
            value={rewardPerSecond}
            onChange={(e) => setRewardPerSecond(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="1.0"
            className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[13px] outline-none"
            style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
          />
        </div>

        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
            Duration (days, 0 = infinite)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
            className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[13px] outline-none"
            style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
          />
        </div>

        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
            Total Supply
          </label>
          <input
            type="text"
            value={totalSupply}
            onChange={(e) => setTotalSupply(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="10000"
            className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[13px] outline-none"
            style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
          />
        </div>

        <button
          onClick={handleAddReward}
          disabled={!rewardToken || !poolId || !rewardPerSecond || !totalSupply || addRewardTx.isPending || addRewardRcpt.isLoading}
          className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40"
          style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
        >
          {addRewardTx.isPending || addRewardRcpt.isLoading ? "Adding..." : "Add Reward"}
        </button>

        {addRewardTx.error && (
          <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
            {addRewardTx.error.message}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════

function SettingsTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="font-grotesk uppercase text-[16px] tracking-wider" style={{ color: "rgba(237,224,255,0.9)" }}>
        Platform Settings
      </h2>

      <SettingCard
        icon={<DollarSign className="w-5 h-5" />}
        title="Pool Creation Fee"
        description="Fee required to create a new pool"
        value="100 tokens"
      />

      <SettingCard
        icon={<TrendingUp className="w-5 h-5" />}
        title="Platform Fee"
        description="Fee taken on withdrawals"
        value="1%"
      />

      <SettingCard
        icon={<Settings className="w-5 h-5" />}
        title="Emission Rate"
        description="Base emission rate per second"
        value="1.0 tokens/sec"
      />
    </div>
  );
}

function SettingCard({ icon, title, description, value }: { icon: React.ReactNode; title: string; description: string; value: string }) {
  return (
    <div className="rounded-xl p-5 flex items-center gap-4" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.35)", color: "rgba(196,168,240,0.85)" }}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>
          {title}
        </p>
        <p className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(196,168,240,0.55)" }}>
          {description}
        </p>
      </div>
      <p className="font-mono text-[12px] shrink-0" style={{ color: "rgba(237,224,255,0.9)" }}>
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              STATS TAB
// ═══════════════════════════════════════════════════════════════════════════

function StatsTab() {
  const poolLengthQuery = useReadContract({
    address: YIELD_FARM_NFT,
    abi: YIELD_FARM_NFT_ABI,
    functionName: "poolLength",
    query: { refetchInterval: 10_000 },
  });

  const poolCount = Number(poolLengthQuery.data ?? 0);

  return (
    <div>
      <h2 className="font-grotesk uppercase text-[16px] tracking-wider mb-5" style={{ color: "rgba(237,224,255,0.9)" }}>
        Platform Statistics
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pools" value={poolCount.toString()} />
        <StatCard label="Total TVL" value="$0" />
        <StatCard label="Total Rewards" value="0" />
        <StatCard label="Active Farms" value="0" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
      <p className="font-mono text-[9px] uppercase tracking-wider mb-3" style={{ color: "rgba(196,168,240,0.55)" }}>
        {label}
      </p>
      <p className="font-grotesk text-[24px] tabular-nums" style={{ color: "#EDE0FF" }}>
        {value}
      </p>
    </div>
  );
}
