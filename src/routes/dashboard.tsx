import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  LockKeyhole,
  Timer,
  Sprout,
  BarChart2,
  ArrowRight,
} from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { useUserLocks, useUserVestings } from "@/lib/web3/hooks";
import { useClmmPositionCount, useFarmPositionCount } from "@/hooks/useDashboardPositions";
import { useAllTokenBalances } from "@/lib/web3/hooks";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — The Dog House" },
      { name: "description", content: "Your portfolio value across all positions." },
    ],
  }),
});

/** Fetch MON/USD price — tries multiple sources */
async function fetchMonPrice(): Promise<number> {
  // 1. CoinGecko — try known IDs for MON
  const cgIds = ["monad", "monad-testnet", "monad-2"];
  for (const id of cgIds) {
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(5000) },
      );
      const d = await r.json();
      const price = d?.[id]?.usd;
      if (typeof price === "number" && price > 0) return price;
    } catch { /* try next */ }
  }

  // 2. CoinGecko search fallback
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/search?query=monad", {
      signal: AbortSignal.timeout(5000),
    });
    const d = await r.json();
    const coin = (d?.coins as any[])?.find(
      (c) => c.symbol?.toLowerCase() === "mon" || c.name?.toLowerCase() === "monad",
    );
    if (coin?.id) {
      const r2 = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(5000) },
      );
      const d2 = await r2.json();
      const price = d2?.[coin.id]?.usd;
      if (typeof price === "number" && price > 0) return price;
    }
  } catch { /* try next */ }

  // 3. CoinMarketCap public endpoint (no key needed for basic quotes)
  try {
    const r = await fetch(
      "https://api.coinmarketcap.com/data-api/v3/cryptocurrency/market-pairs/latest?slug=monad&start=1&limit=1",
      { signal: AbortSignal.timeout(5000) },
    );
    const d = await r.json();
    const price = d?.data?.marketPairs?.[0]?.price;
    if (typeof price === "number" && price > 0) return price;
  } catch { /* give up */ }

  return 0; // price unavailable
}

