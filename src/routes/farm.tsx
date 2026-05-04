import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Sprout, Plus, Users, X, ChevronDown, ChevronUp } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { YIELD_FARM_NFT_ABI, CONTRACTS, ERC20_ABI } from "@/lib/web3/contracts";
import { TokenPicker } from "@/components/TokenPicker";
import type { TokenInfo } from "@/lib/web3/tokens";

export const Route = createFileRoute("/farm")({
  component: FarmPage,
  head: () => ({
    meta: [
      { title: "Yield Farm — The Dog House" },
      { name: "description", content: "Create farms, add rewards, and stake tokens on Monad." },
    ],
  }),
});

const TABS = ["All Farms", "My Farms"] as const;
type Tab = typeof TABS[number];

function FarmPage() {
  const [activeTab, setActiveTab] = useState<Tab>("All Farms");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = CONTRACTS[chainId] ?? CONTRACTS[10143];

  const poolLengthQuery = useReadContract({
    address: contracts.yieldFarmNFT,
    abi: YIELD_FARM_NFT_ABI,
    functionName: "poolLength",
    query: { refetchInterval: 10_000 },
  });

  const poolCount = Number(poolLengthQuery.data ?? 0);

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>
              Yield Farms
            </h1>
            <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
              Permissionless farming · Create pools · Add rewards · Earn yield
            </p>
          </div>
          {/* Create Farm CTA */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-90 active:scale-[0.98] shrink-0"
            style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.55)" }}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Create Farm
          </button>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div
            className="flex items-center gap-0.5 p-1 rounded-full"
            style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}
          >
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap"
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
          {activeTab === "All Farms" && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-full"
              style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search farms…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent font-mono text-[11px] outline-none w-32 sm:w-44"
                style={{ color: "#EDE0FF" }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        {activeTab === "All Farms" && <AllFarmsTab poolCount={poolCount} search={search} onCreateFarm={() => setShowCreateModal(true)} />}
        {activeTab === "My Farms" && <MyFarmsTab />}

        {/* Create Farm Modal */}
        {showCreateModal && <CreateFarmModal onClose={() => setShowCreateModal(false)} />}
      </div>
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              ALL FARMS TAB
// ═══════════════════════════════════════════════════════════════════════════

function AllFarmsTab({ poolCount, search, onCreateFarm }: { poolCount: number; search: string; onCreateFarm: () => void }) {
  if (poolCount === 0) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.35)" }}
          >
            <Sprout className="w-4 h-4" style={{ color: "rgba(196,168,240,0.7)" }} strokeWidth={1.5} />
          </div>
          <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>
            No Farms Yet
          </p>
          <p className="font-mono text-[10px] mt-1.5 max-w-[280px]" style={{ color: "rgba(196,168,240,0.55)" }}>
            Be the first to create a farm! Anyone can create a pool.
          </p>
          <button
            onClick={onCreateFarm}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-90"
            style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Create First Farm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {Array.from({ length: poolCount }, (_, i) => (
        <FarmCard key={i} poolId={i} />
      ))}
    </div>
  );
}

