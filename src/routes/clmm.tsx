import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Droplets, Layers, RefreshCw, Search } from "lucide-react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { TokenIcon } from "@/components/TokenIcon";
import { PositionCards } from "@/components/clmm/PositionCards";
import {
  isUniswapSupportedChain,
  loadPoolCache,
  discoverPoolsIncremental,
  feeToPercent,
  fetchUserPositions,
  UNISWAP_V3,
  type CachedPool,
  type LpPosition,
} from "@/lib/uniswap";

export const Route = createFileRoute("/clmm")({
  component: CLMMPage,
  head: () => ({
    meta: [
      { title: "CLMM — Uniswap V3 on Monad" },
      { name: "description", content: "Trade and explore Uniswap V3 concentrated liquidity pools on Monad." },
    ],
  }),
});

type ClmmView = "pools" | "positions";

function CLMMPage() {
  const chainId = useChainId();
  const supported = isUniswapSupportedChain(chainId);
  const { address } = useAccount();

  const [pools, setPools] = useState<CachedPool[]>(() => loadPoolCache()?.pools ?? []);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [poolSearch, setPoolSearch] = useState("");
  const [view, setView] = useState<ClmmView>("pools");
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const [posMsg, setPosMsg] = useState("");

  const publicClient = usePublicClient();

  const syncPools = useCallback(async () => {
    if (!publicClient || !supported) return;
    setSyncing(true);
    try {
      const result = await discoverPoolsIncremental(publicClient, setSyncMsg);
      setPools(result.pools);
      setSyncMsg(
        result.newPools > 0
          ? `Synced ${result.newPools} new pools (block ${result.lastIndexedBlock.toString()})`
          : `Up to date at block ${result.lastIndexedBlock.toString()}`,
      );
    } catch (e) {
      console.error(e);
      setSyncMsg("Sync failed — try again");
    } finally {
      setSyncing(false);
    }
  }, [publicClient, supported]);

  useEffect(() => {
    if (supported && publicClient && pools.length === 0) {
      syncPools();
    }
  }, [supported, publicClient]);

  const refreshPositions = useCallback(async () => {
    if (!publicClient || !address) return;
    setLoadingPos(true);
    try {
      const all = await fetchUserPositions(publicClient, address, setPosMsg);
      setPositions(all);
    } finally {
      setLoadingPos(false);
      setPosMsg("");
    }
  }, [publicClient, address]);

  useEffect(() => {
    if (view === "positions" && address) refreshPositions();
  }, [view, address, refreshPositions]);

  const filteredPools = useMemo(() => {
    if (!poolSearch) return pools;
    const q = poolSearch.toLowerCase();
    return pools.filter(
      (p) =>
        p.address.toLowerCase().includes(q) ||
        p.token0.toLowerCase().includes(q) ||
        p.token1.toLowerCase().includes(q),
    );
  }, [pools, poolSearch]);

  if (!supported) {
    return (
      <AppShell>
        <div className="max-w-[680px] mx-auto px-5 pt-12 pb-20 text-center">
          <p className="font-grotesk text-[18px] uppercase" style={{ color: "#EDE0FF" }}>
            Switch to Monad Mainnet
          </p>
          <p className="font-mono text-[11px] mt-3" style={{ color: "rgba(196,168,240,0.55)" }}>
            Uniswap V3 CLMM uses official deployments on chain <strong>143</strong>. Connect wallet and select Monad in your wallet app.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-grotesk uppercase text-[22px] sm:text-[28px] leading-none tracking-tight" style={{ color: "#EDE0FF" }}>
              Uniswap V3 CLMM
            </h1>
            <p className="font-mono text-[10px] mt-1 tracking-wide" style={{ color: "rgba(196,168,240,0.55)" }}>
              Trade · add liquidity · claim fees · DexScreener logos
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex p-1 rounded-xl" style={{ background: "rgba(155,127,212,0.1)", border: "1px solid rgba(155,127,212,0.25)" }}>
              <button
                onClick={() => setView("pools")}
                className="px-3 py-1.5 rounded-lg font-grotesk text-[10px] uppercase flex items-center gap-1"
                style={{
                  background: view === "pools" ? "rgba(155,127,212,0.25)" : "transparent",
                  color: view === "pools" ? "#EDE0FF" : "rgba(196,168,240,0.5)",
                }}
              >
                <Droplets className="w-3.5 h-3.5" /> Pools
              </button>
              <button
                onClick={() => setView("positions")}
                className="px-3 py-1.5 rounded-lg font-grotesk text-[10px] uppercase flex items-center gap-1"
                style={{
                  background: view === "positions" ? "rgba(155,127,212,0.25)" : "transparent",
                  color: view === "positions" ? "#EDE0FF" : "rgba(196,168,240,0.5)",
                }}
              >
                <Layers className="w-3.5 h-3.5" /> My Positions
              </button>
            </div>
            <button
              onClick={syncPools}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-40"
              style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.4)", color: "#EDE0FF" }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Pools"}
            </button>
          </div>
        </div>

        {syncMsg && (
          <p className="font-mono text-[10px] mb-4" style={{ color: "rgba(196,168,240,0.5)" }}>
            {syncMsg} · {pools.length} pools cached
          </p>
        )}

        {view === "pools" ? (
          <div
            className="rounded-xl overflow-hidden flex flex-col min-h-[480px] max-w-3xl"
            style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.03)" }}
          >
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(155,127,212,0.2)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(196,168,240,0.45)" }} />
              <input
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="Search by address or token…"
                className="flex-1 bg-transparent font-mono text-[11px] outline-none"
                style={{ color: "#EDE0FF" }}
              />
            </div>
            <div className="flex-1 overflow-y-auto max-h-[640px]">
              {filteredPools.length === 0 ? (
                <div className="py-16 text-center px-4">
                  <Droplets className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: "#C4A8F0" }} />
                  <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.5)" }}>
                    {syncing ? "Discovering pools from Factory events…" : "No pools yet — click Sync Pools"}
                  </p>
                </div>
              ) : (
                filteredPools.map((p) => <PoolListRow key={p.address} pool={p} />)
              )}
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl p-5 max-w-3xl"
            style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.04)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-grotesk text-[13px] uppercase" style={{ color: "#EDE0FF" }}>
                My LP positions
              </p>
              <button
                onClick={refreshPositions}
                disabled={loadingPos || !address}
                className="font-mono text-[9px] px-3 py-1 rounded-lg uppercase disabled:opacity-40"
                style={{ border: "1px solid rgba(155,127,212,0.35)", color: "#C4A8F0" }}
              >
                {loadingPos ? "Scanning NFTs…" : "Refresh"}
              </button>
            </div>
            {posMsg && (
              <p className="font-mono text-[9px] mb-3" style={{ color: "rgba(196,168,240,0.45)" }}>{posMsg}</p>
            )}
            <PositionCards
              positions={positions}
              loading={loadingPos}
              emptyLabel="No positions — open a pool to add liquidity or refresh after minting"
              onRefresh={refreshPositions}
            />
          </div>
        )}

        <ContractsFooter />
      </div>
    </AppShell>
  );
}

