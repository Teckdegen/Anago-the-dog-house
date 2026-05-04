import { Link } from "@tanstack/react-router";
import { EyeOff } from "lucide-react";
import { useState } from "react";

export type Theme = {
  name: string;
  /** main accent color (oklch or hex) */
  accent: string;
  /** secondary accent for gradients */
  accent2: string;
  /** tag for the segment */
  tag: string;
};

type Segment = { label: string; pct: number; color: string };

// Single shared theme used across Lock / Vesting / Farm / CLMM pages.
export const SHARED_THEME: Theme = {
  name: "doghouse",
  accent: "#9B7FD4",
  accent2: "#5B4FE8",
  tag: "Dog House",
};

export function PortfolioPage({
  title,
  subtitle,
  theme = SHARED_THEME,
  segments,
  tabs,
  emptyHeading,
  emptyBody,
  ctaLabel,
}: {
  title: string;
  subtitle: string;
  theme?: Theme;
  segments: Segment[];
  tabs: string[];
  emptyHeading: string;
  emptyBody: string;
  ctaLabel: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [activeTop, setActiveTop] = useState<"Positions" | "Activity">("Positions");
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [unit, setUnit] = useState<"MON" | "USD">("USD");

  return (
    <main className="min-h-screen text-cream relative overflow-x-hidden" style={{ background: "linear-gradient(160deg, #2A1F6B 0%, #1E1650 60%, #150F3A 100%)" }}>
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full opacity-30 blur-[160px]"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, #5B4FE8 50%, transparent 70%)` }}
      />

      {/* top nav */}
      <header className="relative z-10 max-w-[1280px] mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="w-12 h-12 rounded-md" />
          <span className="font-grotesk uppercase text-[13px] tracking-wider">Dog House</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-[12px] uppercase font-mono tracking-wider text-cream/70">
          <Link to="/" className="hover:text-cream transition">Home</Link>
          <Link to="/lock" className="hover:text-cream transition" activeProps={{ className: "text-cream" }}>Lock</Link>
          <Link to="/vesting" className="hover:text-cream transition" activeProps={{ className: "text-cream" }}>Vesting</Link>
          <Link to="/farm" className="hover:text-cream transition" activeProps={{ className: "text-cream" }}>Farm</Link>
          <Link to="/clmm" className="hover:text-cream transition" activeProps={{ className: "text-cream" }}>CLMM</Link>
        </nav>
        <button
          className="px-4 py-2 rounded-full text-[12px] font-grotesk uppercase tracking-wider text-[#0a0a0c]"
          style={{
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
            boxShadow: `0 4px 24px ${theme.accent}55`,
            color: "#F5F0FF",
          }}
        >
          Connect
        </button>
      </header>

      <section className="relative z-10 max-w-[1280px] mx-auto px-6 sm:px-10 pt-6 pb-20">
        {/* page heading */}
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <span
              className="inline-block px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest mb-3"
              style={{ background: `${theme.accent}22`, color: theme.accent, border: `1px solid ${theme.accent}55` }}
            >
              {theme.tag}
            </span>
            <h1 className="font-grotesk uppercase text-cream text-[32px] sm:text-[44px] leading-none">
              {title}
            </h1>
            <p className="font-mono text-[12px] uppercase text-cream/60 mt-2 tracking-wider">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Net worth card (single, full-width) */}
        <div className="rounded-[20px] border border-white/5 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[12px] uppercase text-cream/60 tracking-wider">
              Net worth
            </span>
            <button
              onClick={() => setHidden((v) => !v)}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
              aria-label="Hide balance"
            >
              <EyeOff className="w-4 h-4 text-cream/70" />
            </button>
          </div>
          <div className="mt-3 font-grotesk text-cream text-[44px] sm:text-[56px] leading-none">
            {hidden ? "•••••" : <>$<span className="opacity-100">0</span><span className="text-cream/40">.00</span></>}
          </div>

          {/* segmented bar */}
          <div className="mt-6 flex h-3 w-full rounded-full overflow-hidden">
            {segments.map((s) => (
              <div
                key={s.label}
                className="h-full"
                style={{
                  width: `${Math.max(s.pct, 14)}%`,
                  background: `repeating-linear-gradient(45deg, ${s.color}cc, ${s.color}cc 6px, ${s.color}66 6px, ${s.color}66 12px)`,
                }}
              />
            ))}
          </div>

          {/* legend */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-3 gap-x-4">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-[12px] font-mono text-cream/70">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                <span>{s.label} ({s.pct.toFixed(2)}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* primary tabs */}
        <div className="mt-12 border-b border-white/10 flex items-center gap-6">
          {(["Positions", "Activity"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTop(t)}
              className={`relative pb-3 font-grotesk uppercase text-[13px] tracking-wider transition ${
                activeTop === t ? "text-cream" : "text-cream/50 hover:text-cream/80"
              }`}
            >
              {t}
              {activeTop === t && (
                <span
                  className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full"
                  style={{ background: theme.accent }}
                />
              )}
            </button>
          ))}
        </div>

        {/* sub tabs + controls */}
        <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/5">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-full text-[12px] font-mono uppercase tracking-wider transition ${
                  activeTab === t ? "text-[#0a0a0c]" : "text-cream/70 hover:text-cream"
                }`}
                style={
                  activeTab === t
                    ? { background: theme.accent, boxShadow: `0 0 16px ${theme.accent}88` }
                    : undefined
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-[12px] font-mono uppercase text-cream/60">
            <button className="flex items-center gap-1.5 hover:text-cream transition">
              <EyeOff className="w-3.5 h-3.5" />
              Show hidden
            </button>
            <div className="flex p-0.5 rounded-md bg-white/[0.06] border border-white/10">
              {(["MON", "USD"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`px-3 py-1 rounded text-[11px] tracking-wider transition ${
                    unit === u ? "bg-white/15 text-cream" : "text-cream/60 hover:text-cream"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* table */}
        <div className="mt-6 rounded-[20px] border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-4 text-[11px] font-mono uppercase tracking-wider text-cream/50 border-b border-white/5">
            <div className="col-span-4">Token</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-3">Value in {unit}</div>
            <div className="col-span-2">Total {unit} PNL</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="py-24 flex flex-col items-center justify-center text-center px-6">
            <p className="font-grotesk text-cream text-[16px]">{emptyHeading}</p>
            <p className="font-mono text-[12px] text-cream/60 mt-1 max-w-xs">{emptyBody}</p>
            <button
              className="mt-6 px-5 py-2 rounded-full text-[12px] font-grotesk uppercase tracking-wider transition hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                color: "#F5F0FF",
                boxShadow: `0 4px 24px ${theme.accent}55`,
              }}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
