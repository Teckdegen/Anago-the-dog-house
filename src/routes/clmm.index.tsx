import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PositionCards } from "@/components/clmm/PositionCards";
import { PoolsExploreTable } from "@/components/clmm/PoolsExploreTable";
import { clmm } from "@/components/clmm/clmmTheme";
import { useClmmPoolsPage } from "@/hooks/useClmmPoolsPage";
import { isCapricornSupportedChain, fetchUserPositions, type LpPosition } from "@/lib/capricorn";

export const Route = createFileRoute("/clmm/")({
  component: CLMMExplorePage,
  head: () => ({
    meta: [
      { title: "Explore Pools — Capricorn CL" },
      { name: "description", content: "Explore Capricorn concentrated liquidity pools on Monad." },
    ],
  }),
});

type ClmmView = "explore" | "positions";
type SortKey = "tvl" | "apr" | "vol";

const PAGE_SIZE = 50;
const POSITION_POLL_MS = 25_000;

function CLMMExplorePage() {
  const chainId = useChainId();
  const supported = isCapricornSupportedChain(chainId);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [view, setView] = useState<ClmmView>("explore");
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);

  const [page, setPage] = useState(1);
  const [poolSearch, setPoolSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tvl");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(poolSearch);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [poolSearch]);

  const poolsQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort: sortKey,
      order: (sortDesc ? "desc" : "asc") as "desc" | "asc",
      q: searchDebounced,
    }),
    [page, sortKey, sortDesc, searchDebounced],
  );

  const { rows, total, totalPages, loading, error, reload } = useClmmPoolsPage(
    poolsQuery,
    view === "explore",
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
    setPage(1);
  };

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
      <div className="w-full px-5 sm:px-8 lg:px-14 pt-8 pb-20 min-h-screen" style={{ background: clmm.bg }}>
        <header className="mb-8">
          <h1 className="font-grotesk text-[26px] sm:text-[32px] font-medium" style={{ color: clmm.text }}>
            Explore pools
          </h1>
          <p className="font-mono text-[11px] mt-1" style={{ color: clmm.textMuted }}>
            Capricorn CL on Monad · {total > 0 ? `${total.toLocaleString()} pools` : "loading on-chain metrics"}
          </p>
        </header>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex gap-6">
            <TabBtn active={view === "explore"} onClick={() => setView("explore")}>
              Pools
            </TabBtn>
            <TabBtn active={view === "positions"} onClick={() => setView("positions")}>
              Your positions
            </TabBtn>
          </div>

          {view === "explore" && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-full sm:max-w-xs w-full sm:w-auto"
              style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}
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
        </div>

        {view === "explore" ? (
          <ExplorePoolsView
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            sortKey={sortKey}
            sortDesc={sortDesc}
            onSort={handleSort}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        ) : (
          <PositionsView positions={positions} loading={loadingPos} />
        )}
      </div>
    </AppShell>
  );
}

function ExplorePoolsView({
  rows,
  loading,
  error,
  onRetry,
  sortKey,
  sortDesc,
  onSort,
  page,
  totalPages,
  total,
  onPageChange,
}: {
  rows: import("@/lib/capricorn/poolMetrics").EnrichedPool[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  sortKey: SortKey;
  sortDesc: boolean;
  onSort: (key: SortKey) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (error) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="font-mono text-[11px]" style={{ color: "rgba(255,120,120,0.9)" }}>
          {error}
        </p>
        <p className="font-mono text-[10px] max-w-md mx-auto" style={{ color: clmm.textMuted }}>
          Check your RPC connection and try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="font-mono text-[10px] uppercase px-4 py-2 rounded-full"
          style={{ border: `1px solid ${clmm.border}`, color: clmm.text }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="py-20 text-center font-mono text-[11px]" style={{ color: clmm.textMuted }}>
        No pools match your search.
      </div>
    );
  }

  const rankOffset = (page - 1) * PAGE_SIZE;

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center gap-2 font-mono text-[9px]" style={{ color: clmm.textMuted }}>
          <Loader2 className="w-3 h-3 animate-spin" style={{ color: clmm.purple }} />
          Loading page {page}…
        </div>
      )}
      <PoolsExploreTable
        rows={rows}
        sortKey={sortKey}
        sortDesc={sortDesc}
        onSort={onSort}
        rankOffset={rankOffset}
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="font-mono text-[10px]" style={{ color: clmm.textDim }}>
            Page {page} of {totalPages} · {total.toLocaleString()} pools
          </p>
          <div className="flex gap-2">
            <PaginationBtn disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </PaginationBtn>
            <PaginationBtn
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </PaginationBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationBtn({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="p-2 rounded-lg transition disabled:opacity-30"
      style={{ border: `1px solid ${clmm.border}`, color: clmm.text }}
    >
      {children}
    </button>
  );
}

function PositionsView({ positions, loading }: { positions: LpPosition[]; loading: boolean }) {
  return (
    <div className="rounded-2xl p-5 sm:p-8 min-h-[420px]" style={{ border: `1px solid ${clmm.border}`, background: clmm.panel }}>
      <PositionCards
        positions={positions}
        loading={loading}
        emptyLabel="No LP positions yet — explore pools and add liquidity"
        layout="grid"
      />
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
      className="font-grotesk text-[15px] pb-2 transition relative"
      style={{
        color: active ? clmm.text : clmm.textMuted,
        borderBottom: active ? `2px solid ${clmm.purple}` : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}
