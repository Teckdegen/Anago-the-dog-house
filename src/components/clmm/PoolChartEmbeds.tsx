import { useMemo, useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import {
  dexscreenerEmbedUrl,
  dexscreenerPageUrl,
  tradingViewEmbedUrl,
  tradingViewSearchUrl,
  tradingViewSymbolCandidates,
} from "@/lib/web3/chartEmbeds";
import { clmm } from "./clmmTheme";

type ChartSource = "dexscreener" | "tradingview";

const CHART_HEIGHT = 420;

export function PoolChartEmbeds({
  poolAddress,
  symbol0,
  symbol1,
}: {
  poolAddress: `0x${string}`;
  symbol0: string;
  symbol1: string;
}) {
  const [source, setSource] = useState<ChartSource>("dexscreener");
  const [tvSymbolIdx, setTvSymbolIdx] = useState(0);

  const dexEmbed = useMemo(() => dexscreenerEmbedUrl(poolAddress), [poolAddress]);
  const dexPage = useMemo(() => dexscreenerPageUrl(poolAddress), [poolAddress]);

  const tvSymbols = useMemo(
    () => tradingViewSymbolCandidates(symbol0, symbol1, poolAddress),
    [symbol0, symbol1, poolAddress],
  );
  const tvSymbol = tvSymbols[tvSymbolIdx] ?? tvSymbols[0] ?? "DEXSCREENER:MONAD";
  const tvEmbed = useMemo(() => tradingViewEmbedUrl(tvSymbol), [tvSymbol]);
  const tvSearch = useMemo(() => tradingViewSearchUrl(symbol0, symbol1), [symbol0, symbol1]);

  const iframeSrc = source === "dexscreener" ? dexEmbed : tvEmbed;
  const externalHref = source === "dexscreener" ? dexPage : tvSearch;

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 min-h-[360px] flex flex-col"
      style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="font-grotesk text-[18px] font-medium" style={{ color: clmm.text }}>
            {symbol0} / {symbol1}
          </p>
          <p className="font-mono text-[10px] mt-0.5" style={{ color: clmm.textDim }}>
            Live chart · {source === "dexscreener" ? "DexScreener" : "TradingView"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SourcePill active={source === "dexscreener"} onClick={() => setSource("dexscreener")}>
            DexScreener
          </SourcePill>
          <SourcePill active={source === "tradingview"} onClick={() => setSource("tradingview")}>
            TradingView
          </SourcePill>
        </div>
      </div>

      {source === "tradingview" && tvSymbols.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tvSymbols.map((sym, i) => (
            <button
              key={sym}
              type="button"
              onClick={() => setTvSymbolIdx(i)}
              className="px-2 py-1 rounded-md font-mono text-[9px] max-w-[200px] truncate transition"
              style={
                tvSymbolIdx === i
                  ? { background: clmm.purpleBgHover, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }
                  : { color: clmm.textMuted, border: `1px solid transparent` }
              }
              title={sym}
            >
              {sym.replace("DEXSCREENER:", "")}
            </button>
          ))}
        </div>
      )}

      <div
        className="relative w-full rounded-xl overflow-hidden flex-1"
        style={{ height: CHART_HEIGHT, minHeight: CHART_HEIGHT, border: `1px solid ${clmm.border}` }}
      >
        <iframe
          key={`${source}-${tvSymbol}`}
          title={source === "dexscreener" ? "DexScreener chart" : "TradingView chart"}
          src={iframeSrc}
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
          allow="clipboard-write; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <p className="font-mono text-[9px]" style={{ color: clmm.textDim }}>
          {source === "dexscreener"
            ? "DexScreener embed — real volume & candles for this pool on Monad."
            : "TradingView widget — pick another symbol chip if the chart is empty."}
        </p>
        <a
          href={externalHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] hover:underline shrink-0"
          style={{ color: clmm.accent }}
        >
          Open full chart
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function SourcePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full font-mono text-[10px] transition"
      style={
        active
          ? { background: clmm.purpleBgHover, color: clmm.text, border: `1px solid ${clmm.borderStrong}` }
          : { color: clmm.textMuted, border: `1px solid transparent` }
      }
    >
      {children}
    </button>
  );
}
