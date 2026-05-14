"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import { parseUnits, formatUnits } from "viem";
import { STREAM_FARM_ADDRESS, STREAM_FARM_ABI, ERC20_ABI } from "@/lib/contracts";

export default function AdminDashboard() {
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-grotesk text-[24px] font-semibold tracking-tight">Stream Farm Admin</h1>
          <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.55)" }}>Manage farms · Add rewards · Control admins</p>
        </div>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <EmptyState title="Connect Wallet" sub="Connect an admin wallet to access the dashboard." />
      ) : isAdminQ.isLoading ? (
        <div className="text-center py-20">
          <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: "rgba(155,127,212,0.2)", borderTopColor: "rgba(155,127,212,0.8)" }} />
        </div>
      ) : !isAdmin ? (
        <EmptyState title="Access Denied" sub={`Wallet ${address?.slice(0, 6)}...${address?.slice(-4)} is not an admin.`} />
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="text-center py-20">
      <p className="text-[18px] font-grotesk mb-2">{title}</p>
      <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.55)" }}>{sub}</p>
    </div>
  );
}

function Dashboard() {
  const { address } = useAccount();
  const [section, setSection] = useState("farms");

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
      <Card>
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
      </Card>

      <div className="flex flex-wrap gap-1 p-1 rounded-full my-6" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
        {sections.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className="px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition"
            style={section === s.key ? { background: "rgba(155,127,212,0.35)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" } : { color: "rgba(196,168,240,0.5)" }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "farms" && <FarmsSection farmCount={farmCount} />}
      {section === "create" && <CreateFarmSection />}
      {section === "rewards" && <AddRewardSection farmCount={farmCount} />}
      {section === "boosts" && <BoostTiersSection />}
      {section === "recover" && <RecoverSection />}
      {section === "admins" && isOwner && <AdminsSection />}
    </div>
  );
}

function FarmsSection({ farmCount }: { farmCount: number }) {
  if (farmCount === 0) return <Card><p className="text-center py-8 font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.5)" }}>No farms yet.</p></Card>;
  return <div className="space-y-3">{Array.from({ length: farmCount }, (_, i) => <FarmRow key={i} farmId={i} />)}</div>;
}

function FarmRow({ farmId }: { farmId: number }) {
  const farmQ = useReadContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "getFarm", args: [BigInt(farmId)], query: { refetchInterval: 10_000 } });
  const data = farmQ.data as any;
  const toggleTx = useWriteContract();
  const toggleRcpt = useWaitForTransactionReceipt({ hash: toggleTx.data });

  const stakeToken = data?.[0] as `0x${string}` | undefined;
  const symbolQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "symbol", query: { enabled: !!stakeToken } });
  const decimalsQ = useReadContract({ address: stakeToken, abi: ERC20_ABI, functionName: "decimals", query: { enabled: !!stakeToken } });

  if (!data) return <Card><div className="h-12 animate-pulse" /></Card>;
  const [, , totalStaked, active, lockDuration, earlyWithdrawBps, rewardStreamCount] = data;
  const symbol = (symbolQ.data as string) || "...";
  const decimals = (decimalsQ.data as number) ?? 18;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-grotesk text-[14px] font-semibold">#{farmId} · {symbol}</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: "rgba(155,127,212,0.2)", color: active ? "#C4A8F0" : "rgba(255,100,100,0.9)", border: `1px solid rgba(155,127,212,0.4)` }}>
              {active ? "Live" : "Paused"}
            </span>
          </div>
          <p className="font-mono text-[9px] mt-1" style={{ color: "rgba(196,168,240,0.45)" }}>
            TVL: {Number(formatUnits(totalStaked ?? BigInt(0), decimals)).toLocaleString()} {symbol} · {Number(rewardStreamCount)} streams · Lock: {Number(lockDuration) / 86400}d · Penalty: {Number(earlyWithdrawBps) / 100}%
          </p>
        </div>
        <Btn onClick={() => toggleTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "setFarmActive", args: [BigInt(farmId), !active] })} disabled={toggleTx.isPending || toggleRcpt.isLoading}>
          {toggleTx.isPending ? "..." : active ? "Pause" : "Activate"}
        </Btn>
      </div>
    </Card>
  );
}

