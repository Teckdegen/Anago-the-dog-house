"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useState, useEffect, useRef } from "react";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import {
  STREAM_FARM_ADDRESS,
  TOKEN_LOCK_ADDRESS,
  VESTING_NFT_ADDRESS,
  STREAM_FARM_ABI,
  TOKEN_LOCK_ABI,
  VESTING_NFT_ABI,
  ERC20_ABI,
} from "@/lib/contracts";
import {
  DEFAULT_CHAIN_ID,
  EXPLORER_BASE,
  MAIN_APP_URL,
} from "@/lib/deployments";
import { admin } from "@/lib/theme";
import { Card, CardTitle, Field, Btn, Msg, Err, StatCard, PillTabs } from "./adminUi";

type NavKey = "overview" | "farms" | "lock" | "vest" | "admins";

const NAV: { key: NavKey; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "◈" },
  { key: "farms", label: "Yield Farms", icon: "◎" },
  { key: "lock", label: "Token Lock", icon: "⬡" },
  { key: "vest", label: "Vesting", icon: "◇" },
  { key: "admins", label: "Admins", icon: "⚙" },
];

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
    <div className="min-h-screen flex" style={{ background: admin.bg }}>
      <aside
        className="hidden lg:flex flex-col w-[240px] shrink-0 border-r min-h-screen sticky top-0"
        style={{ background: admin.sidebar, borderColor: admin.border }}
      >
        <div className="px-5 py-6 border-b" style={{ borderColor: admin.border }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-grotesk text-lg"
              style={{ background: admin.purpleBgHover, color: admin.accent }}
            >
              ◆
            </div>
            <div>
              <p className="font-grotesk text-[15px] font-semibold" style={{ color: admin.text }}>
                Dog House
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: admin.textDim }}>
                Protocol Admin
              </p>
            </div>
          </div>
        </div>
        <div className="px-3 py-4">
          <ChainBadge />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between gap-4 px-5 sm:px-8 py-4 border-b sticky top-0 z-20 backdrop-blur-md"
          style={{ borderColor: admin.border, background: "rgba(6,4,15,0.92)" }}
        >
          <div className="lg:hidden flex items-center gap-2">
            <span className="font-grotesk text-[15px] font-semibold" style={{ color: admin.text }}>
              Protocol Admin
            </span>
            <ChainBadge />
          </div>
          <p className="hidden lg:block font-grotesk text-[13px]" style={{ color: admin.textMuted }}>
            Monad · on-chain management
          </p>
          <ConnectButton />
        </header>

        <main className="flex-1 px-5 sm:px-8 py-6 sm:py-8 max-w-[1200px]">
          {!isConnected ? (
            <EmptyState title="Connect wallet" sub="Connect an admin wallet to manage protocol contracts." />
          ) : isAdminQ.isLoading ? (
            <div className="flex items-center justify-center py-32">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: admin.border, borderTopColor: admin.purple }}
              />
            </div>
          ) : !isAdmin ? (
            <AccessDenied address={address} />
          ) : (
            <Dashboard />
          )}
        </main>
      </div>
    </div>
  );
}

function ChainBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] uppercase"
      style={{ background: admin.purpleBg, border: `1px solid ${admin.border}`, color: admin.textMuted }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: admin.green }} />
      Chain {DEFAULT_CHAIN_ID}
    </span>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ border: `1px dashed ${admin.border}` }}>
      <p className="font-grotesk text-[22px] font-medium" style={{ color: admin.text }}>
        {title}
      </p>
      <p className="font-mono text-[12px] mt-2 text-center max-w-sm" style={{ color: admin.textMuted }}>
        {sub}
      </p>
    </div>
  );
}

function AccessDenied({ address }: { address?: string }) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <EmptyState
        title="Access denied"
        sub={`${address?.slice(0, 6)}…${address?.slice(-4)} is not a StreamFarm admin.`}
      />
      <Card>
        <CardTitle sub="StreamFarm uses on-chain admin roles">How to get access</CardTitle>
        <ol className="font-mono text-[11px] space-y-2 list-decimal list-inside" style={{ color: admin.textMuted }}>
          <li>Connect the wallet that deployed StreamFarm (owner), or</li>
          <li>Ask the owner to add your wallet under Admins.</li>
        </ol>
      </Card>
    </div>
  );
}

