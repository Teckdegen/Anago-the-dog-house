"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useState } from "react";
import {
  STREAM_FARM_ADDRESS,
  TOKEN_LOCK_ADDRESS,
  VESTING_NFT_ADDRESS,
  OTC_MARKET_ADDRESS,
  STREAM_FARM_ABI,
  TOKEN_LOCK_ABI,
  VESTING_NFT_ABI,
} from "@/lib/contracts";
import { ClaimFeesSection } from "./ClaimFeesSection";
import {
  DEFAULT_CHAIN_ID,
  EXPLORER_BASE,
  MAIN_APP_URL,
} from "@/lib/deployments";
import { admin } from "@/lib/theme";
import { Card, CardTitle, Field, Btn, Msg, Err, StatCard } from "./adminUi";

type NavKey = "overview" | "operators" | "admins" | "fees";

const NAV: { key: NavKey; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "◆" },
  { key: "fees", label: "Claim fees", icon: "◎" },
  { key: "operators", label: "Farm creators", icon: "◉" },
  { key: "admins", label: "Admins", icon: "⚙" },
];

export default function AdminDashboard() {
  const { address, isConnected } = useAccount();

  const isAdminQ = useReadContract({
    address: STREAM_FARM_ADDRESS,
    abi: STREAM_FARM_ABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const ownerQ = useReadContract({
    address: STREAM_FARM_ADDRESS,
    abi: STREAM_FARM_ABI,
    functionName: "owner",
    query: { enabled: !!address, refetchInterval: 15_000 },
  });
  const isAdmin = isAdminQ.data === true;
  const streamOwner = ownerQ.data as string | undefined;
  const isDeployer =
    !!address && !!streamOwner && streamOwner.toLowerCase() === address.toLowerCase();
  const canAccess = isAdmin || isDeployer;
  const roleResolved = !address || (isAdminQ.isFetched && ownerQ.isFetched);

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
              â—†
            </div>
            <div>
              <p className="font-grotesk text-[15px] font-semibold" style={{ color: admin.text }}>
                Dog House
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: admin.textDim }}>
                StreamFarm Admin
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
            Monad Â· on-chain management
          </p>
          <ConnectButton />
        </header>

        <main className="flex-1 px-5 sm:px-8 py-6 sm:py-8 max-w-[1200px]">
          {!isConnected ? (
            <EmptyState title="Connect wallet" sub="Connect an admin wallet to manage protocol contracts." />
          ) : !roleResolved || isAdminQ.isLoading ? (
            <div className="flex items-center justify-center py-32">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: admin.border, borderTopColor: admin.purple }}
              />
            </div>
          ) : !canAccess ? (
            <AccessDenied address={address} />
          ) : (
            <Dashboard isDeployer={isDeployer} isAdmin={isAdmin} />
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
        sub={`${address?.slice(0, 6)}â€¦${address?.slice(-4)} is not a StreamFarm admin.`}
      />
      <Card>
        <CardTitle sub="Protocol admins only">How to get access</CardTitle>
        <ol className="font-mono text-[11px] space-y-2 list-decimal list-inside" style={{ color: admin.textMuted }}>
          <li>Connect the StreamFarm owner wallet, or</li>
          <li>Ask the owner to add you under Admins in this panel.</li>
        </ol>
      </Card>
    </div>
  );
}

function Dashboard({ isDeployer, isAdmin }: { isDeployer: boolean; isAdmin: boolean }) {
  const { address } = useAccount();
  const [nav, setNav] = useState<NavKey>("overview");

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

  const visibleNav = NAV.filter((n) => {
    if (n.key === "admins") return isOwner;
    if (n.key === "fees") return isDeployer;
    if (n.key === "operators") return isAdmin;
    return true;
  });

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
                value={isOwner ? "Owner" : isAdmin ? "Admin" : "Deployer"}
                sub={isOwner ? "Whitelist + admins + fees" : isAdmin ? "Whitelist creators" : "Claim fees only"}
                accent
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <ContractsPanel />
              <QuickLinksPanel />
            </div>
            <Card>
              <CardTitle sub="Creators use the public app">Farm management</CardTitle>
              <p className="font-mono text-[11px] leading-relaxed" style={{ color: admin.textMuted }}>
                Whitelist wallets under Farm creators so they can launch and manage pools on the main app
                (/farm â†’ Create &amp; Manage). This panel only handles whitelist and protocol admins.
              </p>
            </Card>
          </>
        )}

        {nav === "operators" && <OperatorsSection />}
        {nav === "fees" && <ClaimFeesSection />}
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
    { label: "OTC Market", addr: OTC_MARKET_ADDRESS },
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
              {r.addr.slice(0, 8)}â€¦{r.addr.slice(-4)}
            </span>
          </a>
        ))}
      </div>
    </Card>
  );
}