function DashboardPage() {
  const [unit, setUnit] = useState<"USD" | "MON">("USD");
  const { address, isConnected } = useAccount();
  const { locks } = useUserLocks();
  const { vestings } = useUserVestings();

  const monBal = useBalance({ address, query: { enabled: !!address, refetchInterval: 10_000 } });
  const { balances: walletTokens } = useAllTokenBalances();
  const monFromBv = walletTokens.find(
    (t) => t.symbol.toUpperCase() === "MON" || t.address === "0x0000000000000000000000000000000000000000",
  );

  const [monPrice, setMonPrice] = useState<number>(0);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPriceLoading(true);
      const price = await fetchMonPrice();
      if (!cancelled) {
        setMonPrice(price);
        setPriceLoading(false);
      }
    };
    run();
    const interval = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const monAmount = useMemo(() => {
    if (monFromBv && monFromBv.balance > 0n) {
      return Number(monFromBv.balance) / 1e18;
    }
    if (!monBal.data) return null;
    return Number(monBal.data.value) / 1e18;
  }, [monBal.data, monFromBv]);

  const monUsd = useMemo(() => {
    if (monAmount === null || monPrice === 0) return null;
    const usd = monAmount * monPrice;
    // Use enough decimal places so small balances don't round to $0.00
    if (usd === 0) return "0.00";
    if (usd < 0.01) return usd.toFixed(6);
    if (usd < 1)    return usd.toFixed(4);
    return usd.toFixed(2);
  }, [monAmount, monPrice]);

  const priceAvailable = monPrice > 0;

  const displayValue = useMemo(() => {
    if (unit === "MON") {
      return monAmount !== null ? `${monAmount.toFixed(4)} MON` : "0.0000 MON";
    }
    // USD mode
    if (priceLoading) return "Loading…";
    if (!priceAvailable) {
      // Price not on CoinGecko (testnet) — show MON amount with USD label
      return monAmount !== null ? `${monAmount.toFixed(4)} MON` : "—";
    }
    return `$${monUsd ?? "0.00"}`;
  }, [unit, monAmount, monUsd, priceAvailable, priceLoading]);

  const subtitle = useMemo(() => {
    if (!isConnected) return "connect wallet to load balances";
    if (!monBal.data) return "loading…";
    if (unit === "USD") {
      if (priceLoading) return "fetching price…";
      if (!priceAvailable) {
        return `${monAmount?.toFixed(4) ?? "0"} MON · price unavailable (testnet)`;
      }
      return `${monAmount?.toFixed(4) ?? "0"} MON · $${monPrice.toFixed(4)} / MON`;
    }
    // MON mode
    if (!priceAvailable) return "price unavailable (testnet)";
    return monUsd ? `≈ $${monUsd} USD · $${monPrice.toFixed(4)} / MON` : "price unavailable";
  }, [isConnected, monBal.data, unit, priceLoading, priceAvailable, monAmount, monPrice, monUsd]);

  const activeLocks = locks.filter((l) => !l.withdrawn);
  const claimableLocks = activeLocks.filter(
    (l) => Number(l.unlockAt) <= Math.floor(Date.now() / 1000),
  ).length;

  // Only show vestings that still have tokens to claim (not fully claimed)
  const activeVestings = vestings.filter((v) => {
    const totalAmount = Number(v.totalAmount);
    const claimed = Number(v.claimed);
    return totalAmount > 0 && claimed < totalAmount && !v.revoked;
  });

  const farmStats = useFarmPositionCount();
  const clmmStats = useClmmPositionCount();

  const POSITIONS = [
    {
      label: "Token Locks",
      value: `${activeLocks.length} active`,
      sub: claimableLocks ? `${claimableLocks} claimable now` : `${activeLocks.length} active locks`,
      color: "#C4A8F0",
      icon: LockKeyhole,
      href: "/lock",
    },
    {
      label: "Vesting",
      value: `${activeVestings.length} active`,
      sub: activeVestings.length > 0 ? `${activeVestings.length} yet to be claimed` : "no active vestings",
      color: "#9B7FD4",
      icon: Timer,
      href: "/vesting",
    },
    {
      label: "Stream Farms",
      value: !isConnected
        ? "—"
        : farmStats.isLoading
          ? "…"
          : `${farmStats.count} active`,
      sub: !isConnected
        ? "connect wallet"
        : farmStats.farmCount === 0
          ? "no farms deployed yet"
          : farmStats.count > 0
            ? `${farmStats.count} deposit${farmStats.count === 1 ? "" : "s"} · ${farmStats.farmCount} farm${farmStats.farmCount === 1 ? "" : "s"} live`
            : `${farmStats.farmCount} farm${farmStats.farmCount === 1 ? "" : "s"} · deposit to earn`,
      color: "#6B4FA8",
      icon: Sprout,
      href: "/farm",
    },
    {
      label: "CLMM",
      value: !isConnected
        ? "—"
        : clmmStats.isLoading
          ? "…"
          : `${clmmStats.count} open`,
      sub: !isConnected
        ? "connect wallet"
        : clmmStats.count > 0
          ? `${clmmStats.count} Capricorn LP position${clmmStats.count === 1 ? "" : "s"} on Monad`
          : "explore pools · add liquidity",
      color: "#4A2D7A",
      icon: BarChart2,
      href: "/clmm",
    },
  ] as const;

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto px-5 sm:px-8 lg:px-14 pt-10 pb-24">

        {/* ── NET WORTH HEADER ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <p
              className="font-mono text-[9px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(196,168,240,0.7)" }}
            >
              Net Worth
            </p>
            {/* USD / MON toggle */}
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-full"
              style={{ background: "rgba(155,127,212,0.12)", border: "1px solid rgba(155,127,212,0.3)" }}
            >
              {(["USD", "MON"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className="px-2.5 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider transition"
                  style={
                    unit === u
                      ? { background: "rgba(155,127,212,0.45)", color: "#EDE0FF" }
                      : { color: "rgba(196,168,240,0.5)" }
                  }
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <p className="font-grotesk text-cream leading-none tracking-tight text-[42px] sm:text-[54px]">
            {displayValue}
          </p>
          <p className="font-mono text-[9px] mt-2" style={{ color: "rgba(196,168,240,0.65)" }}>
            {subtitle}
          </p>
        </div>

        {/* ── BREAKDOWN BAR ── */}
        <div className="flex w-full h-2.5 rounded-full overflow-hidden gap-px mb-6" style={{ background: "rgba(155,127,212,0.1)" }}>
          {POSITIONS.map((p) => (
            <div
              key={p.label}
              className="h-full flex-1"
              style={{ background: p.color, opacity: isConnected ? 1 : 0.75 }}
            />
          ))}
        </div>

        {/* ── VALUE ROWS ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.03)" }}
        >
          {POSITIONS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.label}
                to={p.href}
                className="flex items-center justify-between px-6 py-5 hover:bg-[rgba(155,127,212,0.06)] transition-colors"
                style={{
                  borderBottom: i < POSITIONS.length - 1 ? "1px solid rgba(155,127,212,0.15)" : "none",
                  display: "flex",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: p.color, opacity: isConnected ? 1 : 0.6 }}
                  />
                  <Icon className="w-4 h-4" style={{ color: p.color }} strokeWidth={1.5} />
                  <div>
                    <p className="font-grotesk uppercase text-[13px] tracking-wider" style={{ color: "#EDE0FF" }}>
                      {p.label}
                    </p>
                    <p className="font-mono text-[11px] mt-0.5" style={{ color: "rgba(196,168,240,0.65)" }}>
                      {p.sub}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p
                    className="font-grotesk text-[18px] leading-none tabular-nums"
                    style={{ color: "#EDE0FF", opacity: isConnected ? 1 : 0.55 }}
                  >
                    {p.value}
                  </p>
                  <ArrowRight className="w-4 h-4" style={{ color: p.color, opacity: 0.6 }} />
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </AppShell>
  );
}
