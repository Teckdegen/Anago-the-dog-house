import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { BarChart2, Wallet, Plus } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from "wagmi";
import { parseUnits, formatUnits, encodeFunctionData } from "viem";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { SuccessModal } from "@/components/SuccessModal";
import { ERC20_ABI } from "@/lib/web3/contracts";

export const Route = createFileRoute("/clmm")({
  component: CLMMPage,
  head: () => ({ meta: [{ title: "CLMM — The Dog House" }, { name: "description", content: "Concentrated liquidity on Monad via Capricorn." }] }),
});

// Capricorn CL testnet addresses
const CAPRICORN = {
  factory: "0xd0a37cf728CE2902eB8d4F6f2afc76854048253b" as const,
  positionManager: "0x311819d339B87a10cc4Bbf137d5A0F233Ab56Ad7" as const,
  swapRouter: "0xD0B138e03eE785e8C0Af250C1eA5316f43800F46" as const,
  quoter: "0x4D59c6E4B20bf6164263b36c6CeC328F326Fb2F9" as const,
};

// Minimal ABIs for Capricorn CL (Uniswap V3 compatible)
const POSITION_MANAGER_ABI = [
  { type: "function", name: "positions", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "nonce", type: "uint96" }, { name: "operator", type: "address" }, { name: "token0", type: "address" }, { name: "token1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickLower", type: "int24" }, { name: "tickUpper", type: "int24" }, { name: "liquidity", type: "uint128" }, { name: "feeGrowthInside0LastX128", type: "uint256" }, { name: "feeGrowthInside1LastX128", type: "uint256" }, { name: "tokensOwed0", type: "uint128" }, { name: "tokensOwed1", type: "uint128" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenOfOwnerByIndex", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "mint", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [{ name: "token0", type: "address" }, { name: "token1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickLower", type: "int24" }, { name: "tickUpper", type: "int24" }, { name: "amount0Desired", type: "uint256" }, { name: "amount1Desired", type: "uint256" }, { name: "amount0Min", type: "uint256" }, { name: "amount1Min", type: "uint256" }, { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" }] }], outputs: [{ name: "tokenId", type: "uint256" }, { name: "liquidity", type: "uint128" }, { name: "amount0", type: "uint256" }, { name: "amount1", type: "uint256" }] },
  { type: "function", name: "decreaseLiquidity", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [{ name: "tokenId", type: "uint256" }, { name: "liquidity", type: "uint128" }, { name: "amount0Min", type: "uint256" }, { name: "amount1Min", type: "uint256" }, { name: "deadline", type: "uint256" }] }], outputs: [{ name: "amount0", type: "uint256" }, { name: "amount1", type: "uint256" }] },
  { type: "function", name: "collect", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [{ name: "tokenId", type: "uint256" }, { name: "recipient", type: "address" }, { name: "amount0Max", type: "uint128" }, { name: "amount1Max", type: "uint128" }] }], outputs: [{ name: "amount0", type: "uint256" }, { name: "amount1", type: "uint256" }] },
] as const;

const FACTORY_ABI = [
  { type: "function", name: "getPool", stateMutability: "view", inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "fee", type: "uint24" }], outputs: [{ type: "address" }] },
  { type: "function", name: "createPool", stateMutability: "nonpayable", inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "fee", type: "uint24" }], outputs: [{ type: "address" }] },
] as const;

const POOL_ABI = [
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ name: "sqrtPriceX96", type: "uint160" }, { name: "tick", type: "int24" }, { name: "observationIndex", type: "uint16" }, { name: "observationCardinality", type: "uint16" }, { name: "observationCardinalityNext", type: "uint16" }, { name: "feeProtocol", type: "uint8" }, { name: "unlocked", type: "bool" }] },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ type: "uint24" }] },
] as const;

const TABS = ["Add Liquidity", "My Positions"] as const;
type Tab = (typeof TABS)[number];

function CLMMPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Add Liquidity");
  const { address } = useAccount();

  return (
    <AppShell>
      <div className="max-w-[800px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="mb-7">
          <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>CLMM</h1>
          <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
            Concentrated liquidity · Select price range · Earn trading fees · Powered by Capricorn
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
          </div>
        ) : (
          <>
            {activeTab === "Add Liquidity" && <AddLiquidityTab />}
            {activeTab === "My Positions" && <MyPositionsTab />}
          </>
        )}

        <div className="mt-8 rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.2)", background: "rgba(155,127,212,0.03)" }}>
          <p className="font-mono text-[9px] uppercase tracking-wider mb-3" style={{ color: "rgba(196,168,240,0.4)" }}>How CLMM works</p>
          <div className="space-y-2 font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.6)" }}>
            <p>• Choose a token pair and fee tier (0.05%, 0.3%, or 1%)</p>
            <p>• Set your price range — narrower range = more fees but more risk</p>
            <p>• Your liquidity only earns fees when price is in your range</p>
            <p>• Positions are NFTs — transferable and composable</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function AddLiquidityTab() {
  const { address } = useAccount();
  const { toast } = useToast();
  const publicClient = usePublicClient();
  const [token0, setToken0] = useState("");
  const [token1, setToken1] = useState("");
  const [fee, setFee] = useState("3000");
  const [tickLower, setTickLower] = useState("-887220");
  const [tickUpper, setTickUpper] = useState("887220");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);

  // Approve token0
  const approve0Tx = useWriteContract();
  const approve0Rcpt = useWaitForTransactionReceipt({ hash: approve0Tx.data });
  // Approve token1
  const approve1Tx = useWriteContract();
  const approve1Rcpt = useWaitForTransactionReceipt({ hash: approve1Tx.data });
  // Mint position
  const mintTx = useWriteContract();
  const mintRcpt = useWaitForTransactionReceipt({ hash: mintTx.data });

  useEffect(() => { if (mintRcpt.isSuccess) setSuccessOpen(true); }, [mintRcpt.isSuccess]);

  const handleApprove0 = () => {
    if (!token0 || !amount0) return;
    approve0Tx.writeContract({ address: token0 as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [CAPRICORN.positionManager, parseUnits(amount0, 18)], gas: 100000n });
  };

  const handleApprove1 = () => {
    if (!token1 || !amount1) return;
    approve1Tx.writeContract({ address: token1 as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [CAPRICORN.positionManager, parseUnits(amount1, 18)], gas: 100000n });
  };

  const handleMint = () => {
    if (!token0 || !token1 || !amount0 || !amount1 || !address) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    mintTx.writeContract({
      address: CAPRICORN.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: "mint",
      args: [{
        token0: token0 as `0x${string}`,
        token1: token1 as `0x${string}`,
        fee: parseInt(fee),
        tickLower: parseInt(tickLower),
        tickUpper: parseInt(tickUpper),
        amount0Desired: parseUnits(amount0, 18),
        amount1Desired: parseUnits(amount1, 18),
        amount0Min: 0n,
        amount1Min: 0n,
        recipient: address,
        deadline,
      }],
      gas: 1000000n,
    });
  };

  const fees = [{ label: "0.05%", value: "500" }, { label: "0.3%", value: "3000" }, { label: "1%", value: "10000" }];

  return (
    <>
      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} title="CLMM" heading="Position Created" subtext="Your concentrated liquidity position is now active." rows={[{ label: "Pair", value: `${token0.slice(0,6)}.../${token1.slice(0,6)}...` }, { label: "Fee", value: fees.find(f => f.value === fee)?.label || fee }]} />

      <div className="rounded-xl p-6" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}>
        <h3 className="font-grotesk text-[15px] font-medium mb-5" style={{ color: "#EDE0FF" }}>Add Concentrated Liquidity</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Token 0 Address" value={token0} onChange={setToken0} placeholder="0x..." />
            <Field label="Token 1 Address" value={token1} onChange={setToken1} placeholder="0x..." />
          </div>

          <div>
            <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: "rgba(196,168,240,0.55)" }}>Fee Tier</label>
            <div className="flex gap-2">
              {fees.map((f) => (
                <button key={f.value} onClick={() => setFee(f.value)}
                  className="px-4 py-2 rounded-lg font-mono text-[11px] transition"
                  style={{ background: fee === f.value ? "rgba(155,127,212,0.3)" : "rgba(155,127,212,0.08)", border: `1px solid ${fee === f.value ? "rgba(155,127,212,0.6)" : "rgba(155,127,212,0.2)"}`, color: fee === f.value ? "#EDE0FF" : "rgba(196,168,240,0.5)" }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tick Lower" value={tickLower} onChange={setTickLower} placeholder="-887220" />
            <Field label="Tick Upper" value={tickUpper} onChange={setTickUpper} placeholder="887220" />
          </div>
          <p className="font-mono text-[9px]" style={{ color: "rgba(196,168,240,0.4)" }}>Full range: -887220 to 887220. Narrower = more concentrated.</p>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount Token 0" value={amount0} onChange={(v) => setAmount0(v.replace(/[^0-9.]/g, ""))} placeholder="100" />
            <Field label="Amount Token 1" value={amount1} onChange={(v) => setAmount1(v.replace(/[^0-9.]/g, ""))} placeholder="100" />
          </div>

          <div className="flex gap-2">
            <button onClick={handleApprove0} disabled={!token0 || !amount0 || approve0Tx.isPending || approve0Rcpt.isLoading}
              className="flex-1 rounded-xl py-2.5 font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
              style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
              {approve0Tx.isPending ? "..." : approve0Rcpt.isSuccess ? "✓ Token 0" : "Approve Token 0"}
            </button>
            <button onClick={handleApprove1} disabled={!token1 || !amount1 || approve1Tx.isPending || approve1Rcpt.isLoading}
              className="flex-1 rounded-xl py-2.5 font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
              style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
              {approve1Tx.isPending ? "..." : approve1Rcpt.isSuccess ? "✓ Token 1" : "Approve Token 1"}
            </button>
          </div>

          <button onClick={handleMint} disabled={!token0 || !token1 || !amount0 || !amount1 || mintTx.isPending || mintRcpt.isLoading}
            className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-40"
            style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
            {mintTx.isPending || mintRcpt.isLoading ? "Creating Position..." : "Add Liquidity"}
          </button>

          {mintTx.error && <p className="font-mono text-[10px]" style={{ color: "rgba(255,100,100,0.9)" }}>{(mintTx.error as any)?.shortMessage || mintTx.error.message}</p>}
        </div>
      </div>
    </>
  );
}

function MyPositionsTab() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !publicClient) return;
    let cancelled = false;

    (async () => {
      try {
        const balance = await publicClient.readContract({ address: CAPRICORN.positionManager, abi: POSITION_MANAGER_ABI, functionName: "balanceOf", args: [address] });
        const count = Number(balance);
        const pos: any[] = [];

        for (let i = 0; i < count; i++) {
          const tokenId = await publicClient.readContract({ address: CAPRICORN.positionManager, abi: POSITION_MANAGER_ABI, functionName: "tokenOfOwnerByIndex", args: [address, BigInt(i)] });
          const data = await publicClient.readContract({ address: CAPRICORN.positionManager, abi: POSITION_MANAGER_ABI, functionName: "positions", args: [tokenId] });
          pos.push({ tokenId, ...data });
        }

        if (!cancelled) { setPositions(pos); setLoading(false); }
      } catch (e) {
        console.error("Failed to fetch positions:", e);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address, publicClient]);

  if (loading) {
    return <div className="text-center py-12"><div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: "rgba(155,127,212,0.2)", borderTopColor: "rgba(155,127,212,0.8)" }} /></div>;
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <BarChart2 className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(196,168,240,0.4)" }} strokeWidth={1.5} />
        <p className="font-grotesk text-[14px]" style={{ color: "#EDE0FF" }}>No Positions</p>
        <p className="font-mono text-[11px] mt-1" style={{ color: "rgba(196,168,240,0.5)" }}>Add liquidity to create a position.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((pos, i) => (
        <PositionCard key={i} position={pos} />
      ))}
    </div>
  );
}

