import { useState, useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatAmount } from "@/lib/web3/format";
import { ERC20_ABI, type TokenInfo } from "@/lib/web3/tokens";
import { Check, Search, Loader2, Coins, RefreshCw } from "lucide-react";
import { useAllTokenBalances } from "@/lib/web3/hooks";

type Props = {
  selected?: TokenInfo;
  onSelect: (t: TokenInfo & { balance: bigint }) => void;
  excludeNative?: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const isAddr = (s: string): s is `0x${string}` => /^0x[a-fA-F0-9]{40}$/.test(s);

/**
 * TokenPicker with auto-discovery of all user tokens from Monad Explorer
 * No manual address entry needed - shows all tokens automatically!
 */
export function TokenPicker({ selected, onSelect, excludeNative }: Props) {
  const { address: wallet } = useAccount();
  const [input, setInput] = useState("");
  const [showManual, setShowManual] = useState(false);
  
  // Auto-discover all user tokens
  const { balances, isLoading: loadingBalances, refetch } = useAllTokenBalances();

  // Filter out native token if requested
  const filteredBalances = useMemo(() => {
    let tokens = balances;
    if (excludeNative) {
      tokens = tokens.filter(t => t.address !== ZERO);
    }
    return tokens;
  }, [balances, excludeNative]);

  // Search filter
  const searchFiltered = useMemo(() => {
    if (!input) return filteredBalances;
    const s = input.toLowerCase();
    return filteredBalances.filter(
      t => t.symbol.toLowerCase().includes(s) ||
           t.name.toLowerCase().includes(s) ||
           t.address.toLowerCase().includes(s)
    );
  }, [filteredBalances, input]);

  // Manual address resolution (fallback)
  const addr = isAddr(input.trim()) ? (input.trim() as `0x${string}`) : null;
  const reads = useReadContracts({
    allowFailure: true,
    contracts: addr && showManual
      ? [
          { address: addr, abi: ERC20_ABI, functionName: "symbol" as const },
          { address: addr, abi: ERC20_ABI, functionName: "name" as const },
          { address: addr, abi: ERC20_ABI, functionName: "decimals" as const },
          {
            address: addr,
            abi: ERC20_ABI,
            functionName: "balanceOf" as const,
            args: wallet ? [wallet] : undefined,
          },
        ]
      : [],
    query: { enabled: !!addr && !!wallet && showManual },
  });

  const loading = reads.isLoading;
  const [symR, nameR, decR, balR] = reads.data ?? [];

  const manualResolved: (TokenInfo & { balance: bigint }) | null =
    addr && showManual && symR?.status === "success"
      ? {
          address: addr,
          symbol: symR.result as string,
          name: (nameR?.result as string) ?? "",
          decimals: (decR?.result as number) ?? 18,
          balance: balR?.status === "success" ? (balR.result as bigint) : 0n,
        }
      : null;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(155,127,212,0.07)", border: "1px solid rgba(155,127,212,0.3)" }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search your tokens..."
            className="flex-1 bg-transparent font-mono text-[11px] outline-none placeholder:text-[rgba(155,127,212,0.4)]"
            style={{ color: "#EDE0FF" }}
            spellCheck={false}
          />
          {input && (
            <button
              onClick={() => setInput("")}
              className="font-mono text-[10px] transition hover:opacity-80"
              style={{ color: "rgba(196,168,240,0.45)" }}
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={refetch}
          disabled={loadingBalances}
          className="p-2.5 rounded-xl transition-colors disabled:opacity-50"
          style={{ background: "rgba(155,127,212,0.12)", border: "1px solid rgba(155,127,212,0.3)" }}
          title="Refresh tokens"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loadingBalances ? "animate-spin" : ""}`}
            style={{ color: "rgba(196,168,240,0.7)" }}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* Token list */}
      <div
        className="rounded-xl overflow-hidden max-h-[280px] overflow-y-auto"
        style={{ border: "1px solid rgba(155,127,212,0.3)" }}
      >
        {loadingBalances && filteredBalances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin mb-2" style={{ color: "rgba(155,127,212,0.7)" }} />
            <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.6)" }}>
              Discovering your tokens...
            </p>
          </div>
        ) : searchFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Coins className="w-6 h-6 mb-2" style={{ color: "rgba(155,127,212,0.5)" }} strokeWidth={1.5} />
            <p className="font-mono text-[10px] text-center" style={{ color: "rgba(196,168,240,0.6)" }}>
              {input ? "No tokens found" : "No tokens yet"}
            </p>
            {!input && (
              <button
                onClick={() => setShowManual(true)}
                className="mt-3 font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80"
                style={{ color: "rgba(155,127,212,0.7)" }}
              >
                + Add manually
              </button>
            )}
          </div>
        ) : (
          searchFiltered.map((token, i) => {
            const isSel = selected?.address?.toLowerCase() === token.address.toLowerCase();
            return (
              <button
                key={token.address}
                onClick={() => onSelect(token)}
                className="w-full text-left p-3 relative transition hover:bg-[rgba(155,127,212,0.08)]"
                style={{
                  background: isSel ? "rgba(155,127,212,0.12)" : "transparent",
                  borderBottom: i < searchFiltered.length - 1 ? "1px solid rgba(155,127,212,0.15)" : "none",
                }}
              >
                {isSel && (
                  <span
                    className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "#9B7FD4", color: "#0D0B14" }}
                  >
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                )}
                <div className="flex items-center gap-2.5 pr-6">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-grotesk text-[12px] shrink-0"
                    style={{ background: "rgba(155,127,212,0.15)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.35)" }}
                  >
                    {token.symbol[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-grotesk text-[12px] uppercase tracking-wider" style={{ color: "#EDE0FF" }}>
                      {token.symbol}
                    </p>
                    <p className="font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.45)" }}>
                      {token.name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-[11px] tabular-nums" style={{ color: "rgba(237,224,255,0.85)" }}>
                      {token.balanceFormatted}
                    </p>
                    <p className="font-mono text-[8px]" style={{ color: "rgba(196,168,240,0.4)" }}>
                      balance
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Manual entry toggle */}
      {!showManual && searchFiltered.length > 0 && (
        <button
          onClick={() => setShowManual(true)}
          className="w-full text-center py-2 rounded-xl transition hover:bg-[rgba(155,127,212,0.08)]"
          style={{ border: "1px dashed rgba(155,127,212,0.3)" }}
        >
          <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.6)" }}>
            + Add token manually
          </p>
        </button>
      )}

      {/* Manual address entry (fallback) */}
      {showManual && (
        <div className="space-y-2 pt-2" style={{ borderTop: "1px solid rgba(155,127,212,0.2)" }}>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
              Manual Entry
            </p>
            <button
              onClick={() => setShowManual(false)}
              className="font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80"
              style={{ color: "rgba(196,168,240,0.5)" }}
            >
              Cancel
            </button>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(155,127,212,0.07)", border: "1px solid rgba(155,127,212,0.3)" }}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: "rgba(196,168,240,0.6)" }} />
            ) : (
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.trim())}
              placeholder="Paste token address (0x...)"
              className="flex-1 bg-transparent font-mono text-[11px] outline-none placeholder:text-[rgba(155,127,212,0.4)]"
              style={{ color: "#EDE0FF" }}
              spellCheck={false}
            />
          </div>
          
          {input && !addr && (
            <p className="font-mono text-[9px]" style={{ color: "rgba(255,120,120,0.85)" }}>
              Invalid address format
            </p>
          )}

          {manualResolved && (
            <button
              onClick={() => onSelect(manualResolved)}
              className="w-full text-left rounded-xl p-3 transition active:scale-[0.99]"
              style={{
                background: "rgba(155,127,212,0.1)",
                border: "1px solid rgba(155,127,212,0.4)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-grotesk text-[12px] shrink-0"
                  style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.4)" }}
                >
                  {manualResolved.symbol[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-grotesk text-[13px] uppercase tracking-wider" style={{ color: "#EDE0FF" }}>
                    {manualResolved.symbol}
                  </p>
                  <p className="font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.5)" }}>
                    {manualResolved.name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-[11px] tabular-nums" style={{ color: "rgba(237,224,255,0.85)" }}>
                    {formatAmount(manualResolved.balance, manualResolved.decimals)}
                  </p>
                  <p className="font-mono text-[9px]" style={{ color: "rgba(196,168,240,0.4)" }}>
                    balance
                  </p>
                </div>
              </div>
            </button>
          )}
        </div>
      )}

      {!loadingBalances && filteredBalances.length > 0 && !showManual && (
        <p className="font-mono text-[9px] text-center" style={{ color: "rgba(196,168,240,0.45)" }}>
          {filteredBalances.length} token{filteredBalances.length !== 1 ? "s" : ""} • Auto-discovered from Monad Explorer
        </p>
      )}
    </div>
  );
}
