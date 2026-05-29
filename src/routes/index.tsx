import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { HlsVideo } from "@/components/HlsVideo";
import { formatUsdHero } from "@/lib/capricorn/poolMetrics";
import { useStableProtocolTVL } from "@/lib/web3/tvl";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "The Dog House — Every token needs a home" },
      {
        name: "description",
        content: "The Dog House on Monad: Vesting, Token Lock, CLMM and Yield Farm. Powered by ANAGO.",
      },
    ],
  }),
});

const HLS_SRC = "https://stream.mux.com/4IMYGcL01xjs7ek5ANO17JC4VQVUTsojZlnw4fXzwSxc.m3u8";

// Cycling words with their accent colors
const CYCLE_WORDS = [
  { word: "Vesting", color: "#8B5CF6", href: "/vesting" },
  { word: "Token Lock", color: "#6D28D9", href: "/lock" },
  { word: "CLMM", color: "#7C3AED", href: "/clmm" },
  { word: "Yield Farm", color: "#A78BFA", href: "/farm" },
] as const;

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.844l-5.36-6.99L4.6 22H1.34l8.04-9.19L1 2h7.02l4.84 6.39L18.244 2Zm-1.2 18h1.9L7.04 4H5.04l12.004 16Z" />
    </svg>
  );
}

// Animated cycling word component
function CyclingWord() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cycle = () => {
      // fade out
      setVisible(false);
      timerRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % CYCLE_WORDS.length);
        setVisible(true);
        timerRef.current = setTimeout(cycle, 1800);
      }, 350);
    };
    timerRef.current = setTimeout(cycle, 1800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const current = CYCLE_WORDS[index];

  return (
    <span
      className="inline-block transition-all duration-300"
      style={{
        color: current.color,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        textShadow: `0 0 32px ${current.color}88`,
      }}
    >
      {current.word}
    </span>
  );
}

function Index() {
  const { displayUsd: tvlUsd } = useStableProtocolTVL();
  const tvlDisplay = tvlUsd == null ? "…" : formatUsdHero(tvlUsd);

  return (
    <main className="text-cream min-h-screen overflow-x-hidden" style={{ background: "#000000" }}>
      <div className="texture-overlay" aria-hidden="true" />

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="relative w-full min-h-screen flex flex-col overflow-hidden">

        {/* video */}
        <div className="absolute inset-0">
          <HlsVideo src={HLS_SRC} className="absolute inset-0 w-full h-full object-cover object-center" />
          {/* dark overlay — heavier on left/center for text */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(105deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.15) 100%)"
          }} />
          {/* bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-40" style={{
            background: "linear-gradient(to bottom, transparent, #000000)"
          }} />
          {/* purple tint */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, transparent 55%)",
            mixBlendMode: "screen"
          }} />
        </div>

        {/* ── NAV ── */}
        <header className="relative z-20 flex items-center justify-between px-5 sm:px-8 lg:px-14 pt-5 gap-3">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 py-3">
            <img src="/logo.png" alt="The Dog House" className="w-12 h-12 rounded-lg" />
            <span className="font-grotesk text-[12px] uppercase tracking-wider text-cream/70">
              The Dog House
            </span>
          </Link>

          <a
            href="/dashboard"
            className="rounded-full px-5 py-2.5 font-grotesk text-[11px] uppercase tracking-wider transition hover:opacity-85 whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
              color: "#FFFFFF",
              boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
            }}
          >
            Launch App
          </a>
        </header>

        {/* ── HERO CONTENT ── */}
        {/*
          Mobile: centered vertically and horizontally
          Desktop: centered, larger font
        */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center px-5 sm:px-8 lg:px-14 pb-28">

          {/* tag */}
          <p
            className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] mb-4 flex items-center gap-2 justify-center"
            style={{ color: "#8B5CF6" }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: "#8B5CF6" }} />
            Powered by $ANAGO · Live on Monad
          </p>

          {/* headline — bigger on desktop */}
          <h1
            className="font-grotesk uppercase leading-[0.9] tracking-tight"
            style={{ fontSize: "clamp(38px, 6.5vw, 80px)" }}
          >
            <span className="block shimmer-text">Every token</span>
            <span className="block shimmer-text">needs a home.</span>
          </h1>

          {/* cycling utility word */}
          <div className="mt-5 flex items-center gap-2 justify-center">
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-cream/35">
              Built for
            </span>
            <span className="font-grotesk uppercase text-[14px] sm:text-[16px] tracking-wider">
              <CyclingWord />
            </span>
          </div>

          {/* sub */}
          <p className="font-mono text-[10px] sm:text-[11px] text-cream/35 tracking-wide mt-3 max-w-xs">
            One protocol, one roof — on Monad.
          </p>

          {/* TVL — bottom-right always */}
          <div
            className="absolute bottom-6 right-5 sm:right-8 lg:right-14 flex flex-col items-end gap-0.5 pointer-events-none"
            aria-hidden="true"
          >
            <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.25em] text-cream/35">Total Value Locked</span>
            <span
              className="font-grotesk leading-none text-cream"
              style={{ fontSize: "clamp(40px, 5.5vw, 72px)", opacity: 0.55, fontWeight: 900 }}
            >
              {tvlDisplay}
            </span>
            <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-cream/25">
              across all products
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER — directly after hero
      ══════════════════════════════════════ */}
      <footer style={{ background: "#000000", borderTop: "1px solid rgba(139,92,246,0.08)" }}>
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 py-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="w-6 h-6 rounded-md opacity-50" />
            <div>
              <span className="font-grotesk uppercase text-[11px] tracking-wider text-cream/35 block">
                The Dog House
              </span>
              <span className="font-mono text-[9px] text-cream/18 uppercase tracking-widest">
                © 2026 · Powered by $ANAGO
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="#" aria-label="X (Twitter)"
              className="w-8 h-8 rounded-full flex items-center justify-center text-cream/30 hover:text-cream/70 transition"
              style={{ border: "1px solid rgba(139,92,246,0.14)", background: "rgba(139,92,246,0.04)" }}>
              <XIcon className="w-3 h-3" />
            </a>
            <a href="#" aria-label="Telegram"
              className="w-8 h-8 rounded-full flex items-center justify-center text-cream/30 hover:text-cream/70 transition"
              style={{ border: "1px solid rgba(139,92,246,0.14)", background: "rgba(139,92,246,0.04)" }}>
              <Send className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
