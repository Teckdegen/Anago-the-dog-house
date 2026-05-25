import { useEffect, useState } from "react";
import { TokenIcon } from "@/components/TokenIcon";
import { fetchPairFromDexScreener } from "@/lib/web3/dexscreener";
import { feeToPercent, type PoolLiveState } from "@/lib/capricorn";

export function PoolPairHeader({
  live,
  poolAddress,
}: {
  live: PoolLiveState;
  poolAddress: `0x${string}`;
}) {
  const [pairImage, setPairImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPairFromDexScreener(poolAddress).then((data) => {
      if (!cancelled && data?.imageUrl) setPairImage(data.imageUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [poolAddress]);

  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(155,127,212,0.35)", background: "rgba(155,127,212,0.05)" }}>
      <div className="flex items-start gap-4">
        {pairImage ? (
          <img
            src={pairImage}
            alt={`${live.token0Symbol}/${live.token1Symbol}`}
            className="w-14 h-14 rounded-xl shrink-0 object-cover"
            style={{ border: "1px solid rgba(155,127,212,0.35)" }}
            onError={() => setPairImage(null)}
          />
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <TokenIcon address={live.pool.token0} symbol={live.token0Symbol} size={36} />
            <TokenIcon address={live.pool.token1} symbol={live.token1Symbol} size={36} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-grotesk text-[20px] font-medium" style={{ color: "#EDE0FF" }}>
              {live.token0Symbol} / {live.token1Symbol}
            </p>
            <span className="font-mono text-[10px] px-2 py-1 rounded" style={{ background: "rgba(155,127,212,0.15)", color: "#C4A8F0" }}>
              {feeToPercent(live.pool.fee)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.55)" }}>
            <div>
              <span className="opacity-60">Tick </span>
              <span style={{ color: "#EDE0FF" }}>{live.tick}</span>
            </div>
            <div>
              <span className="opacity-60">Liquidity </span>
              <span style={{ color: "#EDE0FF" }}>{live.liquidity.toString().slice(0, 14)}…</span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="opacity-60">Price </span>
              <span style={{ color: "#EDE0FF" }}>
                1 {live.token0Symbol} ≈ {live.price < 0.0001 ? live.price.toExponential(4) : live.price.toFixed(6)} {live.token1Symbol}
              </span>
            </div>
          </div>
          <a
            href={`https://monadexplorer.com/address/${poolAddress}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 font-mono text-[9px] hover:underline truncate max-w-full"
            style={{ color: "rgba(196,168,240,0.45)" }}
          >
            {poolAddress}
          </a>
        </div>
      </div>
    </div>
  );
}