function CreateFarmSection() {
  const [stakeToken, setStakeToken] = useState("");
  const [lockDays, setLockDays] = useState("");
  const [penalty, setPenalty] = useState("");
  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Create Farm</h3>
      <div className="space-y-4">
        <Field label="Stake Token Address" value={stakeToken} onChange={setStakeToken} placeholder="0x..." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Lock Duration (days)" value={lockDays} onChange={setLockDays} placeholder="0" />
          <Field label="Early Exit Penalty (%)" value={penalty} onChange={setPenalty} placeholder="0" />
        </div>
        <Btn onClick={() => { if (stakeToken) tx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "createFarm", args: [stakeToken as `0x${string}`, BigInt((parseInt(lockDays) || 0) * 86400), BigInt(Math.round((parseFloat(penalty) || 0) * 100))] }); }} disabled={!stakeToken || tx.isPending || rcpt.isLoading} full>
          {tx.isPending || rcpt.isLoading ? "Creating..." : "Create Farm"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Farm created!" />}
        {tx.error && <Err error={tx.error} />}
      </div>
    </Card>
  );
}

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

  const decimalsQ = useReadContract({ address: rewardToken as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: rewardToken.length === 42 } });
  const allowanceQ = useReadContract({ address: rewardToken as `0x${string}`, abi: ERC20_ABI, functionName: "allowance", args: address ? [address, STREAM_FARM_ADDRESS] : undefined, query: { enabled: !!address && rewardToken.length === 42, refetchInterval: 5_000 } });

  const decimals = (decimalsQ.data as number) ?? 18;
  const parsedBudget = (() => { try { return budget ? parseUnits(budget, decimals) : BigInt(0); } catch { return BigInt(0); } })();
  const allowance = (allowanceQ.data as bigint) ?? BigInt(0);
  const needsApproval = parsedBudget > BigInt(0) && allowance < parsedBudget;

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Add Reward Stream</h3>
      <div className="space-y-4">
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>Select Farm</label>
          <div className="flex flex-wrap gap-2">
            {farmCount === 0 ? <p className="font-mono text-[9px]" style={{ color: "rgba(196,168,240,0.4)" }}>No farms yet.</p> :
              Array.from({ length: farmCount }, (_, i) => (
                <button key={i} onClick={() => setFarmId(String(i))}
                  className="px-3 py-1.5 rounded-lg font-mono text-[11px] transition"
                  style={{ background: farmId === String(i) ? "rgba(155,127,212,0.3)" : "rgba(155,127,212,0.08)", border: `1px solid ${farmId === String(i) ? "rgba(155,127,212,0.6)" : "rgba(155,127,212,0.2)"}`, color: farmId === String(i) ? "#EDE0FF" : "rgba(196,168,240,0.5)" }}>
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

function BoostTiersSection() {
  const [durations, setDurations] = useState("7,30,90");
  const [multipliers, setMultipliers] = useState("1.2,1.5,2.0");
  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Boost Tiers</h3>
      <div className="space-y-4">
        <Field label="Durations (days, comma separated)" value={durations} onChange={setDurations} placeholder="7,30,90" />
        <Field label="Multipliers (x, comma separated)" value={multipliers} onChange={setMultipliers} placeholder="1.2,1.5,2.0" />
        <Btn onClick={() => { const d = durations.split(",").map((v) => BigInt(parseInt(v.trim()) * 86400)); const m = multipliers.split(",").map((v) => parseUnits(v.trim(), 18)); tx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "setBoostTiers", args: [d, m] }); }} disabled={tx.isPending || rcpt.isLoading} full>
          {tx.isPending || rcpt.isLoading ? "Updating..." : "Update Boost Tiers"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Updated!" />}
        {tx.error && <Err error={tx.error} />}
      </div>
    </Card>
  );
}

function RecoverSection() {
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });
  const decimalsQ = useReadContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: token.length === 42 } });
  const decimals = (decimalsQ.data as number) ?? 18;

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Recover Tokens</h3>
      <div className="space-y-4">
        <Field label="Token Address" value={token} onChange={setToken} placeholder="0x..." />
        <Field label="Amount (token units)" value={amount} onChange={setAmount} placeholder="1000" />
        <Btn onClick={() => tx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "recoverTokens", args: [token as `0x${string}`, parseUnits(amount, decimals)] })} disabled={!token || !amount || tx.isPending || rcpt.isLoading} full>
          {tx.isPending || rcpt.isLoading ? "Recovering..." : "Recover Tokens"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Recovered!" />}
        {tx.error && <Err error={tx.error} />}
      </div>
    </Card>
  );
}

function AdminsSection() {
  const [addr, setAddr] = useState("");
  const addTx = useWriteContract();
  const addRcpt = useWaitForTransactionReceipt({ hash: addTx.data });
  const rmTx = useWriteContract();
  const rmRcpt = useWaitForTransactionReceipt({ hash: rmTx.data });

  return (
    <Card>
      <h3 className="font-grotesk text-[14px] font-semibold mb-4">Admin Management</h3>
      <p className="font-mono text-[9px] mb-4" style={{ color: "rgba(196,168,240,0.4)" }}>Only the contract owner can add/remove admins</p>
      <div className="space-y-4">
        <Field label="Wallet Address" value={addr} onChange={setAddr} placeholder="0x..." />
        <div className="flex gap-3">
          <Btn onClick={() => { if (addr) addTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "addAdmin", args: [addr as `0x${string}`] }); }} disabled={!addr || addTx.isPending} full>
            {addTx.isPending ? "..." : "Add Admin"}
          </Btn>
          <button onClick={() => { if (addr) rmTx.writeContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "removeAdmin", args: [addr as `0x${string}`] }); }} disabled={!addr || rmTx.isPending}
            className="flex-1 rounded-xl py-2.5 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(255,100,100,0.12)", color: "rgba(255,100,100,0.9)", border: "1px solid rgba(255,100,100,0.3)" }}>
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

// ── Shared UI ──
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(155,127,212,0.05)", border: "1px solid rgba(155,127,212,0.35)" }}>{children}</div>;
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
function Btn({ children, onClick, disabled, full }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; full?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${full ? "w-full" : ""} rounded-xl py-2.5 px-4 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40`}
      style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
      {children}
    </button>
  );
}
function Msg({ text }: { text: string }) { return <p className="font-mono text-[10px]" style={{ color: "#C4A8F0" }}>✓ {text}</p>; }
function Err({ error }: { error: any }) { return error ? <p className="font-mono text-[10px]" style={{ color: "rgba(255,100,100,0.9)" }}>{error?.shortMessage || error?.message}</p> : null; }
