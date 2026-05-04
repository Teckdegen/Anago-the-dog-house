import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search, LockKeyhole, Trophy } from "lucide-react";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { CreateLockDialog } from "@/components/CreateLockDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SuccessModal } from "@/components/SuccessModal";
import { NewActionCTA } from "@/components/NewActionCTA";
import {
  useUserLocks,
  useAllLocks,
  useLockLeaderboards,
  useContractAddresses,
} from "@/lib/web3/hooks";
import { TOKEN_LOCK_ABI } from "@/lib/web3/contracts";
import { ERC20_ABI, getTokenList } from "@/lib/web3/tokens";
import { formatAmount, formatDate, shortAddr, timeUntil } from "@/lib/web3/format";
import { useChainId } from "wagmi";

export const Route = createFileRoute("/lock")({
  component: LockPage,
  head: () => ({
    meta: [
      { title: "Token Lock — The Dog House" },
      { name: "description", content: "Lock tokens with confidence on Monad." },
    ],
  }),
});

const ACCENT = "#9B7FD4";
const ACCENT_DIM = "rgba(155,127,212,0.55)";
const TABS = [
  "All Locks",
  "My Locks",
  "Unlocking Soon",
  "Token Leaderboard",
  "User Leaderboard",
] as const;
type Tab = (typeof TABS)[number];

const THREE_DAYS = 3 * 86400;

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, { bg: string; color: string }> = {
    1: { bg: "rgba(255,215,0,0.15)", color: "#FFD700" },
    2: { bg: "rgba(192,192,192,0.15)", color: "#C0C0C0" },
    3: { bg: "rgba(205,127,50,0.15)", color: "#CD7F32" },
  };
  const s = styles[rank] ?? { bg: "rgba(155,127,212,0.12)", color: "rgba(196,168,240,0.6)" };
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full font-grotesk text-[10px]"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}55` }}
    >
      {rank}
    </span>
  );
}

function useTokenMeta() {
  const chainId = useChainId();
  const list = getTokenList(chainId);
  return (addr: string) =>
    list.find((t) => t.address.toLowerCase() === addr.toLowerCase());
}

function LockRow({
  lockId,
  token,
  owner,
  amount,
  unlockAt,
  withdrawn,
  isLast,
}: {
  lockId: bigint;
  token: `0x${string}`;
  owner: `0x${string}`;
  amount: bigint;
  unlockAt: bigint;
  withdrawn: boolean;
  isLast: boolean;
}) {
  const staticMeta = useTokenMeta()(token);
  const { tokenLock } = useContractAddresses();
  const { address } = useAccount();
  const unlocked = Number(unlockAt) <= Math.floor(Date.now() / 1000);
  const isOwner = !!address && address.toLowerCase() === owner.toLowerCase();

  const onChain = useReadContracts({
    allowFailure: true,
    contracts: !staticMeta ? [
      { address: token, abi: ERC20_ABI, functionName: "symbol" as const },
      { address: token, abi: ERC20_ABI, functionName: "decimals" as const },
    ] : [],
    query: { enabled: !staticMeta },
  });
  const symbol = staticMeta?.symbol ?? (onChain.data?.[0]?.result as string | undefined) ?? `${token.slice(0, 6)}…`;
  const decimals = staticMeta?.decimals ?? (onChain.data?.[1]?.result as number | undefined) ?? 18;

  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });
  const [localWithdrawn, setLocalWithdrawn] = useState(withdrawn);
  const [successOpen, setSuccessOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (rcpt.isSuccess && !localWithdrawn) {
      setLocalWithdrawn(true);
      setSuccessOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcpt.isSuccess]);

  const doWithdraw = () => {
    tx.writeContract({
      address: tokenLock,
      abi: TOKEN_LOCK_ABI,
      functionName: "withdraw",
      args: [lockId],
    });
  };

  return (
    <>
      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Token Lock"
        heading="Tokens Withdrawn"
        subtext="Your locked tokens have been returned to your wallet."
        rows={[
          { label: "Token", value: symbol },
          { label: "Amount", value: `${formatAmount(amount, decimals)} ${symbol}` },
          { label: "Lock ID", value: `#${lockId.toString()}` },
        ]}
      />

      <div
        className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] grid-cols-2 gap-2 px-5 py-3.5 items-center hover:bg-[rgba(155,127,212,0.04)] transition-colors"
        style={{ borderBottom: isLast ? "none" : "1px solid rgba(155,127,212,0.15)" }}
      >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center font-grotesk text-[10px]"
          style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.35)", color: "rgba(196,168,240,0.85)" }}
        >
          {symbol[0]}
        </div>
        <div className="min-w-0">
          <p className="font-grotesk uppercase text-[12px] tracking-wider truncate" style={{ color: "#EDE0FF" }}>{symbol}</p>
          <p className="font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.5)" }}>
            #{lockId.toString()} · {shortAddr(owner)}{isOwner ? " (you)" : ""}
          </p>
        </div>
      </div>
      <div className="text-right font-grotesk text-[12px] tabular-nums" style={{ color: "rgba(237,224,255,0.9)" }}>
        {formatAmount(amount, decimals)}
      </div>
      <div className="hidden sm:block text-right font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.4)" }}>—</div>
      <div className="hidden sm:block text-right font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.6)" }}>
        {formatDate(unlockAt)}
      </div>
      <div className="hidden sm:block text-right font-mono text-[10px]" style={{ color: unlocked ? "#9be8a4" : "rgba(196,168,240,0.6)" }}>
        {timeUntil(unlockAt)}
      </div>
      <div className="text-right">
        {localWithdrawn ? (
          <span className="font-mono text-[9px] uppercase" style={{ color: "rgba(155,127,212,0.45)" }}>Withdrawn</span>
        ) : unlocked && isOwner ? (
          <button
            onClick={doWithdraw}
            disabled={tx.isPending || rcpt.isLoading}
            className="px-3 py-1 rounded-full font-grotesk text-[10px] uppercase tracking-wider disabled:opacity-50"
            style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" }}
          >
            {tx.isPending || rcpt.isLoading ? "…" : "Withdraw"}
          </button>
        ) : (
          <span className="font-mono text-[9px] uppercase" style={{ color: "rgba(155,127,212,0.45)" }}>
            {unlocked ? "Unlocked" : "Locked"}
          </span>
        )}
      </div>
    </div>
    </>
  );
}

