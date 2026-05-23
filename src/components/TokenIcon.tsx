import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { fetchTokenFromDexScreener } from "@/lib/web3/dexscreener";

/**
 * Token icon — DexScreener logo, then on-chain logoURI/tokenURI/contractURI, then letter fallback.
 */
export function TokenIcon({
  address,
  symbol,
  size = 28,
  logoUrl: logoUrlProp,
}: {
  address: string;
  symbol?: string;
  size?: number;
  logoUrl?: string | null;
}) {
  const publicClient = usePublicClient();
  const [logoUrl, setLogoUrl] = useState<string | null>(logoUrlProp ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (logoUrlProp) {
      setLogoUrl(logoUrlProp);
      setFailed(false);
      return;
    }
    if (!address || address === "0x0000000000000000000000000000000000000000") return;
    let cancelled = false;
    setFailed(false);

    fetchTokenFromDexScreener(address, publicClient).then((data) => {
      if (!cancelled && data?.logoURI) setLogoUrl(data.logoURI);
    });

    return () => { cancelled = true; };
  }, [address, publicClient, logoUrlProp]);

  const letter = (symbol || address?.slice(0, 2) || "?")[0].toUpperCase();

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={symbol || "token"}
        width={size}
        height={size}
        className="rounded-full shrink-0"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-grotesk shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: "rgba(155,127,212,0.15)",
        border: "1px solid rgba(155,127,212,0.35)",
        color: "rgba(196,168,240,0.85)",
      }}
    >
      {letter}
    </div>
  );
}
