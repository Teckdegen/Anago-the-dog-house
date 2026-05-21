import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { BarChart2, Droplets } from "lucide-react";
import { useAccount, useReadContract, usePublicClient, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { ERC20_ABI } from "@/lib/web3/contracts";

export const Route = createFileRoute("/clmm")({
  component: CLMMPage,
  head: () => ({ meta: [{ title: "CLMM Pools — The Dog House" }, { name: "description", content: "Concentrated liquidity pools on Monad." }] }),
});

// Capricorn CL testnet contracts
const CAPRICORN_FACTORY = "0xd0a37cf728CE2902eB8d4F6f2afc76854048253b" as const;
const CAPRICORN_POSITION_MANAGER = "0x311819d339B87a10cc4Bbf137d5A0F233Ab56Ad7" as const;

const FACTORY_ABI = [
  { type: "function", name: "getPool", stateMutability: "view", inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "fee", type: "uint24" }], outputs: [{ type: "address" }] },
] as const;

const POOL_ABI = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ type: "uint24" }] },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ name: "sqrtPriceX96", type: "uint160" }, { name: "tick", type: "int24" }, { name: "observationIndex", type: "uint16" }, { name: "observationCardinality", type: "uint16" }, { name: "observationCardinalityNext", type: "uint16" }, { name: "feeProtocol", type: "uint8" }, { name: "unlocked", type: "bool" }] },
] as const;

// Known pools on Capricorn testnet (we'll fetch their data)
const KNOWN_POOLS = [
  { address: "0x0000000000000000000000000000000000000000", token0: "MON", token1: "USDC", fee: 3000 },
];

type PoolData = {
  address: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  fee: number;
  liquidity: string;
  tvl: string;
};

function CLMMPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [customPool, setCustomPool] = useState("");

  useEffect(() => {
    if (!publicClient) return;
    setLoading(false);
    // Pools will be loaded when user enters addresses or we add known pools
  }, [publicClient]);

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        {/* Header */}
        <div className="mb-7">
          <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>CLMM Pools</h1>
          <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
            Concentrated liquidity · Provide liquidity in custom price ranges · Earn trading fees
          </p>
        </div>

        {/* Pool lookup */}
        <div className="rounded-xl p-5 mb-6" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}>
          <p className="font-grotesk text-[13px] font-medium mb-3" style={{ color: "#EDE0FF" }}>Enter Pool Address</p>
          <div className="flex gap-3">
            <input type="text" value={customPool} onChange={(e) => setCustomPool(e.target.value)} placeholder="0x... (Capricorn CL pool address)"
              className="flex-1 rounded-xl px-4 py-2.5 font-mono text-[12px] outline-none"
              style={{ background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.3)", color: "#EDE0FF" }} />
            {customPool.length === 42 && (
              <Link to={`/clmm`} search={{ pool: customPool }}
                className="px-5 py-2.5 rounded-xl font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-90"
                style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}>
                View Pool
              </Link>
            )}
          </div>
          <p className="font-mono text-[9px] mt-2" style={{ color: "rgba(196,168,240,0.4)" }}>
            Powered by Capricorn CL · Factory: {CAPRICORN_FACTORY.slice(0, 10)}...
          </p>
        </div>

        {/* Pool detail view if pool is selected */}
        {customPool.length === 42 ? (
          <PoolDetail poolAddress={customPool as `0x${string}`} />
        ) : (
          /* Info cards */
          <div className="grid sm:grid-cols-3 gap-4">
            <InfoCard title="Concentrated Liquidity" desc="Provide liquidity in custom price ranges for higher capital efficiency" />
            <InfoCard title="Earn Trading Fees" desc="Earn fees proportional to your share of liquidity in the active range" />
            <InfoCard title="NFT Positions" desc="Each LP position is an NFT — transferable and composable" />
          </div>
        )}

        {/* Contract info */}
        <div className="mt-8 rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.15)", background: "rgba(155,127,212,0.02)" }}>
          <p className="font-mono text-[9px] uppercase tracking-wider mb-3" style={{ color: "rgba(196,168,240,0.4)" }}>Capricorn CL Contracts (Testnet)</p>
          <div className="grid sm:grid-cols-2 gap-2 font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.5)" }}>
            <p>Factory: <span style={{ color: "#C4A8F0" }}>{CAPRICORN_FACTORY.slice(0, 18)}...</span></p>
            <p>Position Manager: <span style={{ color: "#C4A8F0" }}>{CAPRICORN_POSITION_MANAGER.slice(0, 18)}...</span></p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PoolDetail({ poolAddress }: { poolAddress: `0x${string}` }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [poolData, setPoolData] = useState<any>(null);
  const [token0Sym, setToken0Sym] = useState("...");
  const [token1Sym, setToken1Sym] = useState("...");

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    async function load() {
      try {
        const [token0, token1, fee, liquidity, slot0] = await Promise.all([
          publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "token0" }),
          publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "token1" }),
          publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "fee" }),
          publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "liquidity" }),
          publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "slot0" }),
        ]);

        if (cancelled) return;
        setPoolData({ token0, token1, fee, liquidity, slot0 });

        // Fetch symbols
        const [sym0, sym1] = await Promise.all([
          publicClient.readContract({ address: token0 as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "???"),
          publicClient.readContract({ address: token1 as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "???"),
        ]);
        if (!cancelled) { setToken0Sym(sym0 as string); setToken1Sym(sym1 as string); }
      } catch (e) {
        console.error("Failed to load pool:", e);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [poolAddress, publicClient]);

  if (!poolData) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ border: "1px solid rgba(155,127,212,0.35)" }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto mb-3" style={{ borderColor: "rgba(155,127,212,0.2)", borderTopColor: "rgba(155,127,212,0.8)" }} />
        <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.5)" }}>Loading pool data...</p>
      </div>
    );
  }

  const feePct = Number(poolData.fee) / 10000;
  const tick = Number(poolData.slot0[1]);

  return (
    <div className="space-y-4">
      {/* Pool header */}
      <div className="rounded-xl p-6" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-grotesk text-[20px] font-medium" style={{ color: "#EDE0FF" }}>{token0Sym} / {token1Sym}</p>
            <p className="font-mono text-[10px] mt-1" style={{ color: "rgba(196,168,240,0.5)" }}>
              Fee: {feePct}% · Tick: {tick} · Pool: {poolAddress.slice(0, 10)}...
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-lg font-mono text-[10px]" style={{ background: "rgba(155,127,212,0.15)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.3)" }}>
            {feePct}% fee
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.4)" }}>Liquidity</p>
            <p className="font-mono text-[14px] mt-1" style={{ color: "#EDE0FF" }}>{Number(poolData.liquidity).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.4)" }}>Current Tick</p>
            <p className="font-mono text-[14px] mt-1" style={{ color: "#EDE0FF" }}>{tick}</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.4)" }}>Token Pair</p>
            <p className="font-mono text-[14px] mt-1" style={{ color: "#EDE0FF" }}>{token0Sym}/{token1Sym}</p>
          </div>
        </div>
      </div>

      {/* Add liquidity section */}
      <div className="rounded-xl p-6" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}>
        <p className="font-grotesk text-[14px] font-medium mb-4" style={{ color: "#EDE0FF" }}>Add Liquidity</p>
        <p className="font-mono text-[10px] mb-4" style={{ color: "rgba(196,168,240,0.5)" }}>
          To add liquidity, interact with the Capricorn NonfungiblePositionManager at:
        </p>
        <p className="font-mono text-[11px] p-3 rounded-lg" style={{ background: "rgba(155,127,212,0.08)", color: "#C4A8F0", border: "1px solid rgba(155,127,212,0.2)" }}>
          {CAPRICORN_POSITION_MANAGER}
        </p>
        <p className="font-mono text-[9px] mt-3" style={{ color: "rgba(196,168,240,0.4)" }}>
          Use mint() with your desired tick range and amounts. Each position is an NFT.
        </p>
      </div>
    </div>
  );
}

function InfoCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.25)", background: "rgba(155,127,212,0.03)" }}>
      <Droplets className="w-5 h-5 mb-3" style={{ color: "#C4A8F0" }} strokeWidth={1.5} />
      <p className="font-grotesk text-[12px] font-medium mb-1" style={{ color: "#EDE0FF" }}>{title}</p>
      <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.5)" }}>{desc}</p>
    </div>
  );
}
