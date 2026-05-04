import { useState, useMemo } from "react";
import { Search, Coins, RefreshCw } from "lucide-react";
import { useAllTokenBalances } from "@/lib/web3/hooks";
import type { TokenBalance } from "@/lib/web3/tokenBalances";

type TokenBalanceSelectorProps = {
  onSelect: (token: TokenBalance) => void;
  selectedAddress?: `0x${string}`;
  className?: string;
};

/**
 * Component that displays all user token balances with search
 * Automatically discovers tokens from Monad Explorer - no manual entry needed!
 */
export function TokenBalanceSelector({
  onSelect,
  selectedAddress,
  className = "",
}: TokenBalanceSelectorProps) {
  const { balances, isLoading, error, refetch } = useAllTokenBalances();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return balances;
    const s = search.toLowerCase();
    return balances.filter(
      (token) =>
        token.symbol.toLowerCase().includes(s) ||
        token.name.toLowerCase().includes(s) ||
        token.address.toLowerCase().includes(s),
    );
  }, [balances, search]);

  if (error) {
    return (
      <div
        className={`rounded-xl p-6 text-center ${className}`}
        style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}
      >
        <p className="font-mono text-[11px]" style={{ color: "rgba(255,100,100,0.8)" }}>
          Failed to load token balances
        </p>
        <button
          onClick={refetch}
          className="mt-3 px-4 py-2 rounded-full font-grotesk text-[10px] uppercase tracking-wider"
          style={{ background: "rgba(155,127,212,0.25)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.6)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Search & Refresh */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full"
          style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}
        >
          <Search className="w-3.5 h-3.5" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search tokens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent font-mono text-[11px] outline-none"
            style={{ color: "#EDE0FF" }}
          />
        </div>
        <button
          onClick={refetch}
          disabled={isLoading}
          className="p-2 rounded-full transition-colors disabled:opacity-50"
          style={{ background: "rgba(155,127,212,0.15)", border: "1px solid rgba(155,127,212,0.35)" }}
          title="Refresh balances"
        >
          <RefreshCw
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            style={{ color: "rgba(196,168,240,0.7)" }}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* Token List */}
      <div
        className="rounded-xl overflow-hidden max-h-[400px] overflow-y-auto"
        style={{ border: "1px solid rgba(155,127,212,0.35)" }}
      >
        {isLoading && balances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className="w-6 h-6 rounded-full border-2 animate-spin mb-3"
              style={{ borderColor: "rgba(155,127,212,0.2)", borderTopColor: "rgba(155,127,212,0.8)" }}
            />
            <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.6)" }}>
              Discovering your tokens...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(155,127,212,0.12)", border: "1px solid rgba(155,127,212,0.3)" }}
            >
              <Coins className="w-5 h-5" style={{ color: "rgba(196,168,240,0.6)" }} strokeWidth={1.5} />
            </div>
            <p className="font-grotesk uppercase text-[12px] tracking-wider" style={{ color: "#EDE0FF" }}>
              {search ? "No tokens found" : "No tokens yet"}
            </p>
            <p className="font-mono text-[10px] mt-1 max-w-[220px] text-center" style={{ color: "rgba(196,168,240,0.55)" }}>
              {search ? "Try a different search term" : "Get some tokens to get started"}
            </p>
          </div>
        ) : (
          filtered.map((token, i) => {
            const isSelected = selectedAddress?.toLowerCase() === token.address.toLowerCase();
            return (
              <button
                key={token.address}
                onClick={() => onSelect(token)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(155,127,212,0.08)] transition-colors"
                style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(155,127,212,0.15)" : "none",
                  background: isSelected ? "rgba(155,127,212,0.12)" : "transparent",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-grotesk text-[11px] shrink-0"
                    style={{
                      background: "rgba(155,127,212,0.15)",
                      border: "1px solid rgba(155,127,212,0.35)",
                      color: "rgba(196,168,240,0.85)",
                    }}
                  >
                    {token.symbol[0]}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-grotesk uppercase text-[12px] tracking-wider truncate" style={{ color: "#EDE0FF" }}>
                      {token.symbol}
                    </p>
                    <p className="font-mono text-[9px] truncate" style={{ color: "rgba(196,168,240,0.45)" }}>
                      {token.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-grotesk text-[13px] tabular-nums" style={{ color: "rgba(237,224,255,0.9)" }}>
                    {token.balanceFormatted}
                  </p>
                  <p className="font-mono text-[9px]" style={{ color: "rgba(196,168,240,0.5)" }}>
                    Balance
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {!isLoading && balances.length > 0 && (
        <p className="font-mono text-[9px] mt-2 text-center" style={{ color: "rgba(196,168,240,0.45)" }}>
          {balances.length} token{balances.length !== 1 ? "s" : ""} found
        </p>
      )}
    </div>
  );
}
