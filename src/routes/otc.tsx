import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ShoppingBag, Tag, X, Wallet } from "lucide-react";
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from "wagmi";
import { maxUint256, formatUnits, parseUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { SuccessModal } from "@/components/SuccessModal";
import { useTransactionSuccess } from "@/lib/web3/useTransactionSuccess";
import { OTC_MARKET_ABI, ERC721_ABI, ERC20_ABI, CONTRACTS, TOKEN_LOCK_ABI, VESTING_NFT_ABI, STREAM_FARM_ABI } from "@/lib/web3/contracts";
import { shortAddr } from "@/lib/web3/format";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import { LIVE_CHAIN_QUERY } from "@/lib/web3/nftImage";
import { NftImage } from "@/components/NftImage";
import { stopPositionRowClick } from "@/components/NftExplorerLink";
import { TokenPicker } from "@/components/TokenPicker";
import { parseListingTuple } from "@/lib/web3/parseOtc";

export const Route = createFileRoute("/otc")({
  component: OTCPage,
  head: () => ({ meta: [{ title: "OTC Market — The Dog House" }, { name: "description", content: "Buy and sell locked positions peer-to-peer." }] }),
});

const TABS = ["Browse", "My Listings", "Sell"] as const;
type Tab = (typeof TABS)[number];
type TxSuccessPayload = {
  heading: string;
  subtext: string;
  rows: { label: string; value: string }[];
};
/** On-chain: paymentToken == address(0) means native MON */
const NATIVE_PAYMENT = "0x0000000000000000000000000000000000000000" as const;
const isNativePaymentToken = (addr: string) => addr.toLowerCase() === NATIVE_PAYMENT;

function useContracts() {
  const chainId = useChainId();
  return CONTRACTS[chainId] ?? CONTRACTS[143];
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
            <h1 className="font-grotesk uppercase text-[26px] sm:text-[34px] leading-none tracking-tight" style={{ color: "#FFFFFF" }}>OTC Market</h1>
            <p className="font-mono text-[11px] mt-1.5 tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>
              Buy and sell locked positions · Set your price · Peer-to-peer
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-0.5 p-1 rounded-full mb-6" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="px-5 py-2 rounded-full font-grotesk text-[12px] uppercase tracking-wider transition whitespace-nowrap"
              style={activeTab === t ? { background: "rgba(139,92,246,0.35)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.6)" } : { color: "rgba(255,255,255,0.5)" }}>
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
  const [txSuccess, setTxSuccess] = useState<TxSuccessPayload | null>(null);

  const activeQ = useReadContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "getActiveListings", args: [0n, BigInt(50)], query: { refetchInterval: 10_000 } });
  const activeIds = (activeQ.data as bigint[]) ?? [];

  if (activeIds.length === 0) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <ShoppingBag className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#FFFFFF" }}>No listings yet</p>
        <p className="font-mono text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Be the first to list a position for sale.</p>
      </div>
    );
  }

  return (
    <>
      <SuccessModal
        open={!!txSuccess}
        onClose={() => setTxSuccess(null)}
        title="OTC Market"
        heading={txSuccess?.heading ?? ""}
        subtext={txSuccess?.subtext ?? ""}
        rows={txSuccess?.rows}
      />
      <div className="space-y-4">
        {activeIds.map((id) => (
          <ListingCard key={id.toString()} listingId={id} showBuy onSuccess={setTxSuccess} />
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              MY LISTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════

function MyListingsTab() {
  const { address } = useAccount();
  const contracts = useContracts();
  const [txSuccess, setTxSuccess] = useState<TxSuccessPayload | null>(null);

  const myQ = useReadContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "getSellerListings", args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 10_000 } });
  const myIds = (myQ.data as bigint[]) ?? [];

  // Fetch details for all my listings to check which are active
  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts: myIds.map((id) => ({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "getListing" as const, args: [id] as const })),
    query: { enabled: myIds.length > 0, refetchInterval: 10_000 },
  });

  // Filter to only active listings
  const activeMyIds = myIds.filter((_, i) => {
    const parsed = parseListingTuple(detailsQ.data?.[i]?.result);
    return parsed?.active === true;
  });

  if (!address) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <Wallet className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#FFFFFF" }}>Connect Wallet</p>
      </div>
    );
  }

  if (activeMyIds.length === 0) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <Tag className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#FFFFFF" }}>No active listings</p>
        <p className="font-mono text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Go to "Sell" to list a position.</p>
      </div>
    );
  }

  return (
    <>
      <SuccessModal
        open={!!txSuccess}
        onClose={() => setTxSuccess(null)}
        title="OTC Market"
        heading={txSuccess?.heading ?? ""}
        subtext={txSuccess?.subtext ?? ""}
        rows={txSuccess?.rows}
      />
      <div className="space-y-4">
        <PendingPaymentsPanel onSuccess={setTxSuccess} />
        {activeMyIds.map((id) => (
          <ListingCard key={id.toString()} listingId={id} showUnlist onSuccess={setTxSuccess} />
        ))}
      </div>
    </>
  );
}

