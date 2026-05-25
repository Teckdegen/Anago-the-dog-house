import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { fetchPairDexStats, truncateAddress } from "@/lib/capricorn/poolMetrics";
import { fetchPoolSwapsFromApi, type PoolSwapRow } from "@/lib/web3/zerion";
import { clmm } from "./clmmTheme";

function formatTime(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function PoolTransactionsTable({
  poolAddress,
  token0Decimals,
  token1Decimals,
  symbol0,
  symbol1,
}: {
  poolAddress: `0x${string}`;
  token0Decimals: number;
  token1Decimals: number;
  symbol0: string;
  symbol1: string;
}) {
  const cols = ["Time", "Type", "USD", symbol0, symbol1, "Wallet"] as const;
  const [swaps, setSwaps] = useState<PoolSwapRow[]>([]);
  const [dexSummary, setDexSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchPoolSwapsFromApi(poolAddress, {
        limit: 40,
        decimals0: token0Decimals,
        decimals1: token1Decimals,
      }),
      fetchPairDexStats(poolAddress).catch(() => null),
    ])
      .then(([rows, dex]) => {
        if (cancelled) return;
        setSwaps(rows);
        if (dex?.buys24h != null || dex?.sells24h != null) {
          setDexSummary(
            `DexScreener 24h: ${dex.buys24h ?? 0} buys · ${dex.sells24h ?? 0} sells · ${dex.volume24hUsd != null ? `$${Math.round(dex.volume24hUsd).toLocaleString()} vol` : ""}`,
          );
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setSwaps([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [poolAddress, token0Decimals, token1Decimals]);

  return (
    <div className="mt-6">
      <h2 className="font-grotesk text-[18px] font-medium mb-4" style={{ color: clmm.text }}>
        Transactions
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="font-mono text-[10px] uppercase" style={{ color: clmm.textDim }}>
              {cols.map((c) => (
                <th key={c} className="text-left py-3 pr-4 font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div
                    className="flex flex-col items-center gap-2 font-mono text-[11px]"
                    style={{ color: clmm.textMuted }}
                  >
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: clmm.purple }} />
                    Loading swaps from chain…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="py-12 text-center font-mono text-[11px]" style={{ color: clmm.textMuted }}>
                  {error}
                </td>
              </tr>
            ) : swaps.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center font-mono text-[11px]" style={{ color: clmm.textMuted }}>
                  No Swap events in the last ~120k blocks for this pool.
                  {dexSummary && (
                    <p className="text-[9px] mt-2" style={{ color: clmm.textDim }}>
                      {dexSummary}
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              swaps.map((t) => (
                <tr
                  key={`${t.txHash}-${t.amount0}`}
                  className="font-mono text-[11px] border-t"
                  style={{ borderColor: clmm.border, color: clmm.text }}
                >
                  <td className="py-3 pr-4" style={{ color: clmm.textMuted }}>
                    {formatTime(t.timestamp)}
                  </td>
                  <td className="py-3 pr-4 capitalize">{t.type}</td>
                  <td className="py-3 pr-4">—</td>
                  <td className="py-3 pr-4">{t.amount0}</td>
                  <td className="py-3 pr-4">{t.amount1}</td>
                  <td className="py-3 pr-4">
                    <a
                      href={`https://monadexplorer.com/tx/${t.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: clmm.accent }}
                    >
                      {truncateAddress(t.sender)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && swaps.length > 0 && (
        <p className="font-mono text-[9px] mt-2" style={{ color: clmm.textDim }}>
          On-chain Swap logs · {swaps.length} recent
          {dexSummary ? ` · ${dexSummary}` : ""}
        </p>
      )}
    </div>
  );
}
