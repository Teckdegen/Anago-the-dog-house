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

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — The Dog House" },
      { name: "description", content: "Your portfolio value across all positions." },
    ],
  }),
});

function DashboardPage() {
  const [unit, setUnit] = useState<"USD" | "MON">("USD");
  const { address, isConnected } = useAccount();
  const { locks } = useUserLocks();
  const { wallets: vestingWallets } = useUserVestings();

  const monBal = useBalance({ address, query: { enabled: !!address } });
  const [monPrice, setMonPrice] = useState<number>(0);
  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd")
      .then((r) => r.json())
      .then((d) => { if (d?.monad?.usd) setMonPrice(d.monad.usd); })
      .catch(() => {});
  }, []);

  const monAmount = useMemo(() => {
    if (!monBal.data) return null;
    return Number(monBal.data.value) / 1e18;
  }, [monBal.data]);

  const monUsd = useMemo(() => {
    if (monAmount === null || monPrice === 0) return null;
    return (monAmount * monPrice).toFixed(2);
  }, [monAmount, monPrice]);

  const displayValue = useMemo(() => {
    if (unit === "MON") return monAmount !== null ? `${monAmount.toFixed(4)} MON` : "0.0000 MON";
    return monUsd ? `$${monUsd}` : "$0.00";
  }, [unit, monAmount, monUsd]);

  const activeLocks = locks.filter((l) => !l.withdrawn);
  const claimableLocks = activeLocks.filter(
    (l) => Number(l.unlockAt) <= Math.floor(Date.now() / 1000),
  ).length;

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
      value: `${vestingWallets.length} schedules`,
      sub: `${vestingWallets.length} schedules`,
      color: "#9B7FD4",
      icon: Timer,
      href: "/vesting",
    },
    {
      label: "Yield Farms",
      value: "$0.00",
      sub: "$0.00 claimable",
      color: "#6B4FA8",
      icon: Sprout,
      href: "/farm",
    },
    {
      label: "CLMM",
      value: "$0.00",
      sub: "0 open positions",
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
            {isConnected
              ? monBal.data
                ? unit === "USD"
                  ? `${monAmount?.toFixed(4) ?? "0.0000"} MON${monPrice ? ` · $${monPrice.toFixed(4)} / MON` : ""}`
                  : monUsd ? `≈ $${monUsd} USD${monPrice ? ` · $${monPrice.toFixed(4)} / MON` : ""}` : "price unavailable"
                : "loading…"
              : "connect wallet to load balances"}
          </p>
        </div>

        {/* ── BREAKDOWN BAR ── */}
        <div className="flex w-full h-2.5 rounded-full overflow-hidden gap-px mb-6">
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
          style={{ border: "1px solid rgba(155,127,212,0.4)" }}
        >
          {POSITIONS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.label}
                to={p.href}
                className="flex items-center justify-between px-6 py-5 hover:bg-[rgba(155,127,212,0.06)] transition-colors"
                style={{
                  borderBottom: i < POSITIONS.length - 1 ? "1px solid rgba(155,127,212,0.2)" : "none",
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
                    <p className="font-grotesk uppercase text-cream text-[13px] tracking-wider">
                      {p.label}
                    </p>
                    <p className="font-mono text-[11px] mt-0.5" style={{ color: "rgba(196,168,240,0.75)" }}>
                      {p.sub}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p
                    className="font-grotesk text-cream text-[18px] leading-none tabular-nums"
                    style={{ opacity: isConnected ? 1 : 0.55 }}
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
