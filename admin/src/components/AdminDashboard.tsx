"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState, useEffect } from "react";
import { parseUnits, formatUnits } from "viem";
import { STREAM_FARM_ADDRESS, STREAM_FARM_ABI, ERC20_ABI } from "@/lib/contracts";

export default function AdminDashboard() {
  const { address, isConnected } = useAccount();

  const isAdminQ = useReadContract({
    address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "isAdmin",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const isAdmin = isAdminQ.data as boolean | undefined;

  return (
    <div className="min-h-screen" style={{ background: "#06040F" }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-5" style={{ borderBottom: "1px solid rgba(155,127,212,0.12)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(155,127,212,0.2)" }}>
            <span style={{ color: "#C4A8F0", fontSize: 14 }}>⚡</span>
          </div>
          <span className="font-grotesk text-[14px] font-semibold" style={{ color: "#EDE0FF" }}>Stream Farm Admin</span>
        </div>
        <ConnectButton />
      </header>

      <div className="max-w-[1100px] mx-auto px-8 py-8">
        {!isConnected ? (
          <EmptyState title="Connect Wallet" sub="Connect an admin wallet to access the dashboard." />
        ) : isAdminQ.isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(155,127,212,0.2)", borderTopColor: "#9B7FD4" }} />
          </div>
        ) : !isAdmin ? (
          <EmptyState title="Access Denied" sub={`${address?.slice(0, 6)}...${address?.slice(-4)} is not an admin.`} />
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <p className="text-[20px] font-grotesk font-medium" style={{ color: "#EDE0FF" }}>{title}</p>
      <p className="font-mono text-[12px] mt-2" style={{ color: "rgba(196,168,240,0.5)" }}>{sub}</p>
    </div>
  );
}

function Dashboard() {
  const { address } = useAccount();
  const [section, setSection] = useState("overview");

  const farmCountQ = useReadContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "farmCount", query: { refetchInterval: 10_000 } });
  const ownerQ = useReadContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "owner" });
  const farmCount = Number(farmCountQ.data ?? 0);
  const owner = ownerQ.data as string | undefined;
  const isOwner = !!address && owner?.toLowerCase() === address.toLowerCase();

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "create", label: "Create Farm" },
    { key: "rewards", label: "Add Rewards" },
    { key: "boosts", label: "Boost Tiers" },
    { key: "recover", label: "Recover" },
    ...(isOwner ? [{ key: "admins", label: "Admins" }] : []),
  ];

  return (
    <div>
      {/* Stats row — Morpho style */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: "rgba(155,127,212,0.04)", border: "1px solid rgba(155,127,212,0.15)" }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>Total Farms</p>
            <p className="font-grotesk text-[32px] font-semibold mt-1" style={{ color: "#EDE0FF" }}>{farmCount}</p>
            <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.4)" }}>Active pools</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>Contract</p>
            <p className="font-mono text-[13px] mt-2" style={{ color: "#C4A8F0" }}>{STREAM_FARM_ADDRESS.slice(0, 18)}...</p>
            <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.4)" }}>StreamFarm</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>Owner</p>
            <p className="font-mono text-[13px] mt-2" style={{ color: "#EDE0FF" }}>{owner?.slice(0, 12)}...{owner?.slice(-6)}</p>
            <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.4)" }}>{isOwner ? "You" : "Not you"}</p>
          </div>
        </div>
      </div>

      {/* Tabs — pill style */}
      <div className="flex items-center gap-1 p-1 rounded-full mb-6 inline-flex" style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.15)" }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setSection(t.key)}
            className="px-4 py-2 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition"
            style={section === t.key ? { background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" } : { color: "rgba(196,168,240,0.45)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {section === "overview" && <OverviewSection farmCount={farmCount} />}
      {section === "create" && <CreateFarmSection />}
      {section === "rewards" && <AddRewardSection farmCount={farmCount} />}
      {section === "boosts" && <BoostTiersSection />}
      {section === "recover" && <RecoverSection />}
      {section === "admins" && isOwner && <AdminsSection />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function OverviewSection({ farmCount }: { farmCount: number }) {
  if (farmCount === 0) return <Card><p className="text-center py-12 font-mono text-[12px]" style={{ color: "rgba(196,168,240,0.4)" }}>No farms created yet. Go to "Create Farm" to get started.</p></Card>;
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

  const stakeToken = (data?.[0] ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const hasToken = !!data?.[0];
  const symbolQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "symbol", query: { enabled: hasToken } });
  const decimalsQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "decimals", query: { enabled: hasToken } });

  if (!data) return <Card><div className="h-16 animate-pulse rounded-lg" style={{ background: "rgba(155,127,212,0.06)" }} /></Card>;
  const [, , totalStaked, active, lockDuration, earlyWithdrawBps, rewardStreamCount] = data;
  const symbol = (symbolQ.data as string) || "...";
  const decimals = (decimalsQ.data as number) ?? 18;

  return (
    <div className="rounded-xl p-5 flex items-center justify-between" style={{ background: "rgba(155,127,212,0.03)", border: "1px solid rgba(155,127,212,0.12)" }}>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-grotesk text-[13px]" style={{ background: "rgba(155,127,212,0.12)", color: "#C4A8F0" }}>
          {symbol[0]}
        </div>
        <div>
          <p className="font-grotesk text-[14px] font-medium" style={{ color: "#EDE0FF" }}>{symbol} Farm <span className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.4)" }}>#{farmId}</span></p>
          <p className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(196,168,240,0.4)" }}>
            TVL: {Number(formatUnits(totalStaked ?? BigInt(0), decimals)).toLocaleString()} · {Number(rewardStreamCount)} streams · {Number(lockDuration) / 86400}d lock
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 rounded-full font-mono text-[9px] uppercase" style={{ background: active ? "rgba(155,127,212,0.15)" : "rgba(255,100,100,0.1)", color: active ? "#C4A8F0" : "rgba(255,100,100,0.8)" }}>
          {active ? "Live" : "Paused"}
        </span>
        <Btn onClick={() => toggleTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "setFarmActive", args: [BigInt(farmId), !active] })} disabled={toggleTx.isPending || toggleRcpt.isLoading} small>
          {active ? "Pause" : "Activate"}
        </Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function CreateFarmSection() {
  const [stakeToken, setStakeToken] = useState("");
  const [lockDays, setLockDays] = useState("");
  const [penalty, setPenalty] = useState("");
  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });

  return (
    <Card>
      <CardTitle>Create Farm</CardTitle>
      <div className="space-y-5">
        <Field label="Stake Token Address" value={stakeToken} onChange={setStakeToken} placeholder="0x..." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Lock Duration (days)" value={lockDays} onChange={setLockDays} placeholder="0" />
          <Field label="Early Exit Penalty (%)" value={penalty} onChange={setPenalty} placeholder="0" />
        </div>
        <Btn onClick={() => { if (stakeToken) tx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "createFarm", args: [stakeToken as `0x${string}`, BigInt((parseInt(lockDays) || 0) * 86400), BigInt(Math.round((parseFloat(penalty) || 0) * 100))] }); }} disabled={!stakeToken || tx.isPending || rcpt.isLoading} full>
          {tx.isPending || rcpt.isLoading ? "Creating..." : "Create Farm"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Farm created successfully!" />}
        {tx.error && <Err error={tx.error} />}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function AddRewardSection({ farmCount }: { farmCount: number }) {
  const { address } = useAccount();
  const [farmId, setFarmId] = useState("0");
  const [rewardToken, setRewardToken] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("30");
  const [delay, setDelay] = useState("0");

  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const addTx = useWriteContract();
  const addRcpt = useWaitForTransactionReceipt({ hash: addTx.data });

  const decimalsQ = useReadContract({ address: (rewardToken || "0x0000000000000000000000000000000000000000") as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: rewardToken.length === 42 } });
  const allowanceQ = useReadContract({ address: (rewardToken || "0x0000000000000000000000000000000000000000") as `0x${string}`, abi: ERC20_ABI, functionName: "allowance", args: address ? [address, STREAM_FARM_ADDRESS] : undefined, query: { enabled: !!address && rewardToken.length === 42, refetchInterval: 5_000 } });

  const decimals = (decimalsQ.data as number) ?? 18;
  const parsedBudget = (() => { try { return budget ? parseUnits(budget, decimals) : BigInt(0); } catch { return BigInt(0); } })();
  const allowance = (allowanceQ.data as bigint) ?? BigInt(0);
  const needsApproval = parsedBudget > BigInt(0) && allowance < parsedBudget;

  return (
    <Card>
      <CardTitle>Add Reward Stream</CardTitle>
      <div className="space-y-5">
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.5)" }}>Select Farm</label>
          <div className="flex flex-wrap gap-2">
            {farmCount === 0 ? <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.4)" }}>No farms yet.</p> :
              Array.from({ length: farmCount }, (_, i) => (
                <button key={i} onClick={() => setFarmId(String(i))}
                  className="px-3 py-1.5 rounded-lg font-mono text-[11px] transition"
                  style={{ background: farmId === String(i) ? "rgba(155,127,212,0.2)" : "rgba(155,127,212,0.06)", border: `1px solid ${farmId === String(i) ? "rgba(155,127,212,0.5)" : "rgba(155,127,212,0.12)"}`, color: farmId === String(i) ? "#EDE0FF" : "rgba(196,168,240,0.5)" }}>
                  Farm #{i}
                </button>
              ))}
          </div>
        </div>
        <Field label="Reward Token Address" value={rewardToken} onChange={setRewardToken} placeholder="0x..." />
        <Field label="Total Budget (token units)" value={budget} onChange={setBudget} placeholder="10000" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duration (days)" value={days} onChange={setDays} placeholder="30" />
          <Field label="Start Delay (hours)" value={delay} onChange={setDelay} placeholder="0" />
        </div>
        {needsApproval ? (
          <Btn onClick={() => approveTx.writeContract({ address: rewardToken as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [STREAM_FARM_ADDRESS, parsedBudget] })} disabled={approveTx.isPending || approveRcpt.isLoading} full>
            {approveTx.isPending || approveRcpt.isLoading ? "Approving..." : "Approve Tokens"}
          </Btn>
        ) : (
          <Btn onClick={() => { const now = Math.floor(Date.now() / 1000); const start = BigInt(now + (parseInt(delay) || 0) * 3600); const end = start + BigInt((parseInt(days) || 30) * 86400); addTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "addRewardStream", args: [BigInt(farmId), rewardToken as `0x${string}`, parsedBudget, start, end] }); }} disabled={!rewardToken || !parsedBudget || addTx.isPending || addRcpt.isLoading} full>
            {addTx.isPending || addRcpt.isLoading ? "Adding..." : "Add Reward Stream"}
          </Btn>
        )}
        {addRcpt.isSuccess && <Msg text="Reward stream added!" />}
        {(addTx.error || approveTx.error) && <Err error={addTx.error || approveTx.error} />}
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

  return (
    <Card>
      <CardTitle>Boost Tiers</CardTitle>
      <div className="space-y-5">
        <Field label="Durations (days, comma separated)" value={durations} onChange={setDurations} placeholder="7,30,90" />
        <Field label="Multipliers (x, comma separated)" value={multipliers} onChange={setMultipliers} placeholder="1.2,1.5,2.0" />
        <Btn onClick={() => { const d = durations.split(",").map((v) => BigInt(parseInt(v.trim()) * 86400)); const m = multipliers.split(",").map((v) => parseUnits(v.trim(), 18)); tx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "setBoostTiers", args: [d, m] }); }} disabled={tx.isPending || rcpt.isLoading} full>
          {tx.isPending || rcpt.isLoading ? "Updating..." : "Update Boost Tiers"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Boost tiers updated!" />}
        {tx.error && <Err error={tx.error} />}
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
  const decimalsQ = useReadContract({ address: (token || "0x0000000000000000000000000000000000000000") as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: token.length === 42 } });
  const decimals = (decimalsQ.data as number) ?? 18;

  return (
    <Card>
      <CardTitle>Recover Tokens</CardTitle>
      <div className="space-y-5">
        <Field label="Token Address" value={token} onChange={setToken} placeholder="0x..." />
        <Field label="Amount (token units)" value={amount} onChange={setAmount} placeholder="1000" />
        <Btn onClick={() => tx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "recoverTokens", args: [token as `0x${string}`, parseUnits(amount, decimals)] })} disabled={!token || !amount || tx.isPending || rcpt.isLoading} full>
          {tx.isPending || rcpt.isLoading ? "Recovering..." : "Recover Tokens"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Tokens recovered!" />}
        {tx.error && <Err error={tx.error} />}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function AdminsSection() {
  const [addr, setAddr] = useState("");
  const addTx = useWriteContract();
  const addRcpt = useWaitForTransactionReceipt({ hash: addTx.data });
  const rmTx = useWriteContract();
  const rmRcpt = useWaitForTransactionReceipt({ hash: rmTx.data });

  return (
    <Card>
      <CardTitle>Admin Management</CardTitle>
      <p className="font-mono text-[10px] mb-5" style={{ color: "rgba(196,168,240,0.4)" }}>Only the contract owner can add/remove admins</p>
      <div className="space-y-5">
        <Field label="Wallet Address" value={addr} onChange={setAddr} placeholder="0x..." />
        <div className="flex gap-3">
          <Btn onClick={() => { if (addr) addTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "addAdmin", args: [addr as `0x${string}`] }); }} disabled={!addr || addTx.isPending} full>
            {addTx.isPending ? "..." : "Add Admin"}
          </Btn>
          <button onClick={() => { if (addr) rmTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "removeAdmin", args: [addr as `0x${string}`] }); }} disabled={!addr || rmTx.isPending}
            className="flex-1 rounded-xl py-2.5 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(255,80,80,0.08)", color: "rgba(255,100,100,0.9)", border: "1px solid rgba(255,100,100,0.2)" }}>
            {rmTx.isPending ? "..." : "Remove"}
          </button>
        </div>
        {addRcpt.isSuccess && <Msg text="Admin added!" />}
        {rmRcpt.isSuccess && <Msg text="Admin removed!" />}
        {(addTx.error || rmTx.error) && <Err error={addTx.error || rmTx.error} />}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              SHARED UI