function PendingPaymentsPanel({ onSuccess }: { onSuccess?: (payload: TxSuccessPayload) => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const contracts = useContracts();
  const { toast } = useToast();

  const pendingMonQ = useReadContract({
    address: contracts.otcMarket,
    abi: OTC_MARKET_ABI,
    functionName: "pendingNativePayments",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const pendingMon = (pendingMonQ.data as bigint) ?? 0n;

  const withdrawTx = useWriteContract();
  const withdrawRcpt = useWaitForTransactionReceipt({ hash: withdrawTx.data });

  useTransactionSuccess(withdrawTx, withdrawRcpt, () => {
    onSuccess?.({
      heading: "Proceeds Withdrawn",
      subtext: "Sale proceeds have been sent to your wallet.",
      rows: [{ label: "Amount", value: `${Number(formatUnits(pendingMon, 18)).toLocaleString()} MON` }],
    });
  });

  if (!address || pendingMon === 0n) return null;

  const handleWithdraw = async () => {
    if (!publicClient) return;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      withdrawTx.writeContract({
        address: contracts.otcMarket,
        abi: OTC_MARKET_ABI,
        functionName: "withdrawNativePayments",
        ...gas,
      });
    } catch {
      toast("error", "Withdraw Failed", "Could not prepare withdrawal transaction.");
    }
  };

  return (
    <div className="rounded-xl p-4 flex items-center justify-between gap-4" style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.08)" }}>
      <div>
        <p className="font-grotesk text-[12px]" style={{ color: "#FFFFFF" }}>Pending sale proceeds</p>
        <p className="font-mono text-[11px] mt-0.5" style={{ color: "#A78BFA" }}>
          {Number(formatUnits(pendingMon, 18)).toLocaleString()} MON ready to withdraw
        </p>
      </div>
      <button
        onClick={handleWithdraw}
        disabled={withdrawTx.isPending || withdrawRcpt.isLoading}
        className="px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
        style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}
      >
        {withdrawTx.isPending || withdrawRcpt.isLoading ? "Withdrawing…" : "Withdraw MON"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              LISTING CARD
// ═══════════════════════════════════════════════════════════════════════════

function ListingCard({
  listingId,
  showBuy,
  showUnlist,
  showInactive,
  onSuccess,
}: {
  listingId: bigint;
  showBuy?: boolean;
  showUnlist?: boolean;
  showInactive?: boolean;
  onSuccess?: (payload: TxSuccessPayload) => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const contracts = useContracts();
  const { toast } = useToast();
  const autoBuyRef = useRef(false);
  const pendingBuyHashRef = useRef<`0x${string}` | undefined>(undefined);

  const listingQ = useReadContract({ address: contracts.otcMarket, abi: OTC_MARKET_ABI, functionName: "getListing", args: [listingId], query: { refetchInterval: 10_000 } });
  const listing = parseListingTuple(listingQ.data);
  const isVestingNft = listing?.nftContract?.toLowerCase() === contracts.vestingNFT.toLowerCase();
  const isLockNft = listing?.nftContract?.toLowerCase() === contracts.tokenLock.toLowerCase();
  const vestingQ = useReadContract({
    address: contracts.vestingNFT,
    abi: VESTING_NFT_ABI,
    functionName: "getVesting",
    args: listing?.tokenId !== undefined ? [listing.tokenId] : undefined,
    query: { enabled: !!listing && isVestingNft, refetchInterval: 10_000 },
  });
  const lockQ = useReadContract({
    address: contracts.tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "getLock",
    args: listing?.tokenId !== undefined ? [listing.tokenId] : undefined,
    query: { enabled: !!listing && isLockNft, refetchInterval: 10_000 },
  });
  const vestingData = vestingQ.data as { revoked?: boolean; claimed?: bigint; totalAmount?: bigint } | undefined;
  const lockData = lockQ.data as { withdrawn?: boolean } | undefined;
  const vestingRevoked = isVestingNft && !!vestingData?.revoked;
  const vestingComplete = isVestingNft && vestingData?.totalAmount != null
    && BigInt(vestingData.claimed ?? 0) >= BigInt(vestingData.totalAmount);
  const lockWithdrawn = isLockNft && !!lockData?.withdrawn;
  const listingInvalid = vestingRevoked || vestingComplete || lockWithdrawn;

  const paymentToken = listing?.paymentToken ?? NATIVE_PAYMENT;
  const isNativePayment = isNativePaymentToken(paymentToken);
  const hasErc20Payment = !!listing?.paymentToken && !isNativePayment;
  const paySymQ = useReadContract({ address: paymentToken, abi: ERC20_ABI, functionName: "symbol", query: { enabled: hasErc20Payment } });
  const payDecQ = useReadContract({ address: paymentToken, abi: ERC20_ABI, functionName: "decimals", query: { enabled: hasErc20Payment } });
  const monBalQ = useBalance({ address, query: { enabled: !!address && isNativePayment, refetchInterval: 5_000 } });

  const buyTx = useWriteContract();
  const buyRcpt = useWaitForTransactionReceipt({ hash: buyTx.data });
  const unlistTx = useWriteContract();
  const unlistRcpt = useWaitForTransactionReceipt({ hash: unlistTx.data });
  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });

  const allowanceQ = useReadContract({
    address: paymentToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, contracts.otcMarket] : undefined,
    query: { enabled: !!address && hasErc20Payment, refetchInterval: 5_000 },
  });

  const balanceQ = useReadContract({
    address: paymentToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasErc20Payment, refetchInterval: 5_000 },
  });

  useEffect(() => {
    buyTx.reset();
    approveTx.reset();
    pendingBuyHashRef.current = undefined;
    autoBuyRef.current = false;
  }, [listingId]);

  const listingPrice = listing?.price ?? 0n;

  const formatPriceLabel = (priceValue: bigint, token: string) => {
    const native = isNativePaymentToken(token);
    const dec = native ? 18 : ((payDecQ.data as number) ?? 18);
    const sym = native ? "MON" : ((paySymQ.data as string) || "...");
    return `${Number(formatUnits(priceValue, dec)).toLocaleString()} ${sym}`;
  };

  const notifySuccess = (heading: string, subtext: string, rows: TxSuccessPayload["rows"]) => {
    onSuccess?.({ heading, subtext, rows });
  };

  useEffect(() => {
    if (!buyRcpt.isSuccess || !buyTx.data || buyRcpt.data?.transactionHash !== buyTx.data) return;
    if (pendingBuyHashRef.current === buyTx.data) return;
    pendingBuyHashRef.current = buyTx.data;

    const verify = async () => {
      const priceLabel = listing ? formatPriceLabel(listing.price, listing.paymentToken) : "—";
      const rows = [
        { label: "Listing", value: `#${listingId.toString()}` },
        { label: "Price", value: priceLabel },
      ];

      if (!publicClient || !address || !listing) {
        notifySuccess("Position Purchased", "The NFT position has been transferred to your wallet.", rows);
        return;
      }
      try {
        const owner = await publicClient.readContract({
          address: listing.nftContract,
          abi: ERC721_ABI,
          functionName: "ownerOf",
          args: [listing.tokenId],
        });
        if ((owner as string).toLowerCase() !== address.toLowerCase()) {
          toast("error", "Purchase Incomplete", "Payment may have gone through but the NFT was not transferred. Contact support with your tx hash.");
          return;
        }
        notifySuccess("Position Purchased", "The NFT position has been transferred to your wallet.", rows);
      } catch {
        notifySuccess("Position Purchased", "The NFT position has been transferred to your wallet.", rows);
      }
    };

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyRcpt.isSuccess, buyRcpt.data?.transactionHash, buyTx.data, publicClient, address, listing?.nftContract, listing?.tokenId, toast]);

  useEffect(() => {
    if (buyTx.error) {
      toast("error", "Purchase Failed", (buyTx.error as Error).message?.slice(0, 120) || "Buy transaction failed");
    }
  }, [buyTx.error, toast]);

  useTransactionSuccess(unlistTx, unlistRcpt, () => {
    const priceLabel = listing ? formatPriceLabel(listing.price, listing.paymentToken) : "—";
    notifySuccess("Listing Cancelled", "Your position has been returned to your wallet.", [
      { label: "Listing", value: `#${listingId.toString()}` },
      { label: "Price", value: priceLabel },
    ]);
  });

  useEffect(() => {
    if (!approveRcpt.isSuccess || !autoBuyRef.current || !publicClient) return;
    if (approveRcpt.data?.transactionHash !== approveTx.data) return;
    autoBuyRef.current = false;
    prepareTransactionWithGas(publicClient)
      .then((gas) => {
        buyTx.writeContract({
          address: contracts.otcMarket,
          abi: OTC_MARKET_ABI,
          functionName: "buy",
          args: [listingId],
          value: isNativePayment ? listingPrice : undefined,
          ...gas,
        });
      })
      .catch(() => toast("error", "Transaction Failed", "Failed to buy after approval"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess, approveRcpt.data?.transactionHash, approveTx.data, publicClient, isNativePayment, listingPrice]);

  if (!listing) return null;

  const { seller, nftContract, tokenId, price, active } = listing;
  if (!active && !showInactive) return null;

  const paySym = isNativePayment ? "MON" : ((paySymQ.data as string) || "...");
  const payDec = isNativePayment ? 18 : ((payDecQ.data as number) ?? 18);
  const priceFormatted = Number(formatUnits(price, payDec)).toLocaleString();
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const payBalance = isNativePayment ? (monBalQ.data?.value ?? 0n) : ((balanceQ.data as bigint) ?? 0n);
  const needsApproval = hasErc20Payment && price > 0n && allowance < price;
  const insufficientBalance = price > 0n && payBalance < price;
  const canBuy = !insufficientBalance && price > 0n && !listingInvalid;
  const isSeller = address?.toLowerCase() === seller?.toLowerCase();

  const nftLabel = (() => {
    const addr = (nftContract as string)?.toLowerCase();
    if (addr === contracts.tokenLock.toLowerCase()) return "Lock";
    if (addr === contracts.vestingNFT.toLowerCase()) return "Vesting";
    if (addr === contracts.streamFarm.toLowerCase()) return "Farm";
    return "NFT";
  })();

  const handleApproveAndBuy = async () => {
    if (!publicClient) return;
    autoBuyRef.current = true;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      approveTx.writeContract({
        address: paymentToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.otcMarket, maxUint256],
        ...gas,
      });
    } catch {
      autoBuyRef.current = false;
      toast("error", "Transaction Failed", "Failed to prepare approval");
    }
  };

  const handleBuy = async () => {
    if (!publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    buyTx.writeContract({
      address: contracts.otcMarket,
      abi: OTC_MARKET_ABI,
      functionName: "buy",
      args: [listingId],
      value: isNativePayment ? price : undefined,
      ...gas,
    });
  };

  const handleUnlist = async () => {
    if (!publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    unlistTx.writeContract({
      address: contracts.otcMarket,
      abi: OTC_MARKET_ABI,
      functionName: "unlist",
      args: [listingId],
      ...gas,
    });
  };

  return (
    <div className="rounded-xl p-6 flex items-center justify-between gap-5" style={{ border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.04)" }}>
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <NftImage
          contract={nftContract as `0x${string}`}
          tokenId={BigInt(tokenId ?? 0)}
          size={64}
          fallbackLetter={nftLabel}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="px-2.5 py-0.5 rounded font-mono text-[10px] uppercase" style={{ background: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.3)" }}>{nftLabel}</span>
            <p className="font-grotesk text-[16px] font-medium" style={{ color: "#FFFFFF" }}>#{tokenId?.toString()}</p>
          </div>
          <p className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            Seller: {shortAddr(seller)} · Price: {priceFormatted} {paySym}
            {showBuy && address && !isSeller && (
              <> · Balance: {Number(formatUnits(payBalance, payDec)).toLocaleString()} {paySym}</>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0" onClick={stopPositionRowClick}>
        {showBuy && !isSeller && (
          listingInvalid ? (
            <span className="font-mono text-[9px] px-3 py-2 rounded-xl" style={{ color: "rgba(255,120,120,0.9)", border: "1px solid rgba(255,120,120,0.35)" }}>
              {lockWithdrawn ? "Lock empty" : vestingComplete ? "Vesting complete" : "Vesting revoked"}
            </span>
          ) : insufficientBalance ? (
            <span className="font-mono text-[9px] px-3 py-2 rounded-xl" style={{ color: "rgba(255,120,120,0.9)", border: "1px solid rgba(255,120,120,0.35)" }}>
              Insufficient {paySym}
            </span>
          ) : needsApproval ? (
            <button
              onClick={handleApproveAndBuy}
              disabled={!canBuy || approveTx.isPending || approveRcpt.isLoading || buyTx.isPending || buyRcpt.isLoading}
              className="px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
              style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}
            >
              {approveTx.isPending || approveRcpt.isLoading ? "Approving…" : buyTx.isPending || buyRcpt.isLoading ? "Buying…" : "Approve & Buy"}
            </button>
          ) : (
            <button
              onClick={handleBuy}
              disabled={!canBuy || buyTx.isPending || buyRcpt.isLoading}
              className="px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
              style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}
            >
              {buyTx.isPending || buyRcpt.isLoading ? "Buying…" : "Buy"}
            </button>
          )
        )}
        {showUnlist && isSeller && (
          <button onClick={handleUnlist} disabled={unlistTx.isPending || unlistRcpt.isLoading}
            className="px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(139,92,246,0.1)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.3)" }}>
            {unlistTx.isPending ? "..." : "Unlist"}
          </button>
        )}
        {isSeller && showBuy && <span className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>Your listing</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//                              SELL TAB
// ═══════════════════════════════════════════════════════════════════════════

function SellTab() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const contracts = useContracts();
  const { toast } = useToast();
  const autoListRef = useRef(false);

  const [selected, setSelected] = useState<{ contract: `0x${string}`; tokenId: string; label: string } | null>(null);
  const [paymentToken, setPaymentToken] = useState<`0x${string}` | "">("");
  const [paymentTokenMeta, setPaymentTokenMeta] = useState<{ symbol: string; decimals: number } | null>(null);
  const [price, setPrice] = useState("");

  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const listTx = useWriteContract();
  const listRcpt = useWaitForTransactionReceipt({ hash: listTx.data });

  const sellNativePayment = !!paymentToken && isNativePaymentToken(paymentToken);
  const payDecQ = useReadContract({
    address: (paymentToken || NATIVE_PAYMENT) as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!paymentToken && paymentToken.length === 42 && !paymentTokenMeta && !sellNativePayment },
  });
  const payDec = sellNativePayment ? 18 : (paymentTokenMeta?.decimals ?? (payDecQ.data as number) ?? 18);

  // Check NFT approval
  const nftAddr = (selected?.contract ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const hasSelected = !!selected;
  const approvedQ = useReadContract({ address: nftAddr, abi: ERC721_ABI, functionName: "getApproved", args: selected ? [BigInt(selected.tokenId)] : undefined, query: { enabled: hasSelected } });
  const isApproved = (approvedQ.data as string)?.toLowerCase() === contracts.otcMarket.toLowerCase();

  const runList = async () => {
    if (!selected || !paymentToken || !price || !publicClient) return;
    const parsedPrice = parseUnits(price, payDec);
    const gas = await prepareTransactionWithGas(publicClient);
    listTx.writeContract({
      address: contracts.otcMarket,
      abi: OTC_MARKET_ABI,
      functionName: "list",
      args: [selected.contract, BigInt(selected.tokenId), paymentToken as `0x${string}`, parsedPrice],
      ...gas,
    });
  };

  const handleApproveAndList = async () => {
    if (!selected || !paymentToken || !price || !publicClient) return;
    autoListRef.current = true;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      approveTx.writeContract({
        address: selected.contract,
        abi: ERC721_ABI,
        functionName: "approve",
        args: [contracts.otcMarket, BigInt(selected.tokenId)],
        ...gas,
      });
    } catch {
      autoListRef.current = false;
      toast("error", "Transaction Failed", "Failed to prepare NFT approval");
    }
  };

  const handleList = async () => {
    try {
      await runList();
    } catch {
      toast("error", "Transaction Failed", "Failed to prepare listing");
    }
  };

  useEffect(() => {
    if (!approveRcpt.isSuccess || !autoListRef.current || !selected || !paymentToken || !price) return;
    autoListRef.current = false;
    runList().catch(() => toast("error", "Transaction Failed", "Failed to list after approval"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  const [listSuccess, setListSuccess] = useState(false);

  useTransactionSuccess(listTx, listRcpt, () => setListSuccess(true));

  if (!address) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <Wallet className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#FFFFFF" }}>Connect Wallet</p>
      </div>
    );
  }

  return (
    <>
    <SuccessModal open={listSuccess} onClose={() => { setListSuccess(false); listTx.reset(); approveTx.reset(); }} title="OTC Market" heading="Position Listed" subtext="Your position is now for sale on the OTC market." rows={[{ label: "Type", value: selected?.label || "—" }, { label: "Token ID", value: `#${selected?.tokenId || "—"}` }]} />
    <div className="space-y-6">
      {/* Step 1: Pick a position */}
      <div className="rounded-xl p-5" style={{ border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.04)" }}>
        <p className="font-grotesk text-[16px] font-medium mb-4" style={{ color: "#FFFFFF" }}>Select Position to Sell</p>
        <UserPositionsList selected={selected} onSelect={setSelected} />
      </div>

      {/* Step 2: Set price (only shows after selecting) */}
      {selected && (
        <div className="rounded-xl p-5" style={{ border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.04)" }}>
          <p className="font-grotesk text-[16px] font-medium mb-1" style={{ color: "#FFFFFF" }}>Set Price</p>
          <p className="font-mono text-[11px] mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            Selling: {selected.label} #{selected.tokenId}
          </p>

          <div className="space-y-4">
            <div>
              <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>
                Payment (MON or ERC-20 token)
              </label>
              <TokenPicker
                compact
                selected={
                  paymentToken
                    ? {
                        address: paymentToken as `0x${string}`,
                        symbol: paymentTokenMeta?.symbol ?? "…",
                        name: paymentTokenMeta?.symbol ?? "",
                        decimals: payDec,
                      }
                    : undefined
                }
                onSelect={(t) => {
                  setPaymentToken(t.address);
                  setPaymentTokenMeta({ symbol: t.symbol, decimals: t.decimals });
                }}
              />
            </div>
            <div>
              <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>Price</label>
              <input type="text" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="100"
                className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
                style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.3)", color: "#FFFFFF" }} />
            </div>

            {!isApproved ? (
              <button
                onClick={handleApproveAndList}
                disabled={approveTx.isPending || approveRcpt.isLoading || listTx.isPending || listRcpt.isLoading}
                className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
                style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}
              >
                {approveTx.isPending || approveRcpt.isLoading ? "Approving…" : listTx.isPending || listRcpt.isLoading ? "Listing…" : "Approve & List"}
              </button>
            ) : (
              <button onClick={handleList} disabled={!paymentToken || !price || listTx.isPending || listRcpt.isLoading}
                className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
                style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}>
                {listTx.isPending || listRcpt.isLoading ? "Listing..." : "List for Sale"}
              </button>
            )}

            {listRcpt.isSuccess && <p className="font-mono text-[10px]" style={{ color: "#A78BFA" }}>✓ Listed!</p>}
            {(listTx.error || approveTx.error) && <p className="font-mono text-[10px]" style={{ color: "rgba(255,100,100,0.9)" }}>{((listTx.error || approveTx.error) as any)?.shortMessage || (listTx.error || approveTx.error)?.message}</p>}
          </div>
        </div>
      )}
    </div>
    </>
  );
}


function UserPositionsList({ selected, onSelect }: { selected: any; onSelect: (s: any) => void }) {
  const { address } = useAccount();
  const contracts = useContracts();

  const locksQ = useReadContract({ address: contracts.tokenLock, abi: TOKEN_LOCK_ABI, functionName: "locksOf", args: address ? [address] : undefined, query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 10_000 } });
  const lockIds = (locksQ.data as bigint[]) ?? [];

  const lockDetailsQ = useReadContracts({
    allowFailure: true,
    contracts: lockIds.map((id) => ({ address: contracts.tokenLock, abi: TOKEN_LOCK_ABI, functionName: "getLock" as const, args: [id] as const })),
    query: { ...LIVE_CHAIN_QUERY, enabled: lockIds.length > 0, refetchInterval: 10_000 },
  });

  const vestingsQ = useReadContract({ address: contracts.vestingNFT, abi: VESTING_NFT_ABI, functionName: "vestingsOf", args: address ? [address] : undefined, query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 10_000 } });
  const vestingIds = (vestingsQ.data as bigint[]) ?? [];

  const vestingDetailsQ = useReadContracts({
    allowFailure: true,
    contracts: vestingIds.map((id) => ({ address: contracts.vestingNFT, abi: VESTING_NFT_ABI, functionName: "getVesting" as const, args: [id] as const })),
    query: { ...LIVE_CHAIN_QUERY, enabled: vestingIds.length > 0, refetchInterval: 10_000 },
  });

  const farmsQ = useReadContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "positionsOf", args: address ? [address] : undefined, query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 10_000 } });
  const farmIds = (farmsQ.data as bigint[]) ?? [];

  const now = Math.floor(Date.now() / 1000);
  const activeLocks = lockIds.filter((_, i) => {
    const d = lockDetailsQ.data?.[i]?.result as any;
    if (!d) return false;
    if (d.withdrawn) return false;
    return Number(d.unlockTime ?? d.unlockAt ?? 0) > now;
  });

  const activeVestings = vestingIds.filter((_, i) => {
    const d = vestingDetailsQ.data?.[i]?.result as any;
    if (!d || d.revoked) return false;
    return BigInt(d.claimed ?? 0) < BigInt(d.totalAmount ?? 0);
  });

  const allPositions = [
    ...activeLocks.map((id) => ({ contract: contracts.tokenLock as `0x${string}`, tokenId: id.toString(), label: "Lock" })),
    ...activeVestings.map((id) => ({ contract: contracts.vestingNFT as `0x${string}`, tokenId: id.toString(), label: "Vesting" })),
    ...farmIds.map((id) => ({ contract: contracts.streamFarm as `0x${string}`, tokenId: id.toString(), label: "Farm" })),
  ];

  if (allPositions.length === 0) {
    return <p className="font-mono text-[11px] py-4 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>No active positions found.</p>;
  }

  return (
    <div className="grid gap-2 max-h-[300px] overflow-y-auto">
      {allPositions.map((pos) => {
        const isSelected = selected?.contract === pos.contract && selected?.tokenId === pos.tokenId;
        return (
          <button
            key={`${pos.contract}-${pos.tokenId}`}
            onClick={() => onSelect(isSelected ? null : pos)}
            className="w-full text-left p-4 rounded-xl transition"
            style={{ background: isSelected ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.06)", border: `1px solid ${isSelected ? "rgba(139,92,246,0.6)" : "rgba(139,92,246,0.2)"}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <NftImage contract={pos.contract} tokenId={BigInt(pos.tokenId)} size={52} fallbackLetter={pos.label} />
                <div className="min-w-0">
                  <span className="px-2.5 py-0.5 rounded font-mono text-[9px] uppercase" style={{ background: "rgba(139,92,246,0.15)", color: "#A78BFA" }}>{pos.label}</span>
                  <span className="font-mono text-[14px] ml-2" style={{ color: "#FFFFFF" }}>#{pos.tokenId}</span>
                </div>
              </div>
              {isSelected && (
                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#8B5CF6" }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="#0c0c10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