function TokenLeaderboard({
  tokenLb,
  tokenMeta,
}: {
  tokenLb: { address: `0x${string}`; amount: bigint }[];
  tokenMeta: (addr: string) => { symbol?: string; decimals?: number } | undefined;
}) {
  const reads = useReadContracts({
    allowFailure: true,
    contracts: tokenLb.flatMap((row) => [
      { address: row.address, abi: ERC20_ABI, functionName: "symbol" as const },
      { address: row.address, abi: ERC20_ABI, functionName: "decimals" as const },
      { address: row.address, abi: ERC20_ABI, functionName: "totalSupply" as const },
    ]),
    query: { enabled: tokenLb.length > 0 },
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
      <div className="hidden sm:grid px-5 py-3 text-[9px] font-mono uppercase tracking-[0.2em]"
        style={{ gridTemplateColumns: "40px 2fr 1fr 1fr", borderBottom: "1px solid rgba(155,127,212,0.2)", background: "rgba(155,127,212,0.08)", color: "rgba(196,168,240,0.6)" }}>
        <div>#</div>
        <div>Token</div>
        <div className="text-right">Total Locked</div>
        <div className="text-right">% of Supply</div>
      </div>
      {tokenLb.length === 0 ? (
        <EmptyLeaderboard label="No tokens locked yet" />
      ) : (
        tokenLb.map((row, i) => {
          const o = i * 3;
          const staticMeta = tokenMeta(row.address);
          const sym = staticMeta?.symbol ?? (reads.data?.[o]?.result as string | undefined) ?? `${row.address.slice(0, 6)}…`;
          const dec = staticMeta?.decimals ?? (reads.data?.[o + 1]?.result as number | undefined) ?? 18;
          const supply = reads.data?.[o + 2]?.result as bigint | undefined;
          const pct = supply && supply > 0n
            ? Number((row.amount * 100_000n) / supply) / 1000
            : null;

          return (
            <div key={row.address}
              className="grid sm:grid-cols-[40px_2fr_1fr_1fr] grid-cols-[40px_1fr_1fr] px-5 py-3.5 items-center hover:bg-[rgba(155,127,212,0.04)] transition-colors"
              style={{ borderBottom: i < tokenLb.length - 1 ? "1px solid rgba(155,127,212,0.15)" : "none" }}>
              <RankBadge rank={i + 1} />
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-grotesk text-[10px] shrink-0"
                  style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.35)", color: "rgba(196,168,240,0.85)" }}>
                  {sym[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-grotesk uppercase text-[12px] tracking-wider" style={{ color: "#EDE0FF" }}>{sym}</p>
                  <p className="font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.45)" }}>{row.address}</p>
                </div>
              </div>
              <div className="text-right font-grotesk text-[12px] tabular-nums" style={{ color: "rgba(237,224,255,0.9)" }}>
                {formatAmount(row.amount, dec)} <span className="font-mono text-[9px]" style={{ color: "rgba(196,168,240,0.45)" }}>{sym}</span>
              </div>
              <div className="hidden sm:flex items-center justify-end gap-2">
                {pct !== null ? (
                  <>
                    <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "rgba(155,127,212,0.2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: ACCENT }} />
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: ACCENT_DIM }}>
                      {pct.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span className="font-mono text-[10px]" style={{ color: "rgba(155,127,212,0.35)" }}>—</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function UserLeaderboard({
  userLb,
  allLocks,
  address,
  tokenMeta,
}: {
  userLb: { address: `0x${string}`; amount: bigint }[];
  allLocks: import("@/lib/web3/hooks").LockView[];
  address: `0x${string}` | undefined;
  tokenMeta: (addr: string) => { symbol?: string; decimals?: number } | undefined;
}) {
  const uniqueTokens = useMemo(() => {
    const set = new Set<`0x${string}`>();
    allLocks.forEach((l) => set.add(l.token));
    return Array.from(set);
  }, [allLocks]);

  const tokenReads = useReadContracts({
    allowFailure: true,
    contracts: uniqueTokens.flatMap((t) => [
      { address: t, abi: ERC20_ABI, functionName: "symbol" as const },
      { address: t, abi: ERC20_ABI, functionName: "decimals" as const },
    ]),
    query: { enabled: uniqueTokens.length > 0 },
  });

  const tokenInfo = useMemo(() => {
    const map: Record<string, { symbol: string; decimals: number }> = {};
    uniqueTokens.forEach((t, i) => {
      const staticMeta = tokenMeta(t);
      const sym = staticMeta?.symbol ?? (tokenReads.data?.[i * 2]?.result as string | undefined) ?? t.slice(0, 6);
      const dec = staticMeta?.decimals ?? (tokenReads.data?.[i * 2 + 1]?.result as number | undefined) ?? 18;
      map[t.toLowerCase()] = { symbol: sym, decimals: dec };
    });
    return map;
  }, [uniqueTokens, tokenReads.data, tokenMeta]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
      <div className="hidden sm:grid px-5 py-3 text-[9px] font-mono uppercase tracking-[0.2em]"
        style={{ gridTemplateColumns: "40px 2fr 1fr 1fr", borderBottom: "1px solid rgba(155,127,212,0.2)", background: "rgba(155,127,212,0.08)", color: "rgba(196,168,240,0.6)" }}>
        <div>#</div>
        <div>Locker</div>
        <div className="text-right">Locks</div>
        <div className="text-right">Holdings</div>
      </div>
      {userLb.length === 0 ? (
        <EmptyLeaderboard label="No lockers yet" />
      ) : (
        userLb.map((row, i) => {
          const isMe = address?.toLowerCase() === row.address.toLowerCase();
          const userLocks = allLocks.filter((l) => l.owner.toLowerCase() === row.address.toLowerCase() && !l.withdrawn);

          const byToken: Record<string, bigint> = {};
          userLocks.forEach((l) => {
            const key = l.token.toLowerCase();
            byToken[key] = (byToken[key] ?? 0n) + l.amount;
          });
          const tokenEntries = Object.entries(byToken);

          return (
            <div key={row.address}
              className="grid sm:grid-cols-[40px_2fr_1fr_1fr] grid-cols-[40px_1fr_1fr] px-5 py-3.5 items-start hover:bg-[rgba(155,127,212,0.04)] transition-colors"
              style={{ borderBottom: i < userLb.length - 1 ? "1px solid rgba(155,127,212,0.15)" : "none" }}>
              <RankBadge rank={i + 1} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-[11px] truncate" style={{ color: "#EDE0FF" }}>{shortAddr(row.address)}</p>
                  {isMe && (
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(155,127,212,0.2)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.4)" }}>
                      you
                    </span>
                  )}
                </div>
                <p className="font-mono text-[9px] mt-0.5 truncate" style={{ color: "rgba(196,168,240,0.4)" }}>{row.address}</p>
              </div>
              <div className="text-right font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.65)" }}>
                {userLocks.length}
              </div>
              <div className="text-right space-y-0.5">
                {tokenEntries.length === 0 ? (
                  <p className="font-mono text-[10px]" style={{ color: "rgba(155,127,212,0.4)" }}>—</p>
                ) : tokenEntries.map(([tok, amt]) => {
                  const info = tokenInfo[tok] ?? { symbol: tok.slice(0, 6), decimals: 18 };
                  return (
                    <p key={tok} className="font-grotesk text-[12px] tabular-nums" style={{ color: "rgba(237,224,255,0.9)" }}>
                      {formatAmount(amt, info.decimals)}{" "}
                      <span className="font-mono text-[9px]" style={{ color: "rgba(196,168,240,0.5)" }}>{info.symbol}</span>
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function LockPage() {
  const [activeTab, setActiveTab] = useState<Tab>("All Locks");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { address } = useAccount();
  const { locks } = useUserLocks();
  const { locks: allLocks } = useAllLocks();
  const { tokens: tokenLb, users: userLb } = useLockLeaderboards();
  const tokenMeta = useTokenMeta();

  const filteredMyLocks = useMemo(() => {
    let l = locks;
    if (search) {
      const s = search.toLowerCase();
      l = l.filter(
        (x) =>
          x.token.toLowerCase().includes(s) ||
          (tokenMeta(x.token)?.symbol.toLowerCase() ?? "").includes(s),
      );
    }
    return l;
  }, [locks, search, tokenMeta]);

  const unlockingSoon = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return locks.filter(
      (l) => !l.withdrawn && Number(l.unlockAt) - now <= THREE_DAYS && Number(l.unlockAt) > now,
    );
  }, [locks]);

  const showSearch =
    activeTab !== "Token Leaderboard" && activeTab !== "User Leaderboard";

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="flex items-center justify-between gap-3 mb-7">
          <div>
            <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>
              Token Lock
            </h1>
            <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
              Time-based locks · transparent on-chain unlock schedules
            </p>
          </div>
          {showSearch && <NewActionCTA label="New Lock" onClick={() => setShowCreate(true)} />}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div
            className="flex items-center gap-0.5 p-1 rounded-full overflow-x-auto max-w-full"
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
          {showSearch && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-full"
              style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search by token or address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent font-mono text-[11px] outline-none w-40 sm:w-56"
                style={{ color: "#EDE0FF" }}
              />
            </div>
          )}
        </div>

        {/* TOKEN LEADERBOARD */}
        {activeTab === "Token Leaderboard" && (
          <TokenLeaderboard tokenLb={tokenLb} tokenMeta={tokenMeta} />
        )}

        {/* USER LEADERBOARD */}
        {activeTab === "User Leaderboard" && (
          <UserLeaderboard userLb={userLb} allLocks={allLocks} address={address} tokenMeta={tokenMeta} />
        )}

        {/* MY LOCKS / UNLOCKING SOON / ALL */}
        {(activeTab === "All Locks" ||
          activeTab === "My Locks" ||
          activeTab === "Unlocking Soon") && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
            <div
              className="hidden sm:grid px-5 py-3 text-[9px] font-mono uppercase tracking-[0.2em]"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 100px",
                borderBottom: "1px solid rgba(155,127,212,0.2)",
                background: "rgba(155,127,212,0.08)",
                color: "rgba(196,168,240,0.6)",
              }}
            >
              <div>Token</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Value</div>
              <div className="text-right">Unlock Date</div>
              <div className="text-right">Time Left</div>
              <div />
            </div>

            {(() => {
              const rows =
                activeTab === "Unlocking Soon"
                  ? unlockingSoon
                  : activeTab === "My Locks"
                    ? filteredMyLocks
                    : allLocks.filter((l) => {
                        if (!search) return true;
                        const s = search.toLowerCase();
                        return (
                          l.token.toLowerCase().includes(s) ||
                          l.owner.toLowerCase().includes(s) ||
                          (tokenMeta(l.token)?.symbol.toLowerCase() ?? "").includes(s)
                        );
                      });
              if (activeTab !== "All Locks" && !address) {
                return (
                  <Empty
                    title="Wallet not connected"
                    sub="Connect your wallet to see your locks."
                  />
                );
              }
              if (rows.length === 0) {
                return (
                  <Empty
                    title={
                      activeTab === "Unlocking Soon"
                        ? "Nothing unlocking in the next 3 days"
                        : "No locks yet"
                    }
                    sub={
                      activeTab === "Unlocking Soon"
                        ? "Locks unlocking within 72 hours show up here."
                        : "Hit + New to create your first lock."
                    }
                  />
                );
              }
              return rows.map((l, i) => (
                <LockRow
                  key={l.id.toString()}
                  lockId={l.id}
                  token={l.token}
                  owner={l.owner}
                  amount={l.amount}
                  unlockAt={l.unlockAt}
                  withdrawn={l.withdrawn}
                  isLast={i === rows.length - 1}
                />
              ));
            })()}
          </div>
        )}
      </div>

      <CreateLockDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </AppShell>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "rgba(155,127,212,0.12)", border: "1px solid rgba(155,127,212,0.3)" }}
      >
        <LockKeyhole className="w-4 h-4" style={{ color: "rgba(196,168,240,0.6)" }} strokeWidth={1.5} />
      </div>
      <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>{title}</p>
      <p className="font-mono text-[10px] mt-1.5 max-w-[260px]" style={{ color: "rgba(196,168,240,0.55)" }}>
        {sub}
      </p>
    </div>
  );
}

function EmptyLeaderboard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Trophy className="w-8 h-8 mb-3" style={{ color: "rgba(155,127,212,0.45)" }} strokeWidth={1} />
      <p className="font-grotesk uppercase text-[12px] tracking-wider" style={{ color: "#EDE0FF" }}>{label}</p>
      <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.55)" }}>
        Leaderboard populates as tokens get locked.
      </p>
    </div>
  );
}
