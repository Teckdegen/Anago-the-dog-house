/** Embed URLs for external chart providers (pool / pair address on Monad). */

const MONAD_CHAIN = "monad";

export function dexscreenerEmbedUrl(poolAddress: string): string {
  const pair = poolAddress.toLowerCase();
  const params = new URLSearchParams({
    embed: "1",
    theme: "dark",
    trades: "0",
    info: "0",
  });
  return `https://dexscreener.com/${MONAD_CHAIN}/${pair}?${params}`;
}

export function dexscreenerPageUrl(poolAddress: string): string {
  return `https://dexscreener.com/${MONAD_CHAIN}/${poolAddress.toLowerCase()}`;
}

/** TradingView Advanced Chart widget (iframe) — symbol must exist on TradingView. */
export function tradingViewEmbedUrl(symbol: string): string {
  const config = {
    autosize: true,
    symbol,
    interval: "15",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    enable_publishing: false,
    backgroundColor: "#0C0818",
    gridColor: "rgba(155, 127, 212, 0.15)",
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    allow_symbol_change: true,
  };
  return `https://s.tradingview.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(JSON.stringify(config))}`;
}

/** Candidate TV symbols for a Monad DEX pair (try in order). */
export function tradingViewSymbolCandidates(
  symbol0: string,
  symbol1: string,
  poolAddress: string,
): string[] {
  const base = symbol0.trim().toUpperCase();
  const quote = symbol1.trim().toUpperCase();
  const pair = poolAddress.toLowerCase();
  const out: string[] = [];
  const add = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };
  if (base && quote) {
    add(`DEXSCREENER:${base}${quote}`);
    add(`DEXSCREENER:${base}/${quote}`);
    add(`DEXSCREENER:MONAD:${pair}`);
    add(`DEXSCREENER:${base}_${quote}`);
  }
  add(`DEXSCREENER:MONAD:${pair}`);
  return out;
}

export function tradingViewSearchUrl(symbol0: string, symbol1: string): string {
  const q = encodeURIComponent(`${symbol0} ${symbol1} monad`);
  return `https://www.tradingview.com/chart/?symbol=${q}`;
}
