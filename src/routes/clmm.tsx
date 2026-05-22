import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PositionCards } from "@/components/clmm/PositionCards";
import { PoolsExploreTable } from "@/components/clmm/PoolsExploreTable";
import { ClmmNetworkGate } from "@/components/clmm/SwitchToMonadMainnet";
import { clmm } from "@/components/clmm/clmmTheme";
import { useEnrichedPools } from "@/hooks/useEnrichedPools";
import {
  isUniswapSupportedChain,
  loadPoolCache,
  discoverPoolsIncremental,
  fetchUserPositions,
  UNISWAP_V3,
  type LpPosition,
} from "@/lib/uniswap";

export const Route = createFileRoute("/clmm")({
  component: CLMMPage,
  head: () => ({
    meta: [
      { title: "Explore Pools — Uniswap V3 CLMM" },
      { name: "description", content: "Explore concentrated liquidity pools on Monad." },
    ],
  }),
});

type ClmmView = "explore" | "positions";

function CLMMPage() {
  const chainId = useChainId();
  const supported = isUniswapSupportedChain(chainId);
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [pools, setPools] = useState(() => loadPoolCache()?.pools ?? []);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [poolSearch, setPoolSearch] = useState("");
  const [view, setView] = useState<ClmmView>("explore");
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);

  const { rows, indexing, progress, allCachedFresh, refreshMetrics } = useEnrichedPools(
    pools,
    publicClient,
    supported,
  );

  const syncPools = useCallback(async () => {
    if (!publicClient || !supported) return;
    setSyncing(true);
    try {
      const result = await discoverPoolsIncremental(publicClient, setSyncMsg);
      setPools(result.pools);
      setSyncMsg(
        result.newPools > 0
          ? `+${result.newPools} pools · block ${result.lastIndexedBlock}`
          : `Indexed · block ${result.lastIndexedBlock}`,
      );
    } catch {
      setSyncMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [publicClient, supported]);

  useEffect(() => {
    if (supported && publicClient && pools.length === 0) syncPools();
  }, [supported, publicClient, pools.length, syncPools]);

  const filteredRows = useMemo(() => {
    if (!poolSearch.trim()) return rows;
    const q = poolSearch.toLowerCase();
    return rows.filter(
      (r) =>
        r.address.toLowerCase().includes(q) ||
        r.metrics.symbol0.toLowerCase().includes(q) ||
        r.metrics.symbol1.toLowerCase().includes(q) ||
        r.metrics.displayId.toLowerCase().includes(q),
    );
  }, [rows, poolSearch]);

  const refreshPositions = useCallback(async () => {
    if (!publicClient || !address) return;
    setLoadingPos(true);
    try {
      setPositions(await fetchUserPositions(publicClient, address));
    } finally {
      setLoadingPos(false);
    }
  }, [publicClient, address]);

  useEffect(() => {
    if (view === "positions" && address) refreshPositions();
  }, [view, address, refreshPositions]);

  return (
    <AppShell>
      <ClmmNetworkGate>
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex gap-6 border-b sm:border-b-0" style={{ borderColor: clmm.border }}>
            <TabBtn active={view === "explore"} onClick={() => setView("explore")}>
              Explore pools
            </TabBtn>
            <TabBtn active={view === "positions"} onClick={() => setView("positions")}>
              Your positions
            </TabBtn>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:max-w-md sm:ml-auto">
            {view === "explore" && (
              <div
                className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-full"
                style={{ border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}
              >
                <Search className="w-4 h-4 shrink-0" style={{ color: clmm.textDim }} />
                <input
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  placeholder="Search pools"
                  className="flex-1 bg-transparent font-mono text-[11px] outline-none"
                  style={{ color: clmm.text }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                syncPools().then(() => refreshMetrics());
              }}
              disabled={syncing}
              title="Sync on-chain pool list"
              className="p-2.5 rounded-full shrink-0 disabled:opacity-40"
              style={{ border: `1px solid ${clmm.border}`, color: clmm.text }}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {syncMsg && view === "explore" && (
          <p className="font-mono text-[9px] mb-4 -mt-4" style={{ color: clmm.textDim }}>
            {syncMsg} · {pools.length} pools
            {allCachedFresh ? " · stats cache hot" : indexing ? ` · indexing ${progress.done}/${progress.total}` : ""}
          </p>
        )}

        {view === "explore" ? (
          filteredRows.length === 0 && !indexing ? (
            <div className="py-20 text-center font-mono text-[11px]" style={{ color: clmm.textMuted }}>
              {syncing ? "Discovering pools…" : "No pools — tap refresh to sync factory events"}
            </div>
          ) : (
            <PoolsExploreTable rows={filteredRows} indexing={indexing} progress={progress} />
          )
        ) : (
          <div className="rounded-2xl p-6 max-w-3xl" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={refreshPositions}
                disabled={loadingPos || !address}
                className="font-mono text-[9px] px-4 py-2 rounded-full uppercase disabled:opacity-40"
                style={{ border: `1px solid ${clmm.border}`, color: clmm.accent }}
              >
                {loadingPos ? "Scanning…" : "Refresh"}
              </button>
            </div>
            <PositionCards
              positions={positions}
              loading={loadingPos}
              emptyLabel="No LP positions — add liquidity from any pool"
              onRefresh={refreshPositions}
            />
          </div>
        )}

        <ContractsFooter />
      </div>
      </ClmmNetworkGate>
    </AppShell>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-grotesk text-[15px] sm:text-[17px] pb-3 sm:pb-0 transition relative"
      style={{
        color: active ? clmm.text : clmm.textMuted,
        borderBottom: active ? `2px solid ${clmm.accent}` : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function ContractsFooter() {
  return (
    <div
      className="rounded-xl p-4 mt-10 max-w-3xl font-mono text-[9px] space-y-1"
      style={{ color: clmm.textDim, border: `1px solid ${clmm.border}`, background: clmm.purpleBg }}
    >
      <p className="uppercase tracking-wider">Uniswap V3 · Monad</p>
      <p>Factory {UNISWAP_V3.factory}</p>
      <p>Pool stats cached 10m · second visit loads from localStorage instantly</p>
    </div>
  );
}
