import { useState, useMemo } from "react";
import { Search, Coins } from "lucide-react";
import { useAllTokenBalances } from "@/lib/web3/hooks";
import type { TokenBalance } from "@/lib/web3/tokenBalances";
import { TokenIcon } from "./TokenIcon";

type TokenBalanceSelectorProps = {
  onSelect: (token: TokenBalance) => void;
  selectedAddress?: `0x${string}`;
  className?: string;
  excludeNative?: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

function formatUsd(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/** Wallet token list with balances from Zerion (+ BlockVision / RPC fallback) */
export function TokenBalanceSelector({
  onSelect,
  selectedAddress,
  className = "",
  excludeNative,
}: TokenBalanceSelectorProps) {
  const { balances, isLoading, error } = useAllTokenBalances();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = balances;
    if (excludeNative) list = list.filter((t) => t.address !== ZERO);
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(
      (token) =>
        token.symbol.toLowerCase().includes(s) ||
        token.name.toLowerCase().includes(s) ||
        token.address.toLowerCase().includes(s),
    );
  }, [balances, search, excludeNative]);

  if (error && !isLoading && balances.length === 0) {
    return (
      <div
        className={`rounded-xl p-6 text-center ${className}`}
        style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}
      >
        <p className="font-mono text-[11px]" style={{ color: "rgba(255,100,100,0.8)" }}>
          Failed to load token balances. Check your Zerion API key.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-full mb-3"
        style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}
      >
        <Search className="w-3.5 h-3.5" style={{ color: "rgba(196,168,240,0.5)" }} strokeWidth={1.5} />
        <input
          type="text"
          placeholder="Search tokens…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent font-mono text-[11px] outline-none"
          style={{ color: "#EDE0FF" }}
        />
      </div>

      <div
        className="rounded-xl overflow-hidden max-h-[400px] overflow-y-auto"
        style={{ border: "1px solid rgba(155,127,212,0.35)" }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className="w-6 h-6 rounded-full border-2 animate-spin mb-3"
              style={{ borderColor: "rgba(155,127,212,0.2)", borderTopColor: "rgba(155,127,212,0.8)" }}
            />
            <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.6)" }}>
              Loading balances from Zerion…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Coins className="w-5 h-5 mb-2" style={{ color: "rgba(196,168,240,0.6)" }} strokeWidth={1.5} />
            <p className="font-grotesk uppercase text-[12px] tracking-wider" style={{ color: "#EDE0FF" }}>
              {search ? "No matching tokens" : "No tokens in this wallet"}
            </p>
          </div>
        ) : (
          filtered.map((token, i) => {
            const isSelected = selectedAddress?.toLowerCase() === token.address.toLowerCase();
            const usd = formatUsd(token.usdValue);
            return (
              <button
                key={token.address}
                type="button"
                onClick={() => onSelect(token)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(155,127,212,0.08)] transition-colors"
                style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(155,127,212,0.15)" : "none",
                  background: isSelected ? "rgba(155,127,212,0.12)" : "transparent",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TokenIcon address={token.address} symbol={token.symbol} size={32} logoUrl={token.logoURI} />
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
                    {usd ?? "Balance"}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {!isLoading && balances.length > 0 && (
        <p className="font-mono text-[9px] mt-2 text-center" style={{ color: "rgba(196,168,240,0.45)" }}>
          {balances.length} token{balances.length !== 1 ? "s" : ""} · Zerion
        </p>
      )}
    </div>
  );
}