function FarmCard({ poolId }: { poolId: number }) {
  const [showAddReward, setShowAddReward] = useState(false);
  const chainId = useChainId();
  const contracts = CONTRACTS[chainId] ?? CONTRACTS[10143];

  const poolInfoQuery = useReadContract({
    address: contracts.yieldFarmNFT,
    abi: YIELD_FARM_NFT_ABI,
    functionName: "getPoolInfo",
    args: [BigInt(poolId)],
    query: { refetchInterval: 10_000 },
  });

  const [stakeToken, totalStaked, active] = poolInfoQuery.data ?? [];

  // Get token info
  const tokenSymbolQuery = useReadContract({
    address: stakeToken,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: !!stakeToken, refetchInterval: 10_000 },
  });

  const tokenDecimalsQuery = useReadContract({
    address: stakeToken,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!stakeToken, refetchInterval: 10_000 },
  });

  const symbol = tokenSymbolQuery.data as string | undefined;
  const decimals = tokenDecimalsQuery.data as number | undefined;

  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-grotesk uppercase text-[16px] tracking-wider" style={{ color: "#EDE0FF" }}>
              {symbol || "Loading..."} Farm
            </p>
            <span
              className="px-2 py-0.5 rounded-full font-mono text-[8px] uppercase tracking-wider"
              style={{
                background: active ? "rgba(155,232,164,0.15)" : "rgba(255,120,120,0.15)",
                color: active ? "#9be8a4" : "rgba(255,120,120,0.9)",
                border: `1px solid ${active ? "rgba(155,232,164,0.3)" : "rgba(255,120,120,0.3)"}`,
              }}
            >
              {active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.55)" }}>
            Pool #{poolId} · Stake {symbol || "tokens"}
          </p>
        </div>

        <button
          onClick={() => setShowAddReward(!showAddReward)}
          className="flex items-center gap-2 px-3 py-2 rounded-full font-grotesk text-[10px] uppercase tracking-wider transition hover:opacity-90"
          style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Add Reward
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg p-3" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}>
          <p className="font-mono text-[8px] uppercase tracking-wider mb-1" style={{ color: "rgba(196,168,240,0.5)" }}>
            Total Staked
          </p>
          <p className="font-mono text-[13px]" style={{ color: "#EDE0FF" }}>
            {totalStaked && decimals ? formatUnits(totalStaked, decimals) : "0"}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}>
          <p className="font-mono text-[8px] uppercase tracking-wider mb-1" style={{ color: "rgba(196,168,240,0.5)" }}>
            APR
          </p>
          <p className="font-mono text-[13px]" style={{ color: "#9be8a4" }}>
            TBD
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}>
          <p className="font-mono text-[8px] uppercase tracking-wider mb-1" style={{ color: "rgba(196,168,240,0.5)" }}>
            Rewards
          </p>
          <p className="font-mono text-[13px]" style={{ color: "#EDE0FF" }}>
            0
          </p>
        </div>
      </div>

      {/* Add Reward Form */}
      {showAddReward && <AddRewardForm poolId={poolId} onClose={() => setShowAddReward(false)} />}
    </div>
  );
}