// ═══════════════════════════════════════════════════════════════════════════

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-6 mb-4" style={{ background: "rgba(155,127,212,0.03)", border: "1px solid rgba(155,127,212,0.12)" }}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="font-grotesk text-[16px] font-medium mb-5" style={{ color: "#EDE0FF" }}>{children}</p>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.5)" }}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 font-mono text-[13px] outline-none transition focus:border-[rgba(155,127,212,0.5)]"
        style={{ background: "rgba(155,127,212,0.04)", border: "1px solid rgba(155,127,212,0.15)", color: "#EDE0FF" }} />
    </div>
  );
}

function Btn({ children, onClick, disabled, full, small }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; full?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${full ? "w-full" : ""} rounded-xl ${small ? "px-3 py-1.5 text-[10px]" : "px-5 py-3 text-[11px]"} font-grotesk uppercase tracking-wider transition disabled:opacity-40 hover:opacity-90`}
      style={{ background: "rgba(155,127,212,0.15)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)" }}>
      {children}
    </button>
  );
}

function Msg({ text }: { text: string }) { return <p className="font-mono text-[11px] py-2" style={{ color: "#C4A8F0" }}>✓ {text}</p>; }
function Err({ error }: { error: any }) { return error ? <p className="font-mono text-[11px] py-2" style={{ color: "rgba(255,100,100,0.9)" }}>{error?.shortMessage || error?.message}</p> : null; }
