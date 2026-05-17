import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingBag, Tag, X, Wallet } from "lucide-react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { OTC_MARKET_ABI, ERC721_ABI, ERC20_ABI, CONTRACTS } from "@/lib/web3/contracts";
import { shortAddr } from "@/lib/web3/format";

export const Route = createFileRoute("/otc")({
  component: OTCPage,
  head: () => ({ meta: [{ title: "OTC Market — The Dog House" }, { name: "description", content: "Buy and sell locked positions peer-to-peer." }] }),
});

const TABS = ["Browse", "My Listings", "Sell"] as const;
type Tab = (typeof TABS)[number];

function useContracts() {
  const chainId = useChainId();
  return CONTRACTS[chainId] ?? CONTRACTS[10143];
}

function OTCPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Browse");
  const { address } = useAccount();
  const contracts = useContracts();

  const countQ = useReadContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "listingCount", query: { refetchInterval: 10_000 } });
  const totalListings = Number(countQ.data ?? 0);

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>OTC Market</h1>
            <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
              Buy and sell locked positions · Set your price · Peer-to-peer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 p-1 rounded-full mb-6" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap"
              style={activeTab === t ? { background: "rgba(155,127,212,0.35)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" } : { color: "rgba(196,168,240,0.5)" }}>
              {t}
            </button>
          ))}
        </div>

        {activeTab === "Browse" && <BrowseTab totalListings={totalListings} />}
        {activeTab === "My Listings" && <MyListingsTab />}
        {activeTab === "Sell" && <SellTab />}
      </div>
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              BROWSE TAB
// ═══════════════════════════════════════════════════════════════════════════