function QuickLinksPanel() {
  const links = [
    { label: "Public app Â· Farm", href: `${MAIN_APP_URL}/farm` },
    { label: "Public app Â· Lock", href: `${MAIN_APP_URL}/lock` },
    { label: "Public app Â· Vesting", href: `${MAIN_APP_URL}/vesting` },
    { label: "Public app Â· CLMM", href: `${MAIN_APP_URL}/clmm` },
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
            {l.label} â†’
          </a>
        ))}
      </div>
    </Card>
  );
}

function OperatorsSection() {
  const [addr, setAddr] = useState("");
  const allowTx = useWriteContract();
  const allowRcpt = useWaitForTransactionReceipt({ hash: allowTx.data });
  const revokeTx = useWriteContract();
  const revokeRcpt = useWaitForTransactionReceipt({ hash: revokeTx.data });

  const checkAddr = (addr || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const operatorQ = useReadContract({
    address: STREAM_FARM_ADDRESS,
    abi: STREAM_FARM_ABI,
    functionName: "farmOperators",
    args: [checkAddr],
    query: { enabled: addr.length === 42, refetchInterval: 5_000 },
  });
  const isWhitelisted = operatorQ.data === true;

  return (
    <>
      <div>
        <h1 className="font-grotesk text-[26px] font-semibold" style={{ color: admin.text }}>
          Farm creators
        </h1>
        <p className="font-mono text-[11px] mt-1" style={{ color: admin.textMuted }}>
          Whitelist wallets that may create and manage their own StreamFarm pools on the public app.
        </p>
      </div>
      <Card>
        <CardTitle sub="setFarmOperator on StreamFarm">Whitelist wallet</CardTitle>
        <div className="space-y-5">
          <Field label="Wallet address" value={addr} onChange={setAddr} placeholder="0x…" />
          {addr.length === 42 && (
            <p className="font-mono text-[11px]" style={{ color: isWhitelisted ? admin.green : admin.textMuted }}>
              {operatorQ.isLoading ? "Checking…" : isWhitelisted ? "Currently whitelisted" : "Not whitelisted"}
            </p>
          )}
          <div className="flex gap-3">
            <Btn
              full
              onClick={() => {
                if (addr)
                  allowTx.writeContract({
                    address: STREAM_FARM_ADDRESS,
                    abi: STREAM_FARM_ABI,
                    functionName: "setFarmOperator",
                    args: [addr as `0x${string}`, true],
                  });
              }}
              disabled={!addr || addr.length !== 42 || allowTx.isPending || allowRcpt.isLoading}
            >
              {allowTx.isPending || allowRcpt.isLoading ? "…" : "Whitelist"}
            </Btn>
            <Btn
              full
              variant="danger"
              onClick={() => {
                if (addr)
                  revokeTx.writeContract({
                    address: STREAM_FARM_ADDRESS,
                    abi: STREAM_FARM_ABI,
                    functionName: "setFarmOperator",
                    args: [addr as `0x${string}`, false],
                  });
              }}
              disabled={!addr || addr.length !== 42 || revokeTx.isPending || revokeRcpt.isLoading}
            >
              {revokeTx.isPending || revokeRcpt.isLoading ? "…" : "Revoke"}
            </Btn>
          </div>
          {allowRcpt.isSuccess && <Msg text="Wallet whitelisted." />}
          {revokeRcpt.isSuccess && <Msg text="Whitelist revoked." />}
          {(allowTx.error || revokeTx.error) && <Err error={allowTx.error || revokeTx.error} />}
        </div>
      </Card>
    </>
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
