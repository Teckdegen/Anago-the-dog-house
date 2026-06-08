import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { fetchTokenFromDexScreener } from "@/lib/web3/dexscreener";

/**
 * Token icon — Dirol logo, DexScreener fallback, then on-chain URI fields, then letter fallback.
 */
export function TokenIcon({
  address,
  symbol,
  size = 28,
  logoUrl: logoUrlProp,
  fallbackLogoUrl,
  shape = "circle",
}: {
  address: string;
  symbol?: string;
  size?: number;
  logoUrl?: string | null;
  /** Shown when this token has no logo (e.g. partner token image in a CL pair). */
  fallbackLogoUrl?: string | null;
  shape?: "circle" | "rounded";
}) {
  const radiusClass = shape === "rounded" ? "rounded-xl" : "rounded-full";
  const publicClient = usePublicClient();
  const [logoUrl, setLogoUrl] = useState<string | null>(logoUrlProp ?? fallbackLogoUrl ?? null);
  const [failedPrimary, setFailedPrimary] = useState(false);

  useEffect(() => {
    setFailedPrimary(false);
    if (logoUrlProp) {
      setLogoUrl(logoUrlProp);
      return;
    }
    if (fallbackLogoUrl) {
      setLogoUrl(fallbackLogoUrl);
      return;
    }
    setLogoUrl(null);
    if (!address || address === "0x0000000000000000000000000000000000000000") return;
    let cancelled = false;

    fetchTokenFromDexScreener(address, publicClient).then((data) => {
      if (!cancelled && data?.logoURI) setLogoUrl(data.logoURI);
    });

    return () => { cancelled = true; };
  }, [address, publicClient, logoUrlProp, fallbackLogoUrl]);

  const letter = (symbol || address?.slice(0, 2) || "?")[0].toUpperCase();

  const displayUrl =
    failedPrimary && fallbackLogoUrl
      ? fallbackLogoUrl
      : logoUrl || fallbackLogoUrl;

  if (displayUrl && !(failedPrimary && !fallbackLogoUrl)) {
    return (
      <img
        src={displayUrl}
        alt={symbol || "token"}
        width={size}
        height={size}
        className={`${radiusClass} shrink-0 object-cover`}
        style={{ width: size, height: size, border: "1px solid rgba(255,255,255,0.12)" }}
        onError={() => {
          if (!failedPrimary && fallbackLogoUrl && displayUrl !== fallbackLogoUrl) {
            setFailedPrimary(true);
          } else {
            setLogoUrl(null);
            setFailedPrimary(true);
          }
        }}
      />
    );
  }

  return (
    <div
      className={`${radiusClass} flex items-center justify-center font-grotesk shrink-0`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: "rgba(139,92,246,0.15)",
        border: "1px solid rgba(139,92,246,0.35)",
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {letter}
    </div>
  );
}