function BrowseTab({ totalListings }: { totalListings: number }) {
  const contracts = useContracts();

  const activeQ = useReadContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "getActiveListings", args: [0n, BigInt(50)], query: { refetchInterval: 10_000 } });
  const activeIds = (activeQ.data as bigint[]) ?? [];

  if (activeIds.length === 0) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <ShoppingBag className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(196,168,240,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#EDE0FF" }}>No listings yet</p>
        <p className="font-mono text-[11px] mt-1" style={{ color: "rgba(196,168,240,0.5)" }}>Be the first to list a position for sale.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeIds.map((id) => <ListingCard key={id.toString()} listingId={id} showBuy />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              MY LISTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════

function MyListingsTab() {
  const { address } = useAccount();
  const contracts = useContracts();

  const myQ = useReadContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "getSellerListings", args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 10_000 } });
  const myIds = (myQ.data as bigint[]) ?? [];

  if (!address) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <Wallet className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(196,168,240,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#EDE0FF" }}>Connect Wallet</p>
      </div>
    );
  }

  if (myIds.length === 0) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <Tag className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(196,168,240,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#EDE0FF" }}>No listings</p>
        <p className="font-mono text-[11px] mt-1" style={{ color: "rgba(196,168,240,0.5)" }}>Go to "Sell" to list a position.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {myIds.map((id) => <ListingCard key={id.toString()} listingId={id} showUnlist />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              LISTING CARD
// ═══════════════════════════════════════════════════════════════════════════

function ListingCard({ listingId, showBuy, showUnlist }: { listingId: bigint; showBuy?: boolean; showUnlist?: boolean }) {
  const { address } = useAccount();
  const contracts = useContracts();
  const { toast } = useToast();

  const listingQ = useReadContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "getListing", args: [listingId], query: { refetchInterval: 10_000 } });
  const data = listingQ.data as any;

  const paymentToken = (data?.[3] ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const hasPayment = !!data?.[3];
  const paySymQ = useReadContract({ address: paymentToken, abi: ERC20_ABI, functionName: "symbol", query: { enabled: hasPayment } });
  const payDecQ = useReadContract({ address: paymentToken, abi: ERC20_ABI, functionName: "decimals", query: { enabled: hasPayment } });

  const buyTx = useWriteContract();
  const buyRcpt = useWaitForTransactionReceipt({ hash: buyTx.data });
  const unlistTx = useWriteContract();
  const unlistRcpt = useWaitForTransactionReceipt({ hash: unlistTx.data });
  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });

  // Check allowance for buying
  const allowanceQ = useReadContract({ address: paymentToken, abi: ERC20_ABI, functionName: "allowance", args: address ? [address, contracts.otcMarket] : undefined, query: { enabled: !!address && hasPayment, refetchInterval: 5_000 } });

  if (!data || !data[5]) return null; // not active

  const [seller, nftContract, tokenId, , price, active] = data;
  if (!active) return null;

  const paySym = (paySymQ.data as string) || "...";
  const payDec = (payDecQ.data as number) ?? 18;
  const priceFormatted = Number(formatUnits(price, payDec)).toLocaleString();
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = price > 0n && allowance < price;
  const isSeller = address?.toLowerCase() === seller?.toLowerCase();

  const nftLabel = (() => {
    const addr = (nftContract as string)?.toLowerCase();
    if (addr === contracts.tokenLock.toLowerCase()) return "Lock";
    if (addr === contracts.vestingNFT.toLowerCase()) return "Vesting";
    if (addr === contracts.streamFarm.toLowerCase()) return "Farm";
    return "NFT";
  })();

  const handleApprove = () => {
    approveTx.writeContract({ address: paymentToken, abi: ERC20_ABI, functionName: "approve", args: [contracts.otcMarket, price] });
  };

  const handleBuy = () => {
    buyTx.writeContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "buy", args: [listingId] });
  };

  const handleUnlist = () => {
    unlistTx.writeContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "unlist", args: [listingId] });
  };

  if (buyRcpt.isSuccess) toast("success", "Purchased!", "Position transferred to your wallet.");
  if (unlistRcpt.isSuccess) toast("success", "Unlisted", "Position returned to your wallet.");

  return (
    <div className="rounded-xl p-5 flex items-center justify-between gap-4" style={{ border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.04)" }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded font-mono text-[9px] uppercase" style={{ background: "rgba(155,127,212,0.15)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.3)" }}>{nftLabel}</span>
          <p className="font-grotesk text-[14px] font-medium" style={{ color: "#EDE0FF" }}>#{tokenId?.toString()}</p>
        </div>
        <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.5)" }}>
          Seller: {shortAddr(seller)} · Price: {priceFormatted} {paySym}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showBuy && !isSeller && (
          needsApproval ? (
            <button onClick={handleApprove} disabled={approveTx.isPending || approveRcpt.isLoading}
              className="px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
              style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
              {approveTx.isPending ? "..." : "Approve"}
            </button>
          ) : (
            <button onClick={handleBuy} disabled={buyTx.isPending || buyRcpt.isLoading}
              className="px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
              style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
              {buyTx.isPending ? "..." : "Buy"}
            </button>
          )
        )}
        {showUnlist && isSeller && (
          <button onClick={handleUnlist} disabled={unlistTx.isPending || unlistRcpt.isLoading}
            className="px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(155,127,212,0.1)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.3)" }}>
            {unlistTx.isPending ? "..." : "Unlist"}
          </button>
        )}
        {isSeller && showBuy && <span className="font-mono text-[9px]" style={{ color: "rgba(196,168,240,0.4)" }}>Your listing</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              SELL TAB
// ═══════════════════════════════════════════════════════════════════════════

function SellTab() {
  const { address } = useAccount();
  const contracts = useContracts();
  const { toast } = useToast();

  const [nftContract, setNftContract] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [paymentToken, setPaymentToken] = useState("");
  const [price, setPrice] = useState("");

  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const listTx = useWriteContract();
  const listRcpt = useWaitForTransactionReceipt({ hash: listTx.data });

  const payDecQ = useReadContract({ address: paymentToken as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", query: { enabled: paymentToken.length === 42 } });
  const payDec = (payDecQ.data as number) ?? 18;

  // Check NFT approval
  const approvedQ = useReadContract({ address: (nftContract || "0x0000000000000000000000000000000000000000") as `0x${string}`, abi: ERC721_ABI, functionName: "getApproved", args: tokenId ? [BigInt(tokenId)] : undefined, query: { enabled: !!nftContract && !!tokenId } });
  const isApproved = (approvedQ.data as string)?.toLowerCase() === contracts.otcMarket.toLowerCase();

  const handleApproveNFT = () => {
    if (!nftContract || !tokenId) return;
    approveTx.writeContract({ address: nftContract as `0x${string}`, abi: ERC721_ABI, functionName: "approve", args: [contracts.otcMarket, BigInt(tokenId)] });
  };

  const handleList = () => {
    if (!nftContract || !tokenId || !paymentToken || !price) return;
    const parsedPrice = parseUnits(price, payDec);
    listTx.writeContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "list", args: [nftContract as `0x${string}`, BigInt(tokenId), paymentToken as `0x${string}`, parsedPrice] });
  };

  if (listRcpt.isSuccess) toast("success", "Listed!", "Your position is now for sale on the OTC market.");

  if (!address) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <Wallet className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(196,168,240,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#EDE0FF" }}>Connect Wallet</p>
      </div>
    );
  }

  // Quick select buttons for NFT contract
  const nftOptions = [
    { label: "Lock", addr: contracts.tokenLock },
    { label: "Vesting", addr: contracts.vestingNFT },
    { label: "Farm", addr: contracts.streamFarm },
  ];

  return (
    <div className="rounded-xl p-6" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}>
      <h3 className="font-grotesk text-[15px] font-medium mb-5" style={{ color: "#EDE0FF" }}>List Position for Sale</h3>

      <div className="space-y-4">
        {/* NFT type selector */}
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Position Type</label>
          <div className="flex gap-2">
            {nftOptions.map((opt) => (
              <button key={opt.label} onClick={() => setNftContract(opt.addr)}
                className="px-4 py-2 rounded-lg font-mono text-[11px] transition"
                style={{ background: nftContract === opt.addr ? "rgba(155,127,212,0.3)" : "rgba(155,127,212,0.08)", border: `1px solid ${nftContract === opt.addr ? "rgba(155,127,212,0.6)" : "rgba(155,127,212,0.2)"}`, color: nftContract === opt.addr ? "#EDE0FF" : "rgba(196,168,240,0.5)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Token ID */}
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>NFT Token ID</label>
          <input type="text" value={tokenId} onChange={(e) => setTokenId(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0"
            className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
            style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
        </div>

        {/* Payment token */}
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>Payment Token Address</label>
          <input type="text" value={paymentToken} onChange={(e) => setPaymentToken(e.target.value)} placeholder="0x... (ERC20 token buyers pay with)"
            className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
            style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
        </div>

        {/* Price */}
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>Price (in payment token units)</label>
          <input type="text" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="100"
            className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
            style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
        </div>

        {/* Actions */}
        {!isApproved ? (
          <button onClick={handleApproveNFT} disabled={!nftContract || !tokenId || approveTx.isPending || approveRcpt.isLoading}
            className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
            {approveTx.isPending || approveRcpt.isLoading ? "Approving NFT..." : "Approve NFT"}
          </button>
        ) : (
          <button onClick={handleList} disabled={!nftContract || !tokenId || !paymentToken || !price || listTx.isPending || listRcpt.isLoading}
            className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
            {listTx.isPending || listRcpt.isLoading ? "Listing..." : "List for Sale"}
          </button>
        )}

        {listRcpt.isSuccess && <p className="font-mono text-[10px]" style={{ color: "#C4A8F0" }}>✓ Position listed!</p>}
        {(listTx.error || approveTx.error) && <p className="font-mono text-[10px]" style={{ color: "rgba(255,100,100,0.9)" }}>{((listTx.error || approveTx.error) as any)?.shortMessage || (listTx.error || approveTx.error)?.message}</p>}
      </div>
    </div>
  );
}
