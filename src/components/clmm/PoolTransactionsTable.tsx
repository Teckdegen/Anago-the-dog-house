import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { fetchBlockVisionPoolTrades, type BlockVisionTrade } from "@/lib/web3/blockvision";
import { truncateAddress } from "@/lib/capricorn/poolMetrics";
import { clmm } from "./clmmTheme";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function tradeUsd(t: BlockVisionTrade): string {
  const a0 = parseFloat(t.token0Info?.amountUSD ?? "0");
  const a1 = parseFloat(t.token1Info?.amountUSD ?? "0");
  const v = Math.max(a0, a1);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function PoolTransactionsTable({
  poolAddress,
  token0,
  token1,
  symbol0,
  symbol1,
}: {
  poolAddress: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  symbol0: string;
  symbol1: string;
}) {
  const cols = ["Time", "Type", "USD", symbol0, symbol1, "Wallet"] as const;
  const [trades, setTrades] = useState<BlockVisionTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchBlockVisionPoolTrades(poolAddress, token0, token1, 40)
      .then((rows) => {
        if (!cancelled) setTrades(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setTrades([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [poolAddress, token0, token1]);

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
                    Loading swap history…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="py-12 text-center font-mono text-[11px]" style={{ color: clmm.textMuted }}>
                  {error}
                  <p className="text-[9px] mt-2" style={{ color: clmm.textDim }}>
                    Ensure BLOCKVISION_API_KEY is set (Pro tier for Monad mainnet).
                  </p>
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center font-mono text-[11px]" style={{ color: clmm.textMuted }}>
                  No recent swaps indexed for this pool.
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr
                  key={t.txHash}
                  className="font-mono text-[11px] border-t"
                  style={{ borderColor: clmm.border, color: clmm.text }}
                >
                  <td className="py-3 pr-4" style={{ color: clmm.textMuted }}>
                    {formatTime(t.timestamp)}
                  </td>
                  <td className="py-3 pr-4 capitalize">{t.type}</td>
                  <td className="py-3 pr-4">{tradeUsd(t)}</td>
                  <td className="py-3 pr-4">{t.token0Info?.amount ?? "—"}</td>
                  <td className="py-3 pr-4">{t.token1Info?.amount ?? "—"}</td>
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
      {!loading && trades.length > 0 && (
        <p className="font-mono text-[9px] mt-2" style={{ color: clmm.textDim }}>
          Swaps via BlockVision · {trades[0]?.dex ?? "DEX"}
        </p>
      )}
    </div>
  );
}
