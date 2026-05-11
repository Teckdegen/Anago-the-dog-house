import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { Send, CheckCircle2, LockKeyhole, Timer, Sprout, ArrowRight } from "lucide-react";
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import {
  TOKEN_LOCK_NFT_ABI,
  VESTING_NFT_ABI,
  STREAM_FARM_ABI,
} from "@/lib/web3/contracts";
import { useContractAddresses } from "@/lib/web3/hooks";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { formatAmount, shortAddr } from "@/lib/web3/format";

export const Route = createFileRoute("/transfer")({
  component: TransferPage,
  head: () => ({
    meta: [
      { title: "Transfer Positions — The Dog House" },
      {
        name: "description",
        content: "Transfer your lock, vesting, or farm positions to another address.",
      },
    ],
  }),
});

const TABS = [
  { key: "Locks",    label: "Locks",    icon: LockKeyhole },
  { key: "Vestings", label: "Vestings", icon: Timer       },
  { key: "Farms",    label: "Farms",    icon: Sprout      },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const now = () => Math.floor(Date.now() / 1000);

/** Returns true if a position is still "active" and can be transferred */
function isActive(tab: TabKey, data: any): boolean {
  if (!data) return false;
  if (tab === "Locks") {
    // active = not withdrawn AND still locked (unlock time in the future)
    if (data.withdrawn) return false;
    const unlockTime = Number(data.unlockTime ?? data.unlockAt ?? 0);
    return unlockTime > now();
  }
  if (tab === "Vestings") {
    // active = not revoked AND not fully claimed
    if (data.revoked) return false;
    const total = BigInt(data.totalAmount ?? 0);
    const claimed = BigInt(data.claimed ?? 0);
    return claimed < total;
  }
  // Farms — all staked positions are active (unstaking removes the NFT)
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

function TransferPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("Locks");
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { address } = useAccount();
  const { toast } = useToast();
  const contracts = useContractAddresses();

  const pendingRef = useRef<{ from: `0x${string}`; to: `0x${string}`; tokenId: bigint } | null>(null);

  const isLock    = activeTab === "Locks";
  const isVesting = activeTab === "Vestings";
  const isFarm    = activeTab === "Farms";

  const contractAddress = isLock
    ? contracts.tokenLock
    : isVesting
    ? contracts.vestingNFT
    : contracts.streamFarm;

  const abi = isLock
    ? TOKEN_LOCK_NFT_ABI
    : isVesting
    ? VESTING_NFT_ABI
    : STREAM_FARM_ABI;

  const listFn   = isLock ? "locksOf"   : isVesting ? "vestingsOf"  : "positionsOf";
  const detailFn = isLock ? "getLock"   : isVesting ? "getVesting"  : "getPosition";

  // 1. Fetch user's token IDs
  const idsQ = useReadContracts({
    contracts: [{ address: contractAddress, abi: abi as any, functionName: listFn, args: address ? [address] : undefined }],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const tokenIds = (idsQ.data?.[0]?.result as bigint[] | undefined) ?? [];

  // 2. Fetch details for each position
  const detailsQ = useReadContracts({
    contracts: tokenIds.map((id) => ({
      address: contractAddress, abi: abi as any, functionName: detailFn, args: [id] as const,
    })),
    query: { enabled: tokenIds.length > 0, refetchInterval: 10_000 },
  });

  // 3. Build positions, filter to active only
  const allPositions = useMemo(() => {
    if (!detailsQ.data) return [];
    return tokenIds.map((tokenId, i) => ({ tokenId, data: detailsQ.data[i]?.result }));
  }, [tokenIds, detailsQ.data]);

  const positions = useMemo(
    () => allPositions.filter((p) => isActive(activeTab, p.data)),
    [allPositions, activeTab],
  );

  // 4. Token metadata
  const tokenAddresses = useMemo(() => {
    if (isFarm) return [];
    return [...new Set(positions.map((p) => (p.data as any)?.token as `0x${string}`).filter(Boolean))];
  }, [positions, isFarm]);

  const farmPoolIds = useMemo(() => {
    if (!isFarm) return [];
    return positions.map((p) => (p.data as any)?.[0] as bigint | undefined).filter(Boolean) as bigint[];
  }, [positions, isFarm]);

  const poolInfoQ = useReadContracts({
    contracts: farmPoolIds.map((poolId) => ({
      address: contractAddress, abi: abi as any, functionName: "getPoolInfo", args: [poolId] as const,
    })),
    query: { enabled: isFarm && farmPoolIds.length > 0, refetchInterval: 10_000 },
  });

  const farmStakeTokens = useMemo(() => {
    if (!isFarm || !poolInfoQ.data) return [] as (`0x${string}` | undefined)[];
    return poolInfoQ.data.map((r) => (r?.result as any)?.stakeToken as `0x${string}` | undefined);
  }, [isFarm, poolInfoQ.data]);

  const allTokenAddrs = useMemo(() => {
    const all = isFarm ? (farmStakeTokens.filter(Boolean) as `0x${string}`[]) : tokenAddresses;
    return [...new Set(all)];
  }, [isFarm, farmStakeTokens, tokenAddresses]);

  const tokenMetaQ = useReadContracts({
    contracts: allTokenAddrs.flatMap((t) => [
      { address: t, abi: ERC20_ABI, functionName: "symbol" as const },
      { address: t, abi: ERC20_ABI, functionName: "decimals" as const },
    ]),
    query: { enabled: allTokenAddrs.length > 0, refetchInterval: 10_000 },
  });

  const tokenMeta = useMemo(() => {
    const map: Record<string, { symbol: string; decimals: number }> = {};
    allTokenAddrs.forEach((t, i) => {
      const sym = tokenMetaQ.data?.[i * 2]?.result as string | undefined;
      const dec = tokenMetaQ.data?.[i * 2 + 1]?.result as number | undefined;
      if (sym) map[t.toLowerCase()] = { symbol: sym, decimals: dec ?? 18 };
    });
    return map;
  }, [allTokenAddrs, tokenMetaQ.data]);

  // 5. Transfer tx
  const transferTx  = useWriteContract();
  const transferRcpt = useWaitForTransactionReceipt({ hash: transferTx.data });

  const handleTransfer = () => {
    if (!selectedTokenId || !address || !isValidAddress) return;
    const to = recipientAddress as `0x${string}`;
    pendingRef.current = { from: address, to, tokenId: selectedTokenId };
    transferTx.writeContract({
      address: contractAddress,
      abi: abi as any,
      functionName: "transferFrom",
      args: [address, to, selectedTokenId],
    });
  };

  if (transferRcpt.isSuccess && !confirmed && pendingRef.current) {
    setConfirmed(true);
    toast("success", "Position transferred", `Sent to ${shortAddr(pendingRef.current.to)}`);
  }

  const selectedPos   = positions.find((p) => p.tokenId === selectedTokenId);
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(recipientAddress);
  const isSelf        = recipientAddress.toLowerCase() === address?.toLowerCase();
  const canTransfer   = !!selectedTokenId && isValidAddress && !isSelf && !transferTx.isPending && !transferRcpt.isLoading;

  const resetForm = () => {
    setConfirmed(false);
    setSelectedTokenId(null);
    setRecipientAddress("");
    transferTx.reset();
    pendingRef.current = null;
  };

  return (
    <AppShell>
      <div className="max-w-[680px] mx-auto px-5 sm:px-8 pt-8 pb-24">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>
            Transfer Positions
          </h1>
          <p className="font-mono text-[10px] mt-1.5 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
            Transfer your NFT positions — locks, vestings, or farm stakes — to any address
          </p>
        </div>

        {!address ? (
          <EmptyState title="Wallet not connected" sub="Connect your wallet to transfer positions." />
        ) : confirmed ? (
          <SuccessState onDone={resetForm} recipient={recipientAddress} />
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.03)" }}
          >
            {/* ── Tab bar ── */}
            <div className="p-4 pb-0">
              <div
                className="flex items-center gap-0.5 p-1 rounded-full"
                style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.18)" }}
              >
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => { setActiveTab(key); setSelectedTokenId(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition"
                    style={
                      activeTab === key
                        ? { background: "rgba(155,127,212,0.35)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }
                        : { color: "rgba(196,168,240,0.45)" }
                    }
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Position list ── */}
            <div className="p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] mb-3" style={{ color: "rgba(196,168,240,0.4)" }}>
                Select position
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.2)" }}>
                {idsQ.isLoading ? (
                  <LoadingRows />
                ) : positions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <p className="font-grotesk uppercase text-[12px] tracking-wider" style={{ color: "rgba(237,224,255,0.7)" }}>
                      No active {tabLabel(activeTab)}
                    </p>
                    <p className="font-mono text-[9px] mt-1.5 max-w-[240px]" style={{ color: "rgba(196,168,240,0.4)" }}>
                      {activeTab === "Locks"
                        ? "Only locked (not yet unlocked) positions can be transferred."
                        : activeTab === "Vestings"
                        ? "Only active (not fully claimed) vestings can be transferred."
                        : "Stake in a farm to see transferable positions."}
                    </p>
                  </div>
                ) : (
                  positions.map((pos, i) => {
                    const d = pos.data as any;
                    const stakeToken = isFarm ? farmStakeTokens[i] : (d?.token as `0x${string}` | undefined);
                    const meta = stakeToken ? tokenMeta[stakeToken.toLowerCase()] : undefined;
                    const symbol   = meta?.symbol ?? "???";
                    const decimals = meta?.decimals ?? 18;
                    const amount   = isLock ? d?.amount : isVesting ? d?.totalAmount : d?.[1];

                    return (
                      <PositionRow
                        key={pos.tokenId.toString()}
                        tokenId={pos.tokenId}
                        symbol={symbol}
                        decimals={decimals}
                        amount={amount}
                        type={activeTab}
                        isSelected={selectedTokenId === pos.tokenId}
                        onSelect={() => setSelectedTokenId(pos.tokenId === selectedTokenId ? null : pos.tokenId)}
                        isLast={i === positions.length - 1}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Divider ── */}
            <div style={{ height: "1px", background: "rgba(155,127,212,0.15)", margin: "0 16px" }} />

            {/* ── Recipient + Send (always visible below) ── */}
            <div className="p-4 space-y-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: "rgba(196,168,240,0.4)" }}>
                Recipient address
              </p>

              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value.trim())}
                placeholder="0x..."
                className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[12px] outline-none transition placeholder:text-[rgba(155,127,212,0.25)]"
                style={{
                  color: "#EDE0FF",
                  border: `1px solid ${recipientAddress && !isValidAddress ? "rgba(255,100,100,0.5)" : "rgba(155,127,212,0.28)"}`,
                  background: "rgba(155,127,212,0.06)",
                }}
              />
              {recipientAddress && !isValidAddress && (
                <p className="font-mono text-[9px] -mt-2" style={{ color: "rgba(255,120,120,0.9)" }}>Invalid address format</p>
              )}
              {isSelf && isValidAddress && (
                <p className="font-mono text-[9px] -mt-2" style={{ color: "rgba(255,180,50,0.9)" }}>Cannot transfer to yourself</p>
              )}

              {/* Selected position summary — shown when something is selected */}
              {selectedPos && (() => {
                const d = selectedPos.data as any;
                const stakeToken = isFarm
                  ? farmStakeTokens[positions.indexOf(selectedPos)]
                  : (d?.token as `0x${string}` | undefined);
                const meta     = stakeToken ? tokenMeta[stakeToken.toLowerCase()] : undefined;
                const symbol   = meta?.symbol ?? "???";
                const decimals = meta?.decimals ?? 18;
                const amount   = isLock ? d?.amount : isVesting ? d?.totalAmount : d?.[1];
                return (
                  <div
                    className="rounded-xl p-4 space-y-2"
                    style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}
                  >
                    <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.4)" }}>
                      Transferring
                    </p>
                    {([
                      ["Type",   activeTab],
                      ["Token",  symbol],
                      ["Amount", formatAmount(amount, decimals)],
                      ["NFT ID", `#${selectedPos.tokenId.toString()}`],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.4)" }}>{k}</span>
                        <span className="font-grotesk text-[12px]" style={{ color: "rgba(237,224,255,0.9)" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Transfer button */}
              <button
                onClick={handleTransfer}
                disabled={!canTransfer}
                className="w-full rounded-xl py-3.5 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-35 active:scale-[0.99] flex items-center justify-center gap-2"
                style={{ background: "rgba(155,127,212,0.22)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
              >
                {transferTx.isPending || transferRcpt.isLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
                    Transferring…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" strokeWidth={1.5} />
                    {selectedTokenId ? "Transfer Position" : "Select a position above"}
                  </>
                )}
              </button>

              {transferTx.error && (
                <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
                  {(transferTx.error as any)?.shortMessage ?? transferTx.error.message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function tabLabel(tab: TabKey) {
  return tab === "Locks" ? "locks" : tab === "Vestings" ? "vestings" : "farm positions";
}

function PositionRow({
  tokenId, symbol, decimals, amount, type, isSelected, onSelect, isLast,
}: {
  tokenId: bigint; symbol: string; decimals: number; amount: bigint | undefined;
  type: TabKey; isSelected: boolean; onSelect: () => void; isLast: boolean;
}) {
  const Icon = type === "Locks" ? LockKeyhole : type === "Vestings" ? Timer : Sprout;
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-4 py-3 hover:bg-[rgba(155,127,212,0.05)] transition-colors"
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(155,127,212,0.1)",
        background: isSelected ? "rgba(155,127,212,0.13)" : "transparent",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(155,127,212,0.14)", border: "1px solid rgba(155,127,212,0.28)" }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: "rgba(196,168,240,0.8)" }} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="font-grotesk uppercase text-[12px] tracking-wider truncate" style={{ color: "#EDE0FF" }}>
              {symbol}
            </p>
            <p className="font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.4)" }}>
              #{tokenId.toString()} · {formatAmount(amount, decimals)}
            </p>
          </div>
        </div>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all"
          style={{
            background: isSelected ? "#9B7FD4" : "rgba(155,127,212,0.1)",
            border: isSelected ? "none" : "1px solid rgba(155,127,212,0.3)",
          }}
        >
          {isSelected && <CheckCircle2 className="w-3 h-3" style={{ color: "#0D0B14" }} strokeWidth={3} />}
        </div>
      </div>
    </button>
  );
}

function LoadingRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-4 py-3 animate-pulse" style={{ borderBottom: i < 2 ? "1px solid rgba(155,127,212,0.1)" : "none" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full" style={{ background: "rgba(155,127,212,0.12)" }} />
            <div className="space-y-1.5">
              <div className="h-3 w-20 rounded" style={{ background: "rgba(155,127,212,0.12)" }} />
              <div className="h-2 w-32 rounded" style={{ background: "rgba(155,127,212,0.08)" }} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(155,127,212,0.1)", border: "1px solid rgba(155,127,212,0.25)" }}>
        <Send className="w-4 h-4" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
      </div>
      <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>{title}</p>
      <p className="font-mono text-[10px] mt-1.5 max-w-[260px]" style={{ color: "rgba(196,168,240,0.5)" }}>{sub}</p>
    </div>
  );
}

function SuccessState({ onDone, recipient }: { onDone: () => void; recipient: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-10">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(155,127,212,0.18)", border: "1px solid rgba(155,127,212,0.5)" }}>
        <CheckCircle2 className="w-7 h-7" style={{ color: "#C4A8F0" }} strokeWidth={1.5} />
      </div>
      <p className="font-grotesk uppercase tracking-wider text-[18px] mb-2" style={{ color: "#EDE0FF" }}>Position Transferred</p>
      <p className="font-mono text-[11px] max-w-[320px] mx-auto leading-relaxed" style={{ color: "rgba(196,168,240,0.6)" }}>
        Successfully sent to <span style={{ color: "#C4A8F0" }}>{shortAddr(recipient as `0x${string}`)}</span>
      </p>
      <button
        onClick={onDone}
        className="mt-7 px-6 py-3 rounded-xl font-grotesk text-[12px] uppercase tracking-wider transition active:scale-[0.99]"
        style={{ background: "rgba(155,127,212,0.18)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.45)" }}
      >
        Transfer Another
      </button>
    </div>
  );
}
