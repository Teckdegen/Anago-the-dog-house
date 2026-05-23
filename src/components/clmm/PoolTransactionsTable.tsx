import { Loader2 } from "lucide-react";
import { clmm } from "./clmmTheme";

/** Placeholder until subgraph swap events are wired */
export function PoolTransactionsTable({ symbol0, symbol1 }: { symbol0: string; symbol1: string }) {
  const cols = ["Time", "Type", "USD", symbol0, symbol1, "Wallet"] as const;

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
            <tr>
              <td colSpan={6} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2 font-mono text-[11px]" style={{ color: clmm.textMuted }}>
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: clmm.purple }} />
                  Loading swap history…
                </div>
                <p className="font-mono text-[9px] mt-3 max-w-sm mx-auto" style={{ color: clmm.textDim }}>
                  Live swap feed coming soon — use explorer for recent pool activity.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
