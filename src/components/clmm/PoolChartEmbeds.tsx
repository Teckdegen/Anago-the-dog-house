import { useMemo } from "react";
import { dexscreenerEmbedUrl } from "@/lib/web3/chartEmbeds";
import { clmm } from "./clmmTheme";

const CHART_HEIGHT = 420;

export function PoolChartEmbeds({ poolAddress }: { poolAddress: `0x${string}` }) {
  const embedUrl = useMemo(() => dexscreenerEmbedUrl(poolAddress), [poolAddress]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: clmm.panel, border: `1px solid ${clmm.border}` }}
    >
      <div
        className="relative w-full"
        style={{ height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}
      >
        <iframe
          title="Pool chart"
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
          allow="clipboard-write; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        />
      </div>
    </div>
  );
}
