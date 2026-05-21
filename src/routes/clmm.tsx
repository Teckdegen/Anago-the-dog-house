import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { BarChart2, Wallet } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { SuccessModal } from "@/components/SuccessModal";
import { ERC20_ABI } from "@/lib/web3/contracts";

export const Route = createFileRoute("/clmm")({
  component: AMMPage,
  head: () => ({
    meta: [
      { title: "AMM — The Dog House" },
      { name: "description", content: "Provide liquidity and earn trading fees on Monad via Kuru." },
    ],
  }),
});

// Kuru testnet addresses
const KURU_MARGIN_ACCOUNT = "0xdDDaBd30785bA8b45e434a1f134BDf304d6125d9" as const;
const KURU_ROUTER = "0x1f5A250c4A506DA4cE584173c6ed1890B1bf7187" as const;

// KuruAMMVault ABI (deposit/withdraw/preview)
const VAULT_ABI = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [{ name: "baseDeposit", type: "uint256" }, { name: "quoteDeposit", type: "uint256" }, { name: "minQuoteConsumed", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "_shares", type: "uint256" }, { name: "_receiver", type: "address" }, { name: "_owner", type: "address" }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "previewDeposit", stateMutability: "view", inputs: [{ name: "asset1", type: "uint256" }, { name: "asset2", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "previewWithdraw", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token2", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

// Margin Account ABI
const MARGIN_ABI = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [{ name: "_user", type: "address" }, { name: "_token", type: "address" }, { name: "_amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "_amount", type: "uint256" }, { name: "_token", type: "address" }], outputs: [] },
  { type: "function", name: "getBalance", stateMutability: "view", inputs: [{ name: "_user", type: "address" }, { name: "_token", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const TABS = ["Provide Liquidity", "Withdraw"] as const;
type Tab = (typeof TABS)[number];

function AMMPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Provide Liquidity");
  const { address } = useAccount();

  return (
    <AppShell>
      <div className="max-w-[800px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="mb-7">
          <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>AMM Liquidity</h1>
          <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
            Provide liquidity to Kuru order book vaults · Earn trading fees · Powered by Kuru Exchange
          </p>
        </div>

        <div className="inline-flex items-center gap-0.5 p-1 rounded-full mb-6" style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="px-4 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition whitespace-nowrap"
              style={activeTab === t ? { background: "rgba(155,127,212,0.35)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" } : { color: "rgba(196,168,240,0.5)" }}>
              {t}
            </button>
          ))}
        </div>

        {!address ? (
          <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
            <Wallet className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(196,168,240,0.4)" }} strokeWidth={1.5} />
            <p className="font-grotesk text-[14px]" style={{ color: "#EDE0FF" }}>Connect Wallet</p>
            <p className="font-mono text-[11px] mt-1" style={{ color: "rgba(196,168,240,0.5)" }}>Connect your wallet to provide liquidity.</p>
          </div>
        ) : (
          <>
            {activeTab === "Provide Liquidity" && <DepositTab />}
            {activeTab === "Withdraw" && <WithdrawTab />}
          </>
        )}

        {/* Info */}
        <div className="mt-8 rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.2)", background: "rgba(155,127,212,0.03)" }}>
          <p className="font-mono text-[9px] uppercase tracking-wider mb-3" style={{ color: "rgba(196,168,240,0.4)" }}>How it works</p>
          <div className="space-y-2 font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.6)" }}>
            <p>• Deposit token pairs into Kuru AMM vaults to earn trading fees</p>
            <p>• Your liquidity backs the on-chain order book — every trade earns you fees</p>
            <p>• Withdraw anytime — no lock period</p>
            <p>• LP shares are ERC20 tokens — transferable and composable</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DepositTab() {
  const { address } = useAccount();
  const { toast } = useToast();
  const [vaultAddress, setVaultAddress] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);

  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const depositTx = useWriteContract();
  const depositRcpt = useWaitForTransactionReceipt({ hash: depositTx.data });

  useEffect(() => {
    if (depositRcpt.isSuccess) setSuccessOpen(true);
  }, [depositRcpt.isSuccess]);

  const handleDeposit = () => {
    if (!vaultAddress || !baseAmount || !quoteAmount || !address) return;
    const base = parseUnits(baseAmount, 18);
    const quote = parseUnits(quoteAmount, 18);
    depositTx.writeContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [base, quote, 0n, address],
      gas: 500000n,
    });
  };

  return (
    <>
      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} title="AMM" heading="Liquidity Added" subtext="You received LP shares for your deposit." rows={[{ label: "Base", value: baseAmount }, { label: "Quote", value: quoteAmount }]} />

      <div className="rounded-xl p-6" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}>
        <h3 className="font-grotesk text-[15px] font-medium mb-5" style={{ color: "#EDE0FF" }}>Add Liquidity</h3>
        <div className="space-y-4">
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>Vault Address</label>
            <input type="text" value={vaultAddress} onChange={(e) => setVaultAddress(e.target.value)} placeholder="0x... (KuruAMMVault address)"
              className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
              style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
            <p className="font-mono text-[9px] mt-1" style={{ color: "rgba(196,168,240,0.4)" }}>Get vault addresses from Kuru markets</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>Base Amount</label>
              <input type="text" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0"
                className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
                style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
            </div>
            <div>
              <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>Quote Amount</label>
              <input type="text" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0"
                className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
                style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
            </div>
          </div>
          <button onClick={handleDeposit} disabled={!vaultAddress || !baseAmount || !quoteAmount || depositTx.isPending || depositRcpt.isLoading}
            className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
            {depositTx.isPending || depositRcpt.isLoading ? "Depositing..." : "Add Liquidity"}
          </button>
          {depositTx.error && <p className="font-mono text-[10px]" style={{ color: "rgba(255,100,100,0.9)" }}>{(depositTx.error as any)?.shortMessage || depositTx.error.message}</p>}
        </div>
      </div>
    </>
  );
}