function PositionCard({ position }: { position: any }) {
  const { address } = useAccount();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const collectTx = useWriteContract();
  const collectRcpt = useWaitForTransactionReceipt({ hash: collectTx.data });

  useEffect(() => { if (collectRcpt.isSuccess) toast("success", "Fees collected!", "Earned fees sent to your wallet."); }, [collectRcpt.isSuccess]);

  const handleCollect = () => {
    if (!address) return;
    collectTx.writeContract({
      address: CAPRICORN.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: "collect",
      args: [{ tokenId: position.tokenId, recipient: address, amount0Max: BigInt("340282366920938463463374607431768211455"), amount1Max: BigInt("340282366920938463463374607431768211455") }],
      gas: 300000n,
    });
  };

  const token0Short = position.token0 ? `${position.token0.slice(0, 6)}...${position.token0.slice(-4)}` : "?";
  const token1Short = position.token1 ? `${position.token1.slice(0, 6)}...${position.token1.slice(-4)}` : "?";
  const hasLiquidity = position.liquidity > 0n;

  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.04)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-grotesk text-[14px] font-medium" style={{ color: "#EDE0FF" }}>
            #{position.tokenId?.toString()} · {token0Short} / {token1Short}
          </p>
          <p className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(196,168,240,0.5)" }}>
            Fee: {Number(position.fee) / 10000}% · Ticks: {position.tickLower?.toString()} → {position.tickUpper?.toString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasLiquidity && (
            <button onClick={handleCollect} disabled={collectTx.isPending}
              className="px-3 py-1.5 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
              style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
              {collectTx.isPending ? "..." : "Collect Fees"}
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[rgba(155,127,212,0.15)]"
            style={{ color: "rgba(196,168,240,0.5)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 font-mono text-[10px] space-y-1" style={{ borderTop: "1px solid rgba(155,127,212,0.12)", color: "rgba(196,168,240,0.6)" }}>
          <p>Liquidity: {position.liquidity?.toString()}</p>
          <p>Token 0: {position.token0}</p>
          <p>Token 1: {position.token1}</p>
          <p>Fees owed: {position.tokensOwed0?.toString()} / {position.tokensOwed1?.toString()}</p>
        </div>
      )}
    </div>
  );
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
