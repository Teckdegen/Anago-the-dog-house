"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import { parseUnits, formatUnits } from "viem";
import { STREAM_FARM_ADDRESS, STREAM_FARM_ABI, ERC20_ABI } from "@/lib/contracts";

export default function AdminPage() {
  const { address, isConnected } = useAccount();

  const isAdminQ = useReadContract({
    address: STREAM_FARM_ADDRESS,
    abi: STREAM_FARM_ABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isAdmin = isAdminQ.data as boolean | undefined;

  return (
    <div className="max-w-[900px] mx-auto px-5 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-grotesk text-[24px] font-semibold tracking-tight">Stream Farm Admin</h1>
          <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.55)" }}>
            Manage farms · Add rewards · Control admins
          </p>
        </div>
        <ConnectButton />
      </div>

      {/* Content */}
      {!isConnected ? (
        <div className="text-center py-20">
          <p className="text-[16px] font-grotesk mb-2">Connect Wallet</p>
          <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.55)" }}>
            Connect an admin wallet to access the dashboard.
          </p>
        </div>
      ) : isAdminQ.isLoading ? (
        <div className="text-center py-20">
          <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: "rgba(155,127,212,0.2)", borderTopColor: "rgba(155,127,212,0.8)" }} />
          <p className="font-mono text-[11px] mt-4" style={{ color: "rgba(196,168,240,0.55)" }}>Checking admin status...</p>
        </div>
      ) : !isAdmin ? (
        <div className="text-center py-20">
          <p className="text-[18px] font-grotesk mb-2" style={{ color: "rgba(255,100,100,0.9)" }}>Access Denied</p>
          <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.55)" }}>
            Wallet {address?.slice(0, 6)}...{address?.slice(-4)} is not an admin.
          </p>
          <p className="font-mono text-[10px] mt-2" style={{ color: "rgba(196,168,240,0.4)" }}>
            Only authorized admin wallets can access this dashboard.
          </p>
        </div>
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

function Dashboard() {
  const { address } = useAccount();
  const [activeSection, setActiveSection] = useState<string>("farms");

  const farmCountQ = useReadContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "farmCount", query: { refetchInterval: 10_000 } });
  const ownerQ = useReadContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "owner" });
  const farmCount = Number(farmCountQ.data ?? 0);
  const owner = ownerQ.data as string | undefined;
  const isOwner = !!address && owner?.toLowerCase() === address.toLowerCase();

  const sections = [
    { key: "farms", label: "Farms" },
    { key: "create", label: "Create Farm" },
    { key: "rewards", label: "Add Rewards" },
    { key: "boosts", label: "Boost Tiers" },
    { key: "recover", label: "Recover" },
    ...(isOwner ? [{ key: "admins", label: "Admins" }] : []),
  ];

  return (
    <div>
      {/* Stats */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(155,127,212,0.05)", border: "1px solid rgba(155,127,212,0.35)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>Overview</p>
            <p className="font-grotesk text-[18px] mt-1">{farmCount} Farm{farmCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[9px]" style={{ color: "rgba(196,168,240,0.4)" }}>Owner</p>
            <p className="font-mono text-[11px]">{owner?.slice(0, 6)}...{owner?.slice(-4)} {isOwner && "(you)"}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-1 p-1 rounded-full mb-6" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
        {sections.map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className="px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition"
            style={activeSection === s.key ? { background: "rgba(155,127,212,0.35)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" } : { color: "rgba(196,168,240,0.5)" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Sections */}
      {activeSection === "farms" && <FarmsSection farmCount={farmCount} />}
      {activeSection === "create" && <CreateFarmSection />}
      {activeSection === "rewards" && <AddRewardSection farmCount={farmCount} />}
      {activeSection === "boosts" && <BoostTiersSection />}
      {activeSection === "recover" && <RecoverSection />}
      {activeSection === "admins" && isOwner && <AdminsSection />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function FarmsSection({ farmCount }: { farmCount: number }) {
  if (farmCount === 0) return <Card><p className="text-center py-8 font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.5)" }}>No farms yet</p></Card>;
  return (
    <div className="space-y-3">
      {Array.from({ length: farmCount }, (_, i) => <FarmRow key={i} farmId={i} />)}
    </div>
  );
}

function FarmRow({ farmId }: { farmId: number }) {
  const farmQ = useReadContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "getFarm", args: [BigInt(farmId)], query: { refetchInterval: 10_000 } });
  const data = farmQ.data as any;
  const toggleTx = useWriteContract();
  const toggleRcpt = useWaitForTransactionReceipt({ hash: toggleTx.data });

  if (!data) return <Card><div className="h-12 animate-pulse" /></Card>;
  const [stakeToken, , totalStaked, active, lockDuration, earlyWithdrawBps, rewardStreamCount] = data;

  const symbolQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!stakeToken } });
  const decimalsQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!stakeToken } });
  const symbol = (symbolQ.data as string) || "...";
  const decimals = (decimalsQ.data as number) ?? 18;

  const handleToggle = () => {
    toggleTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "setFarmActive", args: [BigInt(farmId), !active] });
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-grotesk text-[14px] font-semibold">#{farmId} · {symbol}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider ${active ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
              {active ? "Live" : "Paused"}
            </span>
          </div>
          <p className="font-mono text-[9px] mt-1" style={{ color: "rgba(196,168,240,0.45)" }}>
            TVL: {Number(formatUnits(totalStaked ?? 0n, decimals)).toLocaleString()} {symbol} · {Number(rewardStreamCount)} streams · Lock: {Number(lockDuration) / 86400}d · Penalty: {Number(earlyWithdrawBps) / 100}%
          </p>
        </div>
        <button onClick={handleToggle} disabled={toggleTx.isPending || toggleRcpt.isLoading} className="btn text-[10px]">
          {toggleTx.isPending ? "..." : active ? "Pause" : "Activate"}
        </button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function CreateFarmSection() {
  const [stakeToken, setStakeToken] = useState("");
  const [lockDays, setLockDays] = useState("");
  const [penalty, setPenalty] = useState("");
  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });

  const handleCreate = () => {
    if (!stakeToken) return;
    tx.writeContract({
      address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "createFarm",
      args: [stakeToken as `0x${string}`, BigInt((parseInt(lockDays) || 0) * 86400), BigInt(Math.round((parseFloat(penalty) || 0) * 100))],
    });
  };

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Create Farm</h3>
      <div className="space-y-4">
        <Field label="Stake Token Address" value={stakeToken} onChange={setStakeToken} placeholder="0x..." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Lock Duration (days)" value={lockDays} onChange={setLockDays} placeholder="0" />
          <Field label="Early Exit Penalty (%)" value={penalty} onChange={setPenalty} placeholder="0" />
        </div>
        <button onClick={handleCreate} disabled={!stakeToken || tx.isPending || rcpt.isLoading} className="btn w-full">
          {tx.isPending || rcpt.isLoading ? "Creating..." : "Create Farm"}
        </button>
        {rcpt.isSuccess && <p className="font-mono text-[10px] text-green-400">Farm created!</p>}
        {tx.error && <p className="font-mono text-[10px] text-red-400">{(tx.error as any)?.shortMessage || tx.error.message}</p>}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function AddRewardSection({ farmCount }: { farmCount: number }) {
  const { address } = useAccount();
  const [farmId, setFarmId] = useState("");
  const [rewardToken, setRewardToken] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("30");
  const [delay, setDelay] = useState("0");

  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const addTx = useWriteContract();
  const addRcpt = useWaitForTransactionReceipt({ hash: addTx.data });

  const decimalsQ = useReadContract({ address: rewardToken as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!rewardToken && rewardToken.length === 42 } });
  const allowanceQ = useReadContract({ address: rewardToken as `0x${string}`, abi: ERC20_ABI, functionName: "allowance", args: address ? [address, STREAM_FARM_ADDRESS] : undefined, query: { enabled: !!address && !!rewardToken && rewardToken.length === 42, refetchInterval: 5_000 } });

  const decimals = (decimalsQ.data as number) ?? 18;
  const parsedBudget = (() => { try { return budget ? parseUnits(budget, decimals) : 0n; } catch { return 0n; } })();
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = parsedBudget > 0n && allowance < parsedBudget;

  const handleApprove = () => {
    approveTx.writeContract({ address: rewardToken as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [STREAM_FARM_ADDRESS, parsedBudget] });
  };

  const handleAdd = () => {
    const now = Math.floor(Date.now() / 1000);
    const start = BigInt(now + (parseInt(delay) || 0) * 3600);
    const end = start + BigInt((parseInt(days) || 30) * 86400);
    addTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "addRewardStream", args: [BigInt(farmId), rewardToken as `0x${string}`, parsedBudget, start, end] });
  };

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Add Reward Stream</h3>
      <div className="space-y-4">
        <Field label="Farm ID" value={farmId} onChange={setFarmId} placeholder="0" />
        <Field label="Reward Token Address" value={rewardToken} onChange={setRewardToken} placeholder="0x..." />
        <Field label="Total Budget (token units)" value={budget} onChange={setBudget} placeholder="10000" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duration (days)" value={days} onChange={setDays} placeholder="30" />
          <Field label="Start Delay (hours)" value={delay} onChange={setDelay} placeholder="0" />
        </div>
        {needsApproval ? (
          <button onClick={handleApprove} disabled={approveTx.isPending || approveRcpt.isLoading} className="btn w-full">
            {approveTx.isPending || approveRcpt.isLoading ? "Approving..." : "Approve Tokens"}
          </button>
        ) : (
          <button onClick={handleAdd} disabled={!farmId || !rewardToken || !parsedBudget || addTx.isPending || addRcpt.isLoading} className="btn w-full">
            {addTx.isPending || addRcpt.isLoading ? "Adding..." : "Add Reward Stream"}
          </button>
        )}
        {addRcpt.isSuccess && <p className="font-mono text-[10px] text-green-400">Reward stream added!</p>}
        {(addTx.error || approveTx.error) && <p className="font-mono text-[10px] text-red-400">{((addTx.error || approveTx.error) as any)?.shortMessage || (addTx.error || approveTx.error)?.message}</p>}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function BoostTiersSection() {
  const [durations, setDurations] = useState("7,30,90");
  const [multipliers, setMultipliers] = useState("1.2,1.5,2.0");
  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });

  const handleUpdate = () => {
    const dArr = durations.split(",").map((d) => BigInt(parseInt(d.trim()) * 86400));
    const mArr = multipliers.split(",").map((m) => parseUnits(m.trim(), 18));
    tx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "setBoostTiers", args: [dArr, mArr] });
  };

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Boost Tiers</h3>
      <div className="space-y-4">
        <Field label="Durations (days, comma separated)" value={durations} onChange={setDurations} placeholder="7,30,90" />
        <Field label="Multipliers (x, comma separated)" value={multipliers} onChange={setMultipliers} placeholder="1.2,1.5,2.0" />
        <button onClick={handleUpdate} disabled={tx.isPending || rcpt.isLoading} className="btn w-full">
          {tx.isPending || rcpt.isLoading ? "Updating..." : "Update Boost Tiers"}
        </button>
        {rcpt.isSuccess && <p className="font-mono text-[10px] text-green-400">Boost tiers updated!</p>}
        {tx.error && <p className="font-mono text-[10px] text-red-400">{(tx.error as any)?.shortMessage || tx.error.message}</p>}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function RecoverSection() {
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });

  const decimalsQ = useReadContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!token && token.length === 42 } });
  const decimals = (decimalsQ.data as number) ?? 18;

  const handleRecover = () => {
    const parsed = parseUnits(amount, decimals);
    tx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "recoverTokens", args: [token as `0x${string}`, parsed] });
  };

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Recover Tokens</h3>
      <div className="space-y-4">
        <Field label="Token Address" value={token} onChange={setToken} placeholder="0x..." />
        <Field label="Amount (token units)" value={amount} onChange={setAmount} placeholder="1000" />
        <button onClick={handleRecover} disabled={!token || !amount || tx.isPending || rcpt.isLoading} className="btn w-full">
          {tx.isPending || rcpt.isLoading ? "Recovering..." : "Recover Tokens"}
        </button>
        {rcpt.isSuccess && <p className="font-mono text-[10px] text-green-400">Tokens recovered!</p>}
        {tx.error && <p className="font-mono text-[10px] text-red-400">{(tx.error as any)?.shortMessage || tx.error.message}</p>}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function AdminsSection() {
  const [adminAddr, setAdminAddr] = useState("");
  const addTx = useWriteContract();
  const addRcpt = useWaitForTransactionReceipt({ hash: addTx.data });
  const removeTx = useWriteContract();
  const removeRcpt = useWaitForTransactionReceipt({ hash: removeTx.data });

  const handleAdd = () => {
    if (!adminAddr) return;
    addTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "addAdmin", args: [adminAddr as `0x${string}`] });
  };

  const handleRemove = () => {
    if (!adminAddr) return;
    removeTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "removeAdmin", args: [adminAddr as `0x${string}`] });
  };

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Admin Management</h3>
      <p className="font-mono text-[9px] mb-4" style={{ color: "rgba(196,168,240,0.4)" }}>Only the contract owner can add/remove admins</p>
      <div className="space-y-4">
        <Field label="Wallet Address" value={adminAddr} onChange={setAdminAddr} placeholder="0x..." />
        <div className="flex gap-3">
          <button onClick={handleAdd} disabled={!adminAddr || addTx.isPending || addRcpt.isLoading} className="btn flex-1">
            {addTx.isPending || addRcpt.isLoading ? "Adding..." : "Add Admin"}
          </button>
          <button onClick={handleRemove} disabled={!adminAddr || removeTx.isPending || removeRcpt.isLoading} className="btn flex-1" style={{ background: "rgba(255,100,100,0.15)", borderColor: "rgba(255,100,100,0.4)", color: "rgba(255,100,100,0.9)" }}>
            {removeTx.isPending || removeRcpt.isLoading ? "Removing..." : "Remove Admin"}
          </button>
        </div>
        {addRcpt.isSuccess && <p className="font-mono text-[10px] text-green-400">Admin added!</p>}
        {removeRcpt.isSuccess && <p className="font-mono text-[10px] text-green-400">Admin removed!</p>}
        {(addTx.error || removeTx.error) && <p className="font-mono text-[10px] text-red-400">{((addTx.error || removeTx.error) as any)?.shortMessage || (addTx.error || removeTx.error)?.message}</p>}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(155,127,212,0.05)", border: "1px solid rgba(155,127,212,0.35)" }}>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
        style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
    </div>
  );
}
