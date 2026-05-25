import { TokenIcon } from "@/components/TokenIcon";
import { clmm } from "./clmmTheme";

const MONAD_LIKE = new Set(["MON", "WMON", "W.MON", "WETH"]);

/** Use the other token's logo when this side has none (e.g. MON + meme pair). */
function resolveLogo(
  symbol: string,
  own: string | null | undefined,
  partner: string | null | undefined,
): string | null | undefined {
  if (own) return own;
  if (partner) return partner;
  const s = symbol?.toUpperCase() ?? "";
  if (MONAD_LIKE.has(s)) return partner ?? null;
  return partner ?? null;
}

export function PoolPairLogos({
  token0,
  token1,
  symbol0,
  symbol1,
  logo0,
  logo1,
  size = 28,
}: {
  token0: `0x${string}`;
  token1: `0x${string}`;
  symbol0: string;
  symbol1: string;
  logo0: string | null | undefined;
  logo1: string | null | undefined;
  size?: number;
}) {
  const resolved0 = resolveLogo(symbol0, logo0, logo1);
  const resolved1 = resolveLogo(symbol1, logo1, logo0);
  const overlap = Math.round(size * 0.46);
  const stackTop = Math.round(size * 0.2);

  return (
    <div className="relative flex shrink-0" style={{ width: size + overlap, height: size }}>
      <TokenIcon
        address={token0}
        symbol={symbol0}
        size={size}
        logoUrl={resolved0}
        fallbackLogoUrl={logo1 ?? undefined}
      />
      <div
        className="absolute rounded-full"
        style={{ left: overlap, top: stackTop, boxShadow: `0 0 0 2px ${clmm.bg}` }}
      >
        <TokenIcon
          address={token1}
          symbol={symbol1}
          size={size}
          logoUrl={resolved1}
          fallbackLogoUrl={logo0 ?? undefined}
        />
      </div>
    </div>
  );
}
