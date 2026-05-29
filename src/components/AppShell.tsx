import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Timer, LockKeyhole, Sprout, Send, ShoppingBag, BarChart2 } from "lucide-react";
import { WalletStatusPill } from "./WalletStatusPill";
import { NetworkRouteBanner } from "./NetworkRouteBanner";
import { theme } from "@/lib/theme";

const NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Vesting", href: "/vesting" },
  { label: "Token Lock", href: "/lock" },
  { label: "Yield Farm", href: "/farm" },
  { label: "OTC", href: "/otc" },
  { label: "CLMM", href: "/clmm" },
  { label: "Transfer", href: "/transfer" },
] as const;

const BOTTOM_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vest", href: "/vesting", icon: Timer },
  { label: "Locks", href: "/lock", icon: LockKeyhole },
  { label: "Farm", href: "/farm", icon: Sprout },
  { label: "OTC", href: "/otc", icon: ShoppingBag },
  { label: "CLMM", href: "/clmm", icon: BarChart2 },
  { label: "Transfer", href: "/transfer", icon: Send },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    <div
      className="min-h-screen overflow-x-hidden relative text-white"
      style={{ background: theme.bg, color: theme.text }}
    >
      <div className="texture-overlay" aria-hidden="true" />

      <div
        className="pointer-events-none fixed top-[-120px] left-[-80px] w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[100px] z-0"
        style={{ background: `radial-gradient(circle, ${theme.purple} 0%, ${theme.purpleDeep} 55%, transparent 100%)` }}
      />
      <div
        className="pointer-events-none fixed top-[60px] right-[-60px] w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[80px] z-0"
        style={{ background: `radial-gradient(circle, ${theme.purpleVivid} 0%, transparent 70%)` }}
      />

      {!isLanding && (
        <header
          className="relative z-20 flex items-center justify-between px-5 sm:px-8 lg:px-14 pt-5 pb-4 gap-3"
          style={{ borderBottom: `1px solid ${theme.borderSubtle}` }}
        >
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.png" alt="The Dog House" className="w-12 h-12 rounded-md" />
            <span
              className="hidden sm:block font-grotesk text-[12px] uppercase tracking-wider"
              style={{ color: theme.textMuted }}
            >
              The Dog House
            </span>
          </Link>

          <nav className="hidden lg:flex flex-1 justify-center">
            <ul
              className="flex items-center gap-0.5 px-4 py-2.5 rounded-full dh-panel"
              style={{ border: `1px solid ${theme.border}` }}
            >
              {NAV.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.href}
                    className="font-grotesk text-[11px] uppercase tracking-[0.1em] px-4 py-1.5 rounded-full transition-colors duration-200 block whitespace-nowrap"
                    style={{ color: theme.textDim }}
                    activeProps={{
                      className:
                        "font-grotesk text-[11px] uppercase tracking-[0.1em] px-4 py-1.5 rounded-full transition-colors duration-200 block whitespace-nowrap text-white bg-[rgba(139,92,246,0.2)] border border-[rgba(139,92,246,0.45)]",
                    }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <WalletStatusPill />
        </header>
      )}

      {!isLanding && <NetworkRouteBanner />}

      <main className="relative z-10 pb-24 lg:pb-0">{children}</main>

      {!isLanding && (
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
          style={{
            background: "rgba(0,0,0,0.96)",
            borderTop: `1px solid ${theme.border}`,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {BOTTOM_NAV.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              to={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors"
              style={{ color: theme.textDim }}
              activeProps={{
                className:
                  "flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors text-white",
              }}
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="font-grotesk text-[9px] uppercase tracking-wider">{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
