import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Send, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { TOKEN_LOCK_NFT_ABI, VESTING_NFT_ABI } from "@/lib/web3/contracts";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { formatAmount, shortAddr } from "@/lib/web3/format";

export const Route = createFileRoute("/transfer")({
  component: TransferPage,
  head: () => ({
    meta: [
      { title: "Transfer Positions — The Dog House" },
      { name: "description", content: "Transfer your lock or vesting positions to another address." },
    ],
  }),
});

const TABS = ["Locks", "Vestings"] as const;
type Tab = (typeof TABS)[number];

// Contract Addresses
const TOKEN_LOCK_NFT = "0xe6A045525C053259e096d2c48973856D9f06143f" as `0x${string}`;
const VESTING_NFT = "0x2f0326D9eDDB98da0d05CfD7e7C94cbAEdacB206" as `0x${string}`;

function TransferPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Locks");
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { address } = useAccount();
  const { toast } = useToast();

  const isLockTab = activeTab === "Locks";
  const contractAddress = isLockTab ? TOKEN_LOCK_NFT : VESTING_NFT;
  const abi = isLockTab ? TOKEN_LOCK_NFT_ABI : VESTING_NFT_ABI;

  // Get user's token IDs
  const tokenIdsQuery = useReadContracts({
    contracts: [
      {
        address: contractAddress,
        abi,
        functionName: isLockTab ? "locksOf" : "vestingsOf",
        args: address ? [address] : undefined,
      },
    ],
    query: { enabled: !!address },
  });

  const tokenIds = (tokenIdsQuery.data?.[0]?.result as bigint[] | undefined) ?? [];

  // Get details for each position
  const detailsQuery = useReadContracts({
    contracts: tokenIds.flatMap((tokenId) => [
      {
        address: contractAddress,
        abi,
        functionName: isLockTab ? "getLock" : "getVesting",
        args: [tokenId] as const,
      },
      {
        address: contractAddress,
        abi,
        functionName: "ownerOf",
        args: [tokenId] as const,
      },
    ]),
    query: { enabled: tokenIds.length > 0 },
  });

  const positions = useMemo(() => {
    if (!detailsQuery.data) return [];
    return tokenIds.map((tokenId, i) => {
      const dataIndex = i * 2;
      const data = detailsQuery.data[dataIndex]?.result;
      const owner = detailsQuery.data[dataIndex + 1]?.result as `0x${string}` | undefined;
      return { tokenId, data, owner };
    });
  }, [tokenIds, detailsQuery.data]);

  // Get token metadata for each position
  const tokenAddresses = useMemo(() => {
    return positions.map((p) => {
      if (isLockTab) {
        const lock = p.data as any;
        return lock?.token as `0x${string}` | undefined;
      } else {
        const vesting = p.data as any;
        return vesting?.token as `0x${string}` | undefined;
      }
    }).filter(Boolean) as `0x${string}`[];
  }, [positions, isLockTab]);

  const tokenMetaQuery = useReadContracts({
    contracts: tokenAddresses.flatMap((token) => [
      { address: token, abi: ERC20_ABI, functionName: "symbol" as const },
      { address: token, abi: ERC20_ABI, functionName: "decimals" as const },
    ]),
    query: { enabled: tokenAddresses.length > 0 },
  });

  const tokenMeta = useMemo(() => {
    const map: Record<string, { symbol: string; decimals: number }> = {};
    tokenAddresses.forEach((token, i) => {
      const sym = tokenMetaQuery.data?.[i * 2]?.result as string | undefined;
      const dec = tokenMetaQuery.data?.[i * 2 + 1]?.result as number | undefined;
      if (sym && dec !== undefined) {
        map[token.toLowerCase()] = { symbol: sym, decimals: dec };
      }
    });
    return map;
  }, [tokenAddresses, tokenMetaQuery.data]);

  // Transfer transaction
  const transferTx = useWriteContract();
  const transferRcpt = useWaitForTransactionReceipt({ hash: transferTx.data });

  const handleTransfer = () => {
    if (!selectedTokenId || !recipientAddress || !address) return;
    
    transferTx.writeContract({
      address: contractAddress,
      abi,
      functionName: "transferFrom",
      args: [address, recipientAddress as `0x${string}`, selectedTokenId],
    });
  };

  if (transferRcpt.isSuccess && !confirmed) {
    setConfirmed(true);
    toast("success", "Position transferred", `Successfully transferred to ${shortAddr(recipientAddress as `0x${string}`)}`);
  }

  const selectedPosition = positions.find((p) => p.tokenId === selectedTokenId);
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(recipientAddress);
  const canTransfer = selectedTokenId !== null && isValidAddress && recipientAddress.toLowerCase() !== address?.toLowerCase();

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        {/* Header */}
        <div className="mb-7">
          <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>
            Transfer Positions
          </h1>
          <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
            Transfer your lock or vesting positions to another address
          </p>
        </div>

        {!address ? (
          <EmptyState title="Wallet not connected" sub="Connect your wallet to transfer positions." />
        ) : confirmed ? (
          <SuccessState
            onDone={() => {
              setConfirmed(false);
              setSelectedTokenId(null);
              setRecipientAddress("");
              transferTx.reset();
            }}
            recipient={recipientAddress}
          />
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Select Position */}
            <div>
              <h2 className="font-grotesk uppercase text-[14px] tracking-wider mb-3" style={{ color: "rgba(237,224,255,0.9)" }}>
                1. Select Position
              </h2>

              {/* Tabs */}
              <div className="flex items-center gap-0.5 p-1 rounded-full mb-4" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setActiveTab(t);
                      setSelectedTokenId(null);
                    }}
                    className="flex-1 px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap"
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

              {/* Positions List */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
                {positions.length === 0 ? (
                  <EmptyState title={`No ${activeTab.toLowerCase()} yet`} sub={`Create a ${activeTab === "Locks" ? "lock" : "vesting schedule"} first.`} />
                ) : (
                  positions.map((pos, i) => (
                    <PositionRow
                      key={pos.tokenId.toString()}
                      position={pos}
                      isLock={isLockTab}
                      tokenMeta={tokenMeta}
                      isSelected={selectedTokenId === pos.tokenId}
                      onSelect={() => setSelectedTokenId(pos.tokenId)}
                      isLast={i === positions.length - 1}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right: Transfer Details */}
            <div>
              <h2 className="font-grotesk uppercase text-[14px] tracking-wider mb-3" style={{ color: "rgba(237,224,255,0.9)" }}>
                2. Enter Recipient
              </h2>

              <div className="rounded-xl p-6 space-y-5" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
                {/* Recipient Input */}
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value.trim())}
                    placeholder="0x..."
                    className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[12px] outline-none transition placeholder:text-[rgba(155,127,212,0.3)]"
                    style={{
                      color: "#EDE0FF",
                      border: `1px solid ${recipientAddress && !isValidAddress ? "rgba(255,100,100,0.55)" : "rgba(155,127,212,0.3)"}`,
                      background: "rgba(155,127,212,0.06)",
                    }}
                  />
                  {recipientAddress && !isValidAddress && (
                    <p className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(255,120,120,0.9)" }}>
                      Invalid address format
                    </p>
                  )}
                  {recipientAddress.toLowerCase() === address?.toLowerCase() && (
                    <p className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(255,180,50,0.9)" }}>
                      Cannot transfer to yourself
                    </p>
                  )}
                </div>

                {/* Selected Position Summary */}
                {selectedPosition && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
                    <p className="font-mono text-[9px] uppercase tracking-wider mb-3" style={{ color: "rgba(196,168,240,0.5)" }}>
                      Transferring
                    </p>
                    <PositionSummary position={selectedPosition} isLock={isLockTab} tokenMeta={tokenMeta} />
                  </div>
                )}

                {/* Transfer Button */}
                <button
                  onClick={handleTransfer}
                  disabled={!canTransfer || transferTx.isPending || transferRcpt.isLoading}
                  className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40 active:scale-[0.99] flex items-center justify-center gap-2"
                  style={{
                    background: "rgba(155,127,212,0.2)",
                    color: "#EDE0FF",
                    border: "1px solid rgba(155,127,212,0.5)",
                  }}
                >
                  {transferTx.isPending || transferRcpt.isLoading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
                      Transferring...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" strokeWidth={1.5} />
                      Transfer Position
                    </>
                  )}
                </button>

                {transferTx.error && (
                  <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
                    {transferTx.error.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PositionRow({
  position,
  isLock,
  tokenMeta,
  isSelected,
  onSelect,
  isLast,
}: {
  position: any;
  isLock: boolean;
  tokenMeta: Record<string, { symbol: string; decimals: number }>;
  isSelected: boolean;
  onSelect: () => void;
  isLast: boolean;
}) {
  const data = position.data as any;
  const token = data?.token as `0x${string}` | undefined;
  const meta = token ? tokenMeta[token.toLowerCase()] : undefined;
  const symbol = meta?.symbol ?? "???";
  const decimals = meta?.decimals ?? 18;

  const amount = isLock ? data?.amount : data?.totalAmount;
  const time = isLock ? data?.unlockTime : data?.startTime + data?.duration;

  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-5 py-3.5 hover:bg-[rgba(155,127,212,0.04)] transition-colors"
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(155,127,212,0.15)",
        background: isSelected ? "rgba(155,127,212,0.12)" : "transparent",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-grotesk text-[11px] shrink-0"
            style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.35)", color: "rgba(196,168,240,0.85)" }}
          >
            {symbol[0]}
          </div>
          <div className="min-w-0">
            <p className="font-grotesk uppercase text-[12px] tracking-wider truncate" style={{ color: "#EDE0FF" }}>
              {symbol}
            </p>
            <p className="font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.45)" }}>
              #{position.tokenId.toString()} · {formatAmount(amount, decimals)}
            </p>
          </div>
        </div>
        {isSelected && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "#9B7FD4" }}>
            <CheckCircle2 className="w-3 h-3" style={{ color: "#0D0B14" }} strokeWidth={3} />
          </div>
        )}
      </div>
    </button>
  );
}

