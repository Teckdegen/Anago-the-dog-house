/** DexScreener chart embed for a Monad pool / pair address. */

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