function PoolListRow({ pool }: { pool: CachedPool }) {
  return (
    <Link
      to="/clmm/pool/$poolAddress"
      params={{ poolAddress: pool.address }}
      className="block w-full text-left px-4 py-3 transition hover:bg-[rgba(155,127,212,0.06)]"
      style={{ borderBottom: "1px solid rgba(155,127,212,0.1)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TokenIcon address={pool.token0} size={22} />
          <span className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.5)" }}>/</span>
          <TokenIcon address={pool.token1} size={22} />
        </div>
        <span
          className="font-mono text-[9px] px-1.5 py-0.5 rounded shrink-0"
          style={{ background: "rgba(155,127,212,0.12)", color: "#C4A8F0" }}
        >
          {feeToPercent(pool.fee)}
        </span>
      </div>
      <p className="font-mono text-[9px] mt-1 truncate" style={{ color: "rgba(196,168,240,0.4)" }}>
        {pool.address}
      </p>
    </Link>
  );
}

function ContractsFooter() {
  return (
    <div className="rounded-xl p-4 mt-6 max-w-3xl" style={{ border: "1px solid rgba(155,127,212,0.15)", background: "rgba(155,127,212,0.02)" }}>
      <p className="font-mono text-[8px] uppercase tracking-wider mb-2" style={{ color: "rgba(196,168,240,0.4)" }}>
        Uniswap V3 on Monad
      </p>
      <div className="space-y-1 font-mono text-[9px] break-all" style={{ color: "rgba(196,168,240,0.45)" }}>
        <p>Factory: {UNISWAP_V3.factory}</p>
        <p>QuoterV2: {UNISWAP_V3.quoterV2}</p>
        <p>SwapRouter02: {UNISWAP_V3.swapRouter02}</p>
        <p>UniversalRouter: {UNISWAP_V3.universalRouter}</p>
      </div>
    </div>
  );
}