function PositionSummary({
  position,
  isLock,
  tokenMeta,
}: {
  position: any;
  isLock: boolean;
  tokenMeta: Record<string, { symbol: string; decimals: number }>;
}) {
  const data = position.data as any;
  const token = data?.token as `0x${string}` | undefined;
  const meta = token ? tokenMeta[token.toLowerCase()] : undefined;
  const symbol = meta?.symbol ?? "???";
  const decimals = meta?.decimals ?? 18;

  const amount = isLock ? data?.amount : data?.totalAmount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
          Type
        </span>
        <span className="font-grotesk text-[12px]" style={{ color: "rgba(237,224,255,0.9)" }}>
          {isLock ? "Lock" : "Vesting"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
          Token
        </span>
        <span className="font-grotesk text-[12px]" style={{ color: "rgba(237,224,255,0.9)" }}>
          {symbol}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
          Amount
        </span>
        <span className="font-grotesk text-[12px]" style={{ color: "rgba(237,224,255,0.9)" }}>
          {formatAmount(amount, decimals)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
          ID
        </span>
        <span className="font-mono text-[11px]" style={{ color: "rgba(237,224,255,0.9)" }}>
          #{position.tokenId.toString()}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "rgba(155,127,212,0.12)", border: "1px solid rgba(155,127,212,0.3)" }}
      >
        <Send className="w-4 h-4" style={{ color: "rgba(196,168,240,0.6)" }} strokeWidth={1.5} />
      </div>
      <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>{title}</p>
      <p className="font-mono text-[10px] mt-1.5 max-w-[260px]" style={{ color: "rgba(196,168,240,0.55)" }}>
        {sub}
      </p>
    </div>
  );
}

function SuccessState({ onDone, recipient }: { onDone: () => void; recipient: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-8">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: "rgba(155,127,212,0.2)", border: "1px solid rgba(155,127,212,0.55)" }}
      >
        <CheckCircle2 className="w-7 h-7" style={{ color: "#C4A8F0" }} strokeWidth={1.5} />
      </div>
      <p className="font-grotesk uppercase tracking-wider text-[18px] mb-1" style={{ color: "#EDE0FF" }}>
        Position Transferred
      </p>
      <p className="font-mono text-[11px] max-w-[320px] mx-auto leading-relaxed mt-2" style={{ color: "rgba(196,168,240,0.6)" }}>
        Successfully transferred to {shortAddr(recipient as `0x${string}`)}
      </p>
      <button
        onClick={onDone}
        className="mt-6 px-6 py-3 rounded-xl font-grotesk text-[12px] uppercase tracking-wider transition active:scale-[0.99]"
        style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
      >
        Transfer Another
      </button>
    </div>
  );
}
