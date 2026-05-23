import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PositionCards } from "@/components/clmm/PositionCards";
import { PoolsExploreTable } from "@/components/clmm/PoolsExploreTable";
import { clmm } from "@/components/clmm/clmmTheme";
import { useEnrichedPools } from "@/hooks/useEnrichedPools";
import {
  isUniswapSupportedChain,
  loadPoolCache,
  getSeedPools,
  discoverPoolsIncremental,
  loadLocalV4Pools,
  fetchUserPositions,
  getMonadPublicClient,
  type LpPosition,
} from "@/lib/uniswap";

export const Route = createFileRoute("/clmm/")({
  component: CLMMExplorePage,
  head: () => ({
    meta: [
      { title: "Explore Pools — Uniswap V4" },
      { name: "description", content: "Explore Uniswap V4 concentrated liquidity pools on Monad." },
    ],
  }),
});

type ClmmView = "explore" | "positions";

const POSITION_POLL_MS = 25_000;

function CLMMExplorePage() {
  const chainId = useChainId();
  const supported = isUniswapSupportedChain(chainId);
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [pools, setPools] = useState(() => {
    const local = loadLocalV4Pools();
    return local.length > 0 ? local : getSeedPools();
  });
  const [syncing, setSyncing] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const [view, setView] = useState<ClmmView>("explore");
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);

  const { rows, indexing, progress } = useEnrichedPools(pools, publicClient, supported);

  const syncPools = useCallback(async () => {
    if (!supported) return;
    setSyncing(true);
    try {
      const result = await discoverPoolsIncremental(getMonadPublicClient());
      setPools(result.pools);
    } catch (e) {
      console.error("CLMM pool sync:", e);
      const fallback = loadPoolCache().pools;
      if (fallback.length > 0) setPools(fallback);
    } finally {
      setSyncing(false);
    }
  }, [supported]);

  useEffect(() => {
    if (supported) syncPools();
  }, [supported, syncPools]);

  const filteredRows = useMemo(() => {
    if (!poolSearch.trim()) return rows;
    const q = poolSearch.toLowerCase();
    return rows.filter(
      (r) =>
        r.address.toLowerCase().includes(q) ||
        r.metrics.symbol0.toLowerCase().includes(q) ||
        r.metrics.symbol1.toLowerCase().includes(q) ||
        r.metrics.displayId.toLowerCase().includes(q) ||
        (r.protocol ?? "v4").includes(q),
    );
  }, [rows, poolSearch]);

  const loadPositions = useCallback(async () => {
    if (!publicClient || !address || !supported) return;
    setLoadingPos(true);
    try {
      setPositions(await fetchUserPositions(publicClient, address));
    } finally {
      setLoadingPos(false);
    }
  }, [publicClient, address, supported]);

  useEffect(() => {
    if (view !== "positions" || !address || !supported) return;
    loadPositions();
    const id = setInterval(loadPositions, POSITION_POLL_MS);
    return () => clearInterval(id);
  }, [view, address, supported, loadPositions]);

  return (
    <AppShell>
      <div className="w-full px-5 sm:px-8 lg:px-14 pt-8 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex gap-6 border-b sm:border-b-0" style={{ borderColor: clmm.border }}>
            <TabBtn active={view === "explore"} onClick={() => setView("explore")}>
              Explore pools{pools.length > 0 ? ` (${pools.length})` : ""}
            </TabBtn>
            <TabBtn active={view === "positions"} onClick={() => setView("positions")}>
              Your positions
            </TabBtn>
          </div>

          {view === "explore" && (
            <div className="flex items-center gap-2 flex-1 sm:max-w-md sm:ml-auto">
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
            </div>
          )}
        </div>

        {view === "explore" ? (
          filteredRows.length === 0 && !indexing ? (
            <div className="py-20 text-center font-mono text-[11px]" style={{ color: clmm.textMuted }}>
              {syncing
                ? "Loading pools…"
                : pools.length === 0
                  ? "No pools in app — run npm run sync:pools (THE_GRAPH_API_KEY in .env.local)"
                  : "No pools match your search"}
            </div>
          ) : (
            <PoolsExploreTable rows={filteredRows} indexing={indexing} progress={progress} />
          )
        ) : (
          <PositionsView positions={positions} loading={loadingPos} />
        )}
      </div>
    </AppShell>
  );
}

function PositionsView({ positions, loading }: { positions: LpPosition[]; loading: boolean }) {
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-grotesk text-[22px] font-medium" style={{ color: clmm.text }}>
            Your LP positions
          </h2>
          <p className="font-mono text-[10px] mt-1" style={{ color: clmm.textDim }}>
            {positions.length} position{positions.length === 1 ? "" : "s"} · auto-updates every 25s
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 sm:p-8 min-h-[420px]"
        style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}
      >
        <PositionCards
          positions={positions}
          loading={loading}
          emptyLabel="No LP positions yet — explore pools and add liquidity"
          layout="grid"
        />
      </div>
    </div>
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