function AddRewardForm({ poolId, onClose }: { poolId: number; onClose: () => void }) {
  const [rewardToken, setRewardToken] = useState<(TokenInfo & { balance: bigint }) | undefined>();
  const [rewardPerSecond, setRewardPerSecond] = useState("");
  const [duration, setDuration] = useState("");
  const [totalSupply, setTotalSupply] = useState("");
  const { toast } = useToast();
  const chainId = useChainId();
  const contracts = CONTRACTS[chainId] ?? CONTRACTS[10143];

  const addRewardTx = useWriteContract();
  const addRewardRcpt = useWaitForTransactionReceipt({ hash: addRewardTx.data });

  const handleAddReward = () => {
    if (!rewardToken || !rewardPerSecond || !totalSupply) return;

    const durationSeconds = duration ? parseInt(duration) * 86400 : 0; // days to seconds

    addRewardTx.writeContract({
      address: contracts.yieldFarmNFT,
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
    onClose();
  }

  return (
    <div className="mt-4 pt-4 space-y-4" style={{ borderTop: "1px solid rgba(155,127,212,0.25)" }}>
      <p className="font-grotesk uppercase text-[12px] tracking-wider" style={{ color: "#EDE0FF" }}>
        Add Reward to Pool #{poolId}
      </p>

      <div>
        <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
          Reward Token
        </label>
        <TokenPicker selected={rewardToken} onSelect={setRewardToken} excludeNative />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
            Per Second
          </label>
          <input
            type="text"
            value={rewardPerSecond}
            onChange={(e) => setRewardPerSecond(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="1.0"
            className="w-full bg-transparent rounded-xl px-3 py-2 font-mono text-[12px] outline-none"
            style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
          />
        </div>

        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
            Duration (days)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
            className="w-full bg-transparent rounded-xl px-3 py-2 font-mono text-[12px] outline-none"
            style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
          />
        </div>
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
          className="w-full bg-transparent rounded-xl px-3 py-2 font-mono text-[12px] outline-none"
          style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAddReward}
          disabled={!rewardToken || !rewardPerSecond || !totalSupply || addRewardTx.isPending || addRewardRcpt.isLoading}
          className="flex-1 rounded-xl py-2.5 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
          style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
        >
          {addRewardTx.isPending || addRewardRcpt.isLoading ? "Adding..." : "Add Reward"}
        </button>
        <button
          onClick={onClose}
          className="px-4 rounded-xl py-2.5 font-grotesk text-[11px] uppercase tracking-wider transition"
          style={{ color: "rgba(196,168,240,0.6)", border: "1px solid rgba(155,127,212,0.3)" }}
        >
          Cancel
        </button>
      </div>

      {addRewardTx.error && (
        <p className="font-mono text-[9px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
          {addRewardTx.error.message}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              MY FARMS TAB
// ═══════════════════════════════════════════════════════════════════════════

function MyFarmsTab() {
  const { address } = useAccount();

  if (!address) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>
            Connect Wallet
          </p>
          <p className="font-mono text-[10px] mt-1.5" style={{ color: "rgba(196,168,240,0.55)" }}>
            Connect your wallet to see your farms
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.35)" }}
        >
          <Users className="w-4 h-4" style={{ color: "rgba(196,168,240,0.7)" }} strokeWidth={1.5} />
        </div>
        <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>
          No Active Positions
        </p>
        <p className="font-mono text-[10px] mt-1.5" style={{ color: "rgba(196,168,240,0.55)" }}>
          Stake in a farm to see your positions here
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                         CREATE FARM MODAL
// ═══════════════════════════════════════════════════════════════════════════

function CreateFarmModal({ onClose }: { onClose: () => void }) {
  const [stakeToken, setStakeToken] = useState<(TokenInfo & { balance: bigint }) | undefined>();
  const [rewards, setRewards] = useState<RewardEntry[]>([{ id: 0, token: undefined, perSecond: "", duration: "", totalSupply: "" }]);
  const { toast } = useToast();
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = CONTRACTS[chainId] ?? CONTRACTS[10143];

  const createTx  = useWriteContract();
  const createRcpt = useWaitForTransactionReceipt({ hash: createTx.data });

  const handleCreate = () => {
    if (!stakeToken) return;
    createTx.writeContract({
      address: contracts.yieldFarmNFT,
      abi: YIELD_FARM_NFT_ABI,
      functionName: "createPool",
      args: [stakeToken.address],
    });
  };

  if (createRcpt.isSuccess) {
    toast("success", "Farm created!", "Your farm pool is live. Add rewards to start attracting stakers.");
    onClose();
  }

  const addReward = () =>
    setRewards((r) => [...r, { id: Date.now(), token: undefined, perSecond: "", duration: "", totalSupply: "" }]);
  const removeReward = (id: number) =>
    setRewards((r) => r.filter((x) => x.id !== id));
  const updateReward = (id: number, patch: Partial<RewardEntry>) =>
    setRewards((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(6,4,15,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: "#0D0B18", border: "1px solid rgba(155,127,212,0.35)" }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(155,127,212,0.2)" }}>
          <div>
            <p className="font-grotesk uppercase text-[15px] tracking-wider" style={{ color: "#EDE0FF" }}>Create Farm</p>
            <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(196,168,240,0.5)" }}>
              Deploy a permissionless yield farm pool
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[rgba(155,127,212,0.15)]"
            style={{ color: "rgba(196,168,240,0.6)" }}
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Modal body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Stake token */}
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
              Stake Token <span style={{ color: "rgba(255,100,100,0.8)" }}>*</span>
            </label>
            <TokenPicker selected={stakeToken} onSelect={setStakeToken} excludeNative />
            <p className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(196,168,240,0.4)" }}>
              Users will stake this token to earn rewards
            </p>
          </div>

          {/* Rewards section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.55)" }}>
                Reward Tokens (optional — add after creation)
              </label>
              <button
                onClick={addReward}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80"
                style={{ background: "rgba(155,127,212,0.15)", color: "rgba(196,168,240,0.8)", border: "1px solid rgba(155,127,212,0.3)" }}
              >
                <Plus className="w-3 h-3" strokeWidth={2} />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {rewards.map((r, idx) => (
                <RewardRow
                  key={r.id}
                  entry={r}
                  index={idx}
                  onUpdate={(patch) => updateReward(r.id, patch)}
                  onRemove={rewards.length > 1 ? () => removeReward(r.id) : undefined}
                />
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(155,127,212,0.07)", border: "1px solid rgba(155,127,212,0.2)" }}>
            {[
              ["Status after creation", "Unverified (admin can verify)"],
              ["Rewards", "Add reward tokens after pool is created"],
              ["Staking", "Users can stake immediately after creation"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4">
                <span className="font-mono text-[9px] uppercase tracking-wider shrink-0" style={{ color: "rgba(196,168,240,0.45)" }}>{k}</span>
                <span className="font-mono text-[10px] text-right" style={{ color: "rgba(237,224,255,0.75)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 space-y-3" style={{ borderTop: "1px solid rgba(155,127,212,0.2)" }}>
          <button
            onClick={handleCreate}
            disabled={!stakeToken || createTx.isPending || createRcpt.isLoading}
            className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40 active:scale-[0.99] flex items-center justify-center gap-2"
            style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.55)" }}
          >
            {createTx.isPending || createRcpt.isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
                Creating…
              </>
            ) : (
              <>
                <Sprout className="w-4 h-4" strokeWidth={1.5} />
                Create Farm Pool
              </>
            )}
          </button>
          {createTx.error && (
            <p className="font-mono text-[9px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
              {(createTx.error as any)?.shortMessage ?? createTx.error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type RewardEntry = {
  id: number;
  token: (TokenInfo & { balance: bigint }) | undefined;
  perSecond: string;
  duration: string;
  totalSupply: string;
};

function RewardRow({
  entry, index, onUpdate, onRemove,
}: {
  entry: RewardEntry;
  index: number;
  onUpdate: (patch: Partial<RewardEntry>) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.22)", background: "rgba(155,127,212,0.04)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 transition hover:bg-[rgba(155,127,212,0.06)]"
      >
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.7)" }}>
          Reward #{index + 1}{entry.token ? ` — ${entry.token.symbol}` : ""}
        </span>
        <div className="flex items-center gap-2">
          {onRemove && (
            <span
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[rgba(255,100,100,0.15)] transition"
              style={{ color: "rgba(255,100,100,0.6)" }}
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "rgba(196,168,240,0.5)" }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(196,168,240,0.5)" }} />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.5)" }}>Reward Token</label>
            <TokenPicker selected={entry.token} onSelect={(t) => onUpdate({ token: t })} excludeNative />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Per Second", key: "perSecond", placeholder: "1.0" },
              { label: "Duration (days)", key: "duration", placeholder: "30" },
              { label: "Total Supply", key: "totalSupply", placeholder: "10000" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="font-mono text-[8px] uppercase tracking-wider mb-1 block" style={{ color: "rgba(196,168,240,0.45)" }}>{label}</label>
                <input
                  type="text"
                  value={(entry as any)[key]}
                  onChange={(e) => onUpdate({ [key]: e.target.value.replace(/[^0-9.]/g, "") })}
                  placeholder={placeholder}
                  className="w-full bg-transparent rounded-lg px-2.5 py-1.5 font-mono text-[11px] outline-none"
                  style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.25)", background: "rgba(155,127,212,0.06)" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Remove old CreateFarmTab (replaced by modal above)