function Dashboard() {
  const { address } = useAccount();
  const [nav, setNav] = useState<NavKey>("overview");
  const [farmTab, setFarmTab] = useState("overview");

  const farmCountQ = useReadContract({
    address: STREAM_FARM_ADDRESS,
    abi: STREAM_FARM_ABI,
    functionName: "farmCount",
    query: { refetchInterval: 10_000 },
  });
  const ownerQ = useReadContract({
    address: STREAM_FARM_ADDRESS,
    abi: STREAM_FARM_ABI,
    functionName: "owner",
  });

  const locksQ = useReadContracts({
    contracts: [
      { address: TOKEN_LOCK_ADDRESS, abi: TOKEN_LOCK_ABI, functionName: "locksLength" },
      { address: TOKEN_LOCK_ADDRESS, abi: TOKEN_LOCK_ABI, functionName: "totalLocks" },
    ],
  });
  const vestQ = useReadContract({
    address: VESTING_NFT_ADDRESS,
    abi: VESTING_NFT_ABI,
    functionName: "totalVestings",
    query: { refetchInterval: 15_000 },
  });

  const farmCount = Number(farmCountQ.data ?? 0);
  const owner = ownerQ.data as string | undefined;
  const isOwner = !!address && owner?.toLowerCase() === address.toLowerCase();
  const locksLen =
    Number(locksQ.data?.[0]?.result ?? locksQ.data?.[1]?.result ?? 0) || 0;
  const vestCount = Number(vestQ.data ?? 0);

  const visibleNav = NAV.filter((n) => n.key !== "admins" || isOwner);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      <nav className="lg:w-[200px] shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
        {visibleNav.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setNav(item.key)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-grotesk text-[12px] transition whitespace-nowrap text-left w-full"
            style={
              nav === item.key
                ? { background: admin.purpleBgHover, color: admin.text, border: `1px solid ${admin.borderStrong}` }
                : { color: admin.textMuted, border: "1px solid transparent" }
            }
          >
            <span style={{ color: nav === item.key ? admin.accent : admin.textDim }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0 space-y-6">
        {nav === "overview" && (
          <>
            <div>
              <h1 className="font-grotesk text-[26px] sm:text-[30px] font-semibold" style={{ color: admin.text }}>
                Protocol overview
              </h1>
              <p className="font-mono text-[11px] mt-1" style={{ color: admin.textMuted }}>
                Live stats from Monad contracts
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="Yield farms" value={String(farmCount)} sub="StreamFarm pools" accent />
              <StatCard label="Token locks" value={String(locksLen)} sub="NFT lock positions" />
              <StatCard label="Vestings" value={String(vestCount)} sub="Vesting schedules" />
              <StatCard
                label="Your role"
                value={isOwner ? "Owner" : "Admin"}
                sub={isOwner ? "Full access" : "Farm management"}
                accent
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <ContractsPanel />
              <QuickLinksPanel />
            </div>
            <Card>
              <CardTitle sub="Use a Gnosis Safe via WalletConnect — each action needs Safe confirmations">
                Multisig & treasury
              </CardTitle>
              <p className="font-mono text-[11px] leading-relaxed" style={{ color: admin.textMuted }}>
                There is no built-in multisig contract. Connect your Safe as the wallet here to lock, vest, or
                manage farms with multiple signers. Lock and vest use permissionless contracts — any wallet can
                create schedules after approving tokens.
              </p>
            </Card>
          </>
        )}

        {nav === "farms" && (
          <>
            <div>
              <h1 className="font-grotesk text-[26px] font-semibold" style={{ color: admin.text }}>
                Yield farms
              </h1>
              <p className="font-mono text-[11px] mt-1" style={{ color: admin.textMuted }}>
                StreamFarm · {farmCount} pool{farmCount !== 1 ? "s" : ""}
              </p>
            </div>
            <PillTabs
              active={farmTab}
              onChange={setFarmTab}
              tabs={[
                { key: "overview", label: "All farms" },
                { key: "create", label: "Create" },
                { key: "rewards", label: "Rewards" },
                { key: "boosts", label: "Boosts" },
                { key: "recover", label: "Recover" },
              ]}
            />
            {farmTab === "overview" && <FarmsOverview farmCount={farmCount} isOwner={isOwner} />}
            {farmTab === "create" && <CreateFarmSection />}
            {farmTab === "rewards" && <AddRewardSection farmCount={farmCount} />}
            {farmTab === "boosts" && <BoostTiersSection />}
            {farmTab === "recover" && <RecoverSection />}
          </>
        )}

        {nav === "lock" && <LockSection />}
        {nav === "vest" && <VestSection />}
        {nav === "admins" && isOwner && <AdminsSection />}
      </div>
    </div>
  );
}

function ContractsPanel() {
  const rows = [
    { label: "StreamFarm", addr: STREAM_FARM_ADDRESS },
    { label: "Token Lock", addr: TOKEN_LOCK_ADDRESS },
    { label: "Vesting NFT", addr: VESTING_NFT_ADDRESS },
  ];
  return (
    <Card>
      <CardTitle>Contracts</CardTitle>
      <div className="space-y-3">
        {rows.map((r) => (
          <a
            key={r.label}
            href={`${EXPLORER_BASE}/address/${r.addr}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition hover:opacity-90"
            style={{ background: admin.purpleBg, border: `1px solid ${admin.border}` }}
          >
            <span className="font-grotesk text-[13px]" style={{ color: admin.text }}>
              {r.label}
            </span>
            <span className="font-mono text-[10px]" style={{ color: admin.accent }}>
              {r.addr.slice(0, 8)}…{r.addr.slice(-4)}
            </span>
          </a>
        ))}
      </div>
    </Card>
  );
}

function QuickLinksPanel() {
  const links = [
    { label: "Public app · Farm", href: `${MAIN_APP_URL}/farm` },
    { label: "Public app · Lock", href: `${MAIN_APP_URL}/lock` },
    { label: "Public app · Vesting", href: `${MAIN_APP_URL}/vesting` },
    { label: "Public app · CLMM", href: `${MAIN_APP_URL}/clmm` },
  ];
  return (
    <Card>
      <CardTitle>Main app</CardTitle>
      <div className="space-y-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl px-3 py-2.5 font-mono text-[11px] transition hover:opacity-90"
            style={{ background: admin.purpleBg, border: `1px solid ${admin.border}`, color: admin.accent }}
          >
            {l.label} →
          </a>
        ))}
      </div>
    </Card>
  );
}

function FarmsOverview({ farmCount, isOwner }: { farmCount: number; isOwner: boolean }) {
  if (farmCount === 0) {
    return (
      <Card>
        <CardTitle>No farms yet</CardTitle>
        <ol className="font-mono text-[11px] space-y-2 list-decimal list-inside" style={{ color: admin.textMuted }}>
          <li>Create Farm — stake token, lock days, penalty %.</li>
          <li>Add Rewards — fund a reward stream.</li>
          <li>Users stake on the main app /farm page.</li>
          {!isOwner && <li>Ask the owner to add you under Admins.</li>}
        </ol>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: farmCount }, (_, i) => (
        <FarmRow key={i} farmId={i} />
      ))}
    </div>
  );
}

function FarmRow({ farmId }: { farmId: number }) {
  const farmQ = useReadContract({
    address: STREAM_FARM_ADDRESS,
    abi: STREAM_FARM_ABI,
    functionName: "getFarm",
    args: [BigInt(farmId)],
    query: { refetchInterval: 10_000 },
  });
  const data = farmQ.data as
    | readonly [`0x${string}`, bigint, bigint, boolean, bigint, bigint, bigint]
    | undefined;
  const toggleTx = useWriteContract();
  const toggleRcpt = useWaitForTransactionReceipt({ hash: toggleTx.data });

  const stakeToken = (data?.[0] ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const hasToken = !!data?.[0] && data[0] !== "0x0000000000000000000000000000000000000000";
  const symbolQ = useReadContract({
    address: stakeToken,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: hasToken },
  });
  const decimalsQ = useReadContract({
    address: stakeToken,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: hasToken },
  });

  if (!data) {
    return (
      <div className="h-20 rounded-2xl animate-pulse" style={{ background: admin.purpleBg }} />
    );
  }
  const totalStaked = data[2];
  const active = data[3];
  const lockDuration = data[4];
  const rewardStreamCount = data[6];
  const symbol = (symbolQ.data as string) || "???";
  const decimals = (decimalsQ.data as number) ?? 18;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      style={{ background: admin.panel, border: `1px solid ${admin.border}` }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center font-grotesk text-[15px] font-semibold"
          style={{ background: admin.purpleBgHover, color: admin.accent }}
        >
          {symbol[0]}
        </div>
        <div>
          <p className="font-grotesk text-[15px] font-medium" style={{ color: admin.text }}>
            {symbol} Farm{" "}
            <span className="font-mono text-[10px]" style={{ color: admin.textDim }}>
              #{farmId}
            </span>
          </p>
          <p className="font-mono text-[10px] mt-0.5" style={{ color: admin.textMuted }}>
            TVL {Number(formatUnits(totalStaked, decimals)).toLocaleString()} · {Number(rewardStreamCount)}{" "}
            streams · {Number(lockDuration) / 86400}d lock
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="px-2.5 py-1 rounded-full font-mono text-[9px] uppercase"
          style={{
            background: active ? "rgba(110,231,168,0.12)" : "rgba(248,113,113,0.1)",
            color: active ? admin.green : admin.red,
          }}
        >
          {active ? "Live" : "Paused"}
        </span>
        <Btn
          small
          onClick={() =>
            toggleTx.writeContract({
              address: STREAM_FARM_ADDRESS,
              abi: STREAM_FARM_ABI,
              functionName: "setFarmActive",
              args: [BigInt(farmId), !active],
            })
          }
          disabled={toggleTx.isPending || toggleRcpt.isLoading}
        >
          {active ? "Pause" : "Activate"}
        </Btn>
      </div>
    </div>
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
      <CardTitle sub="New staking pool on StreamFarm">Create farm</CardTitle>
      <div className="space-y-5">
        <Field label="Stake token" value={stakeToken} onChange={setStakeToken} placeholder="0x…" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Lock duration (days)" value={lockDays} onChange={setLockDays} placeholder="30" />
          <Field label="Early exit penalty (%)" value={penalty} onChange={setPenalty} placeholder="10" />
        </div>
        <Btn
          full
          onClick={() => {
            if (!stakeToken) return;
            tx.writeContract({
              address: STREAM_FARM_ADDRESS,
              abi: STREAM_FARM_ABI,
              functionName: "createFarm",
              args: [
                stakeToken as `0x${string}`,
                BigInt((parseInt(lockDays, 10) || 0) * 86400),
                BigInt(Math.round((parseFloat(penalty) || 0) * 100)),
              ],
            });
          }}
          disabled={!stakeToken || tx.isPending || rcpt.isLoading}
        >
          {tx.isPending || rcpt.isLoading ? "Creating…" : "Create farm"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Farm created." />}
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

  const tokenAddr = (rewardToken || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const decimalsQ = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: rewardToken.length === 42 },
  });
  const allowanceQ = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, STREAM_FARM_ADDRESS] : undefined,
    query: { enabled: !!address && rewardToken.length === 42, refetchInterval: 5_000 },
  });

  const decimals = (decimalsQ.data as number) ?? 18;
  const parsedBudget = (() => {
    try {
      return budget ? parseUnits(budget, decimals) : 0n;
    } catch {
      return 0n;
    }
  })();
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = parsedBudget > 0n && allowance < parsedBudget;

  return (
    <Card>
      <CardTitle sub="Fund emissions for stakers">Add reward stream</CardTitle>
      <div className="space-y-5">
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: admin.textDim }}>
            Farm
          </label>
          <div className="flex flex-wrap gap-2">
            {farmCount === 0 ? (
              <p className="font-mono text-[10px]" style={{ color: admin.textDim }}>
                No farms yet.
              </p>
            ) : (
              Array.from({ length: farmCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFarmId(String(i))}
                  className="px-3 py-1.5 rounded-lg font-mono text-[11px]"
                  style={{
                    background: farmId === String(i) ? admin.purpleBgHover : admin.purpleBg,
                    border: `1px solid ${farmId === String(i) ? admin.borderStrong : admin.border}`,
                    color: farmId === String(i) ? admin.text : admin.textMuted,
                  }}
                >
                  #{i}
                </button>
              ))
            )}
          </div>
        </div>
        <Field label="Reward token" value={rewardToken} onChange={setRewardToken} placeholder="0x…" />
        <Field label="Total budget" value={budget} onChange={setBudget} placeholder="10000" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Duration (days)" value={days} onChange={setDays} placeholder="30" />
          <Field label="Start delay (hours)" value={delay} onChange={setDelay} placeholder="0" />
        </div>
        {needsApproval ? (
          <Btn
            full
            onClick={() =>
              approveTx.writeContract({
                address: rewardToken as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [STREAM_FARM_ADDRESS, parsedBudget],
              })
            }
            disabled={approveTx.isPending || approveRcpt.isLoading}
          >
            {approveTx.isPending || approveRcpt.isLoading ? "Approving…" : "Approve tokens"}
          </Btn>
        ) : (
          <Btn
            full
            onClick={() => {
              const now = Math.floor(Date.now() / 1000);
              const start = BigInt(now + (parseInt(delay, 10) || 0) * 3600);
              const end = start + BigInt((parseInt(days, 10) || 30) * 86400);
              addTx.writeContract({
                address: STREAM_FARM_ADDRESS,
                abi: STREAM_FARM_ABI,
                functionName: "addRewardStream",
                args: [BigInt(farmId), rewardToken as `0x${string}`, parsedBudget, start, end],
              });
            }}
            disabled={!rewardToken || !parsedBudget || addTx.isPending || addRcpt.isLoading}
          >
            {addTx.isPending || addRcpt.isLoading ? "Adding…" : "Add reward stream"}
          </Btn>
        )}
        {addRcpt.isSuccess && <Msg text="Reward stream added." />}
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
      <CardTitle sub="Global lock multipliers for farm shares">Boost tiers</CardTitle>
      <div className="space-y-5">
        <Field label="Durations (days, comma-separated)" value={durations} onChange={setDurations} placeholder="7,30,90" />
        <Field label="Multipliers (x, comma-separated)" value={multipliers} onChange={setMultipliers} placeholder="1.2,1.5,2.0" />
        <Btn
          full
          onClick={() => {
            const d = durations.split(",").map((v) => BigInt(parseInt(v.trim(), 10) * 86400));
            const m = multipliers.split(",").map((v) => parseUnits(v.trim(), 18));
            tx.writeContract({
              address: STREAM_FARM_ADDRESS,
              abi: STREAM_FARM_ABI,
              functionName: "setBoostTiers",
              args: [d, m],
            });
          }}
          disabled={tx.isPending || rcpt.isLoading}
        >
          {tx.isPending || rcpt.isLoading ? "Updating…" : "Update boost tiers"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Boost tiers updated." />}
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
  const tokenAddr = (token || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const decimalsQ = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: token.length === 42 },
  });
  const decimals = (decimalsQ.data as number) ?? 18;

  return (
    <Card>
      <CardTitle sub="Pull stuck tokens from StreamFarm">Recover tokens</CardTitle>
      <div className="space-y-5">
        <Field label="Token" value={token} onChange={setToken} placeholder="0x…" />
        <Field label="Amount" value={amount} onChange={setAmount} placeholder="1000" />
        <Btn
          full
          onClick={() =>
            tx.writeContract({
              address: STREAM_FARM_ADDRESS,
              abi: STREAM_FARM_ABI,
              functionName: "recoverTokens",
              args: [token as `0x${string}`, parseUnits(amount, decimals)],
            })
          }
          disabled={!token || !amount || tx.isPending || rcpt.isLoading}
        >
          {tx.isPending || rcpt.isLoading ? "Recovering…" : "Recover"}
        </Btn>
        {rcpt.isSuccess && <Msg text="Tokens recovered." />}
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
      <CardTitle sub="Owner only · StreamFarm admins">Admin management</CardTitle>
      <div className="space-y-5">
        <Field label="Wallet address" value={addr} onChange={setAddr} placeholder="0x…" />
        <div className="flex gap-3">
          <Btn
            full
            onClick={() => {
              if (addr)
                addTx.writeContract({
                  address: STREAM_FARM_ADDRESS,
                  abi: STREAM_FARM_ABI,
                  functionName: "addAdmin",
                  args: [addr as `0x${string}`],
                });
            }}
            disabled={!addr || addTx.isPending}
          >
            {addTx.isPending ? "…" : "Add admin"}
          </Btn>
          <Btn
            full
            variant="danger"
            onClick={() => {
              if (addr)
                rmTx.writeContract({
                  address: STREAM_FARM_ADDRESS,
                  abi: STREAM_FARM_ABI,
                  functionName: "removeAdmin",
                  args: [addr as `0x${string}`],
                });
            }}
            disabled={!addr || rmTx.isPending}
          >
            {rmTx.isPending ? "…" : "Remove"}
          </Btn>
        </div>
        {addRcpt.isSuccess && <Msg text="Admin added." />}
        {rmRcpt.isSuccess && <Msg text="Admin removed." />}
        {(addTx.error || rmTx.error) && <Err error={addTx.error || rmTx.error} />}
      </div>
    </Card>
  );
}

function LockSection() {
  const { address } = useAccount();
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [unlockDays, setUnlockDays] = useState("30");

  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const lockTx = useWriteContract();
  const lockRcpt = useWaitForTransactionReceipt({ hash: lockTx.data });
  const pendingRef = useRef<{ token: `0x${string}`; amount: bigint; unlockAt: bigint } | null>(null);

  const tokenAddr = (token || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const decimalsQ = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: token.length === 42 },
  });
  const allowanceQ = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, TOKEN_LOCK_ADDRESS] : undefined,
    query: { enabled: !!address && token.length === 42, refetchInterval: 5_000 },
  });

  const decimals = (decimalsQ.data as number) ?? 18;
  const parsed = (() => {
    try {
      return amount ? parseUnits(amount, decimals) : 0n;
    } catch {
      return 0n;
    }
  })();
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = parsed > 0n && allowance < parsed;

  useEffect(() => {
    if (!approveRcpt.isSuccess || !pendingRef.current) return;
    const p = pendingRef.current;
    pendingRef.current = null;
    lockTx.writeContract({
      address: TOKEN_LOCK_ADDRESS,
      abi: TOKEN_LOCK_ABI,
      functionName: "createLock",
      args: [p.token, p.amount, p.unlockAt],
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  const runLock = () => {
    if (!token || parsed === 0n) return;
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + (parseInt(unlockDays, 10) || 30) * 86400);
    const t = token as `0x${string}`;
    if (needsApproval) {
      pendingRef.current = { token: t, amount: parsed, unlockAt };
      approveTx.writeContract({
        address: t,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [TOKEN_LOCK_ADDRESS, maxUint256],
      });
      return;
    }
    lockTx.writeContract({
      address: TOKEN_LOCK_ADDRESS,
      abi: TOKEN_LOCK_ABI,
      functionName: "createLock",
      args: [t, parsed, unlockAt],
    });
  };

  const busy = approveTx.isPending || approveRcpt.isLoading || lockTx.isPending || lockRcpt.isLoading;

  return (
    <>
      <div>
        <h1 className="font-grotesk text-[26px] font-semibold" style={{ color: admin.text }}>
          Token lock
        </h1>
        <p className="font-mono text-[11px] mt-1" style={{ color: admin.textMuted }}>
          Lock tokens · mints an NFT position
        </p>
      </div>
      <Card>
        <CardTitle sub="Approve + lock in up to 2 transactions">Create lock</CardTitle>
        <div className="space-y-5">
          <Field label="Token address" value={token} onChange={setToken} placeholder="0x…" />
          <Field label="Amount" value={amount} onChange={setAmount} placeholder="1000" />
          <Field label="Unlock in (days)" value={unlockDays} onChange={setUnlockDays} placeholder="30" />
          <Btn full onClick={runLock} disabled={!token || parsed === 0n || busy}>
            {busy ? "Working…" : needsApproval ? "Approve & lock" : "Create lock"}
          </Btn>
          {lockRcpt.isSuccess && <Msg text="Lock NFT minted." />}
          {(lockTx.error || approveTx.error) && <Err error={lockTx.error || approveTx.error} />}
        </div>
      </Card>
    </>
  );
}

function VestSection() {
  const { address } = useAccount();
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [durationDays, setDurationDays] = useState("365");
  const [cliffDays, setCliffDays] = useState("0");

  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const vestTx = useWriteContract();
  const vestRcpt = useWaitForTransactionReceipt({ hash: vestTx.data });
  const pendingRef = useRef<{
    beneficiary: `0x${string}`;
    token: `0x${string}`;
    amount: bigint;
    duration: bigint;
    cliff: bigint;
  } | null>(null);

  const tokenAddr = (token || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const decimalsQ = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: token.length === 42 },
  });
  const allowanceQ = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, VESTING_NFT_ADDRESS] : undefined,
    query: { enabled: !!address && token.length === 42, refetchInterval: 5_000 },
  });

  const decimals = (decimalsQ.data as number) ?? 18;
  const parsed = (() => {
    try {
      return amount ? parseUnits(amount, decimals) : 0n;
    } catch {
      return 0n;
    }
  })();
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = parsed > 0n && allowance < parsed;
  const validBeneficiary = /^0x[a-fA-F0-9]{40}$/.test(beneficiary);
  const cliffSec = BigInt((parseInt(cliffDays, 10) || 0) * 86400);
  const durationSec = BigInt((parseInt(durationDays, 10) || 365) * 86400);

  useEffect(() => {
    if (!approveRcpt.isSuccess || !pendingRef.current) return;
    const p = pendingRef.current;
    pendingRef.current = null;
    vestTx.writeContract({
      address: VESTING_NFT_ADDRESS,
      abi: VESTING_NFT_ABI,
      functionName: "createVesting",
      args: [p.beneficiary, p.token, p.amount, p.duration, p.cliff],
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  const runVest = () => {
    if (!token || parsed === 0n || !validBeneficiary) return;
    const params = {
      beneficiary: beneficiary as `0x${string}`,
      token: token as `0x${string}`,
      amount: parsed,
      duration: durationSec,
      cliff: cliffSec,
    };
    if (needsApproval) {
      pendingRef.current = params;
      approveTx.writeContract({
        address: params.token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [VESTING_NFT_ADDRESS, maxUint256],
      });
      return;
    }
    vestTx.writeContract({
      address: VESTING_NFT_ADDRESS,
      abi: VESTING_NFT_ABI,
      functionName: "createVesting",
      args: [params.beneficiary, params.token, params.amount, params.duration, params.cliff],
    });
  };

  const busy = approveTx.isPending || approveRcpt.isLoading || vestTx.isPending || vestRcpt.isLoading;

  return (
    <>
      <div>
        <h1 className="font-grotesk text-[26px] font-semibold" style={{ color: admin.text }}>
          Vesting
        </h1>
        <p className="font-mono text-[11px] mt-1" style={{ color: admin.textMuted }}>
          Linear vest · NFT sent to beneficiary
        </p>
      </div>
      <Card>
        <CardTitle sub="Beneficiary receives the vesting NFT">Create vesting</CardTitle>
        <div className="space-y-5">
          <Field label="Beneficiary" value={beneficiary} onChange={setBeneficiary} placeholder="0x…" />
          <Field label="Token address" value={token} onChange={setToken} placeholder="0x…" />
          <Field label="Total amount" value={amount} onChange={setAmount} placeholder="1000000" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Duration (days)" value={durationDays} onChange={setDurationDays} placeholder="365" />
            <Field label="Cliff (days, 0 = none)" value={cliffDays} onChange={setCliffDays} placeholder="90" />
          </div>
          <Btn
            full
            onClick={runVest}
            disabled={!validBeneficiary || parsed === 0n || !token || cliffSec > durationSec || busy}
          >
            {busy ? "Working…" : needsApproval ? "Approve & create vesting" : "Create vesting"}
          </Btn>
          {vestRcpt.isSuccess && <Msg text="Vesting NFT minted to beneficiary." />}
          {(vestTx.error || approveTx.error) && <Err error={vestTx.error || approveTx.error} />}
        </div>
      </Card>
    </>
  );
}
