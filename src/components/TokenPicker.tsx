import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatAmount } from "@/lib/web3/format";
import { getBlockVisionApiKey } from "@/lib/web3/blockvision";
import { ERC20_ABI, type TokenInfo } from "@/lib/web3/tokens";
import { Check, Search, Loader2, Coins, ChevronDown } from "lucide-react";
import { useAllTokenBalances } from "@/lib/web3/hooks";
import { TokenIcon } from "./TokenIcon";

type Props = {
  selected?: TokenInfo;
  onSelect: (t: TokenInfo & { balance: bigint }) => void;
  excludeNative?: boolean;
  /** Compact list for inline forms (e.g. OTC payment token) */
  compact?: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const isAddr = (s: string): s is `0x${string}` => /^0x[a-fA-F0-9]{40}$/.test(s);

function formatUsd(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

/**
 * Wallet token picker — balances from Zerion (MON + ERC-20), BlockVision / RPC fallback.
 */
export function TokenPicker({ selected, onSelect, excludeNative, compact }: Props) {
  const { address: wallet } = useAccount();
  const [input, setInput] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [expanded, setExpanded] = useState(!selected);

  useEffect(() => {
    if (!selected) setExpanded(true);
  }, [selected]);

  const pickToken = (token: TokenInfo & { balance: bigint }) => {
    onSelect(token);
    setInput("");
    setShowManual(false);
    setExpanded(false);
  };

  const { balances, isLoading: loadingBalances, error, addToken } = useAllTokenBalances();
  const hasBvKey = import.meta.env.DEV || !!getBlockVisionApiKey() || import.meta.env.PROD;

  const filteredBalances = useMemo(() => {
    let tokens = balances;
    if (excludeNative) {
      tokens = tokens.filter((t) => t.address !== ZERO);
    }
    return tokens;
  }, [balances, excludeNative]);

  const searchFiltered = useMemo(() => {
    if (!input) return filteredBalances;
    const s = input.toLowerCase();
    return filteredBalances.filter(
      (t) =>
        t.symbol.toLowerCase().includes(s) ||
        t.name.toLowerCase().includes(s) ||
        t.address.toLowerCase().includes(s),
    );
  }, [filteredBalances, input]);

  const addr = isAddr(input.trim()) ? (input.trim() as `0x${string}`) : null;
  const reads = useReadContracts({
    allowFailure: true,
    contracts:
      addr && showManual
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

  const maxH = compact ? "max-h-[220px]" : "max-h-[280px]";

  const selectedBalance = selected
    ? balances.find((t) => t.address.toLowerCase() === selected.address.toLowerCase())?.balanceFormatted
    : null;

  if (selected && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full text-left rounded-xl p-3 transition hover:bg-[rgba(139,92,246,0.08)] active:scale-[0.99]"
        style={{
          background: "rgba(139,92,246,0.12)",
          border: "1px solid rgba(139,92,246,0.45)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <TokenIcon address={selected.address} symbol={selected.symbol} size={36} />
          <div className="min-w-0 flex-1">
            <p className="font-grotesk text-[13px] uppercase tracking-wider" style={{ color: "#FFFFFF" }}>
              {selected.symbol}
            </p>
            <p className="font-mono text-[9px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
              {selected.name}
            </p>
          </div>
          <div className="text-right shrink-0 flex items-center gap-2">
            {selectedBalance && (
              <p className="font-mono text-[11px] tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>
                {selectedBalance}
              </p>
            )}
            <span
              className="font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-lg"
              style={{ color: "#C4B5FD", background: "rgba(139,92,246,0.2)" }}
            >
              Change
            </span>
            <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.45)" }} strokeWidth={2} />
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.3)" }}
      >
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} strokeWidth={1.5} />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search your tokens…"
          className="flex-1 bg-transparent font-mono text-[11px] outline-none placeholder:text-[rgba(139,92,246,0.4)]"
          style={{ color: "#FFFFFF" }}
          spellCheck={false}
        />
        {input && (
          <button
            type="button"
            onClick={() => setInput("")}
            className="font-mono text-[10px] transition hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            ✕
          </button>
        )}
      </div>

      {!wallet && (
        <p className="font-mono text-[10px] text-center py-4" style={{ color: "rgba(255,255,255,0.55)" }}>
          Connect wallet to load your token balances
        </p>
      )}

      {wallet && error && !loadingBalances && filteredBalances.length === 0 && (
        <p className="font-mono text-[10px] text-center py-2" style={{ color: "rgba(255,120,120,0.85)" }}>
          Could not load balances. Check your Zerion API key.
        </p>
      )}

      {wallet && !hasBvKey && import.meta.env.DEV && (
        <p className="font-mono text-[9px] text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
          Add BLOCKVISION_API_KEY to .env.local (vite proxies /bv)
        </p>
      )}

      <div
        className={`rounded-xl overflow-hidden ${maxH} overflow-y-auto`}
        style={{ border: "1px solid rgba(139,92,246,0.3)" }}
      >
        {!wallet ? null : loadingBalances ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin mb-2" style={{ color: "rgba(139,92,246,0.7)" }} />
            <p className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              Loading balances from Zerion…
            </p>
          </div>
        ) : searchFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Coins className="w-6 h-6 mb-2" style={{ color: "rgba(139,92,246,0.5)" }} strokeWidth={1.5} />
            <p className="font-mono text-[10px] text-center" style={{ color: "rgba(255,255,255,0.6)" }}>
              {input ? "No matching tokens" : "No tokens in this wallet"}
            </p>
            {!input && (
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="mt-3 font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80"
                style={{ color: "rgba(139,92,246,0.7)" }}
              >
                + Add by contract address
              </button>
            )}
          </div>
        ) : (
          searchFiltered.map((token, i) => {
            const isSel = selected?.address?.toLowerCase() === token.address.toLowerCase();
            const usd = formatUsd(token.usdValue);
            return (
              <button
                key={token.address}
                type="button"
                onClick={() => pickToken(token)}
                className="w-full text-left p-3 relative transition hover:bg-[rgba(139,92,246,0.08)]"
                style={{
                  background: isSel ? "rgba(139,92,246,0.12)" : "transparent",
                  borderBottom: i < searchFiltered.length - 1 ? "1px solid rgba(139,92,246,0.15)" : "none",
                }}
              >
                {isSel && (
                  <span
                    className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "#8B5CF6", color: "#0c0c10" }}
                  >
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                )}
                <div className="flex items-center gap-2.5 pr-6">
                  <TokenIcon address={token.address} symbol={token.symbol} size={32} logoUrl={token.logoURI} />
                  <div className="min-w-0 flex-1">
                    <p className="font-grotesk text-[12px] uppercase tracking-wider" style={{ color: "#FFFFFF" }}>
                      {token.symbol}
                    </p>
                    <p className="font-mono text-[9px] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {token.name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-[11px] tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {token.balanceFormatted}
                    </p>
                    <p className="font-mono text-[8px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {usd ?? "balance"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {!showManual && searchFiltered.length > 0 && (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="w-full text-center py-2 rounded-xl transition hover:bg-[rgba(139,92,246,0.08)]"
          style={{ border: "1px dashed rgba(139,92,246,0.3)" }}
        >
          <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.6)" }}>
            + Add by contract address
          </p>
        </button>
      )}

      {showManual && (
        <div className="space-y-2 pt-2" style={{ borderTop: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
              Contract address
            </p>
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Cancel
            </button>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.3)" }}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: "rgba(255,255,255,0.6)" }} />
            ) : (
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} strokeWidth={1.5} />
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.trim())}
              placeholder="0x…"
              className="flex-1 bg-transparent font-mono text-[11px] outline-none placeholder:text-[rgba(139,92,246,0.4)]"
              style={{ color: "#FFFFFF" }}
              spellCheck={false}
            />
          </div>

          {input && !addr && (
            <p className="font-mono text-[9px]" style={{ color: "rgba(255,120,120,0.85)" }}>
              Invalid address
            </p>
          )}

          {manualResolved && (
            <button
              type="button"
              onClick={() => {
                addToken(manualResolved);
                pickToken(manualResolved);
              }}
              className="w-full text-left rounded-xl p-3 transition active:scale-[0.99]"
              style={{
                background: "rgba(139,92,246,0.1)",
                border: "1px solid rgba(139,92,246,0.4)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <TokenIcon address={manualResolved.address} symbol={manualResolved.symbol} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="font-grotesk text-[13px] uppercase tracking-wider" style={{ color: "#FFFFFF" }}>
                    {manualResolved.symbol}
                  </p>
                  <p className="font-mono text-[9px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {manualResolved.name}
                  </p>
                </div>
                <p className="font-mono text-[11px] tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {formatAmount(manualResolved.balance, manualResolved.decimals)}
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {!loadingBalances && filteredBalances.length > 0 && !showManual && (
        <p className="font-mono text-[9px] text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
          {filteredBalances.length} token{filteredBalances.length !== 1 ? "s" : ""} · Zerion
        </p>
      )}
    </div>
  );
}