function WithdrawTab() {
  const { address } = useAccount();
  const { toast } = useToast();
  const [vaultAddress, setVaultAddress] = useState("");
  const [shares, setShares] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);

  const withdrawTx = useWriteContract();
  const withdrawRcpt = useWaitForTransactionReceipt({ hash: withdrawTx.data });

  useEffect(() => {
    if (withdrawRcpt.isSuccess) setSuccessOpen(true);
  }, [withdrawRcpt.isSuccess]);

  const handleWithdraw = () => {
    if (!vaultAddress || !shares || !address) return;
    const sharesWei = parseUnits(shares, 18);
    withdrawTx.writeContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [sharesWei, address, address],
      gas: 500000n,
    });
  };

  return (
    <>
      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} title="AMM" heading="Liquidity Removed" subtext="Your tokens have been returned." rows={[{ label: "Shares Burned", value: shares }]} />

      <div className="rounded-xl p-6" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}>
        <h3 className="font-grotesk text-[15px] font-medium mb-5" style={{ color: "#EDE0FF" }}>Remove Liquidity</h3>
        <div className="space-y-4">
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>Vault Address</label>
            <input type="text" value={vaultAddress} onChange={(e) => setVaultAddress(e.target.value)} placeholder="0x... (KuruAMMVault address)"
              className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
              style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
          </div>
          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(196,168,240,0.55)" }}>LP Shares to Burn</label>
            <input type="text" value={shares} onChange={(e) => setShares(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0"
              className="w-full rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
              style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
          </div>
          <button onClick={handleWithdraw} disabled={!vaultAddress || !shares || withdrawTx.isPending || withdrawRcpt.isLoading}
            className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
            {withdrawTx.isPending || withdrawRcpt.isLoading ? "Withdrawing..." : "Remove Liquidity"}
          </button>
          {withdrawTx.error && <p className="font-mono text-[10px]" style={{ color: "rgba(255,100,100,0.9)" }}>{(withdrawTx.error as any)?.shortMessage || withdrawTx.error.message}</p>}
        </div>
      </div>
    </>
  );
}
