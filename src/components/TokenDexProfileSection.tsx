import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Copy, Globe, Send, UserRound } from "lucide-react";
import type { DexTokenLink, DexTokenProfile } from "@/lib/web3/dexscreenerProfile";
import { TokenIcon } from "@/components/TokenIcon";

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SocialIcon({ kind }: { kind: DexTokenLink["kind"] }) {
  switch (kind) {
    case "twitter":
      return <UserRound className="w-4 h-4" strokeWidth={1.75} />;
    case "telegram":
      return <Send className="w-4 h-4" strokeWidth={1.75} />;
    case "website":
      return <Globe className="w-4 h-4" strokeWidth={1.75} />;
    default:
      return <Globe className="w-4 h-4" strokeWidth={1.75} />;
  }
}

function socialBarLabel(kind: DexTokenLink["kind"], label: string): string {
  if (kind === "twitter") return "Twitter";
  if (kind === "telegram") return "Telegram";
  if (kind === "website") return "Website";
  if (kind === "discord") return "Discord";
  return label;
}

const LINK_ORDER: DexTokenLink["kind"][] = ["website", "twitter", "telegram", "discord", "other"];

function sortLinks(links: DexTokenLink[]): DexTokenLink[] {
  return [...links].sort((a, b) => LINK_ORDER.indexOf(a.kind) - LINK_ORDER.indexOf(b.kind));
}

function SocialBar({ links, dexscreenerUrl }: { links: DexTokenLink[]; dexscreenerUrl: string | null }) {
  const [extraOpen, setExtraOpen] = useState(false);
  const sorted = useMemo(() => sortLinks(links), [links]);
  const primary = sorted.slice(0, 3);
  const extra = sorted.slice(3);

  if (!primary.length && !dexscreenerUrl) return null;

  return (
    <div
      className="relative flex items-stretch"
      style={{ background: "rgba(0,0,0,0.55)", borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      {primary.map((link, i) => (
        <div key={link.url} className="flex flex-1 min-w-0 items-stretch">
          {i > 0 && <div className="w-px shrink-0 self-stretch" style={{ background: "rgba(255,255,255,0.1)" }} />}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 min-w-0 items-center justify-center gap-2 px-2 py-3.5 font-mono text-[14px] transition hover:bg-white/[0.04]"
            style={{ color: "rgba(255,255,255,0.82)" }}
            title={link.url}
          >
            <SocialIcon kind={link.kind} />
            <span className="truncate">{socialBarLabel(link.kind, link.label)}</span>
          </a>
        </div>
      ))}

      {(extra.length > 0 || dexscreenerUrl) && (
        <>
          {primary.length > 0 && (
            <div className="w-px shrink-0 self-stretch" style={{ background: "rgba(255,255,255,0.1)" }} />
          )}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setExtraOpen((v) => !v)}
              className="flex h-full items-center justify-center px-3 py-3 transition hover:bg-white/[0.04]"
              style={{ color: "rgba(255,255,255,0.55)" }}
              aria-label="More links"
            >
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{ transform: extraOpen ? "rotate(180deg)" : undefined }}
              />
            </button>
            {extraOpen && (
              <div
                className="absolute right-0 bottom-full z-20 mb-1 min-w-[180px] rounded-lg py-1 shadow-xl"
                style={{ background: "#141418", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {extra.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 font-mono text-[13px] transition hover:bg-white/[0.05]"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    <SocialIcon kind={link.kind} />
                    {socialBarLabel(link.kind, link.label)}
                  </a>
                ))}
                {dexscreenerUrl && (
                  <a
                    href={dexscreenerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 font-mono text-[13px] transition hover:bg-white/[0.05]"
                    style={{ color: "#A78BFA" }}
                  >
                    <XIcon className="w-3.5 h-3.5" />
                    DexScreener
                  </a>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TokenDexProfileSection({
  profile,
  loading,
  symbol,
  name,
  logoUrl,
  tokenAddress,
  actions,
}: {
  profile: DexTokenProfile | null;
  loading?: boolean;
  symbol: string;
  name?: string | null;
  logoUrl?: string | null;
  tokenAddress: string;
  actions?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const displayName = profile?.name?.trim() || name?.trim() || `${symbol} Farm`;
  const pairSymbol = profile?.symbol?.trim() || symbol;
  const quoteSymbol = profile?.quoteSymbol?.trim() || "MON";
  const dexLabel = profile?.dexLabel;
  const headerImage = profile?.headerImage;
  const icon = logoUrl || profile?.icon;

  const copyAddress = () => {
    void navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (loading && !profile) {
    return (
      <div className="animate-pulse">
        <div className="px-4 py-3.5 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="w-10 h-10 rounded-lg shrink-0" style={{ background: "rgba(139,92,246,0.15)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded" style={{ background: "rgba(139,92,246,0.15)" }} />
            <div className="h-2.5 w-44 rounded" style={{ background: "rgba(139,92,246,0.1)" }} />
          </div>
        </div>
        <div className="aspect-[3/1] w-full" style={{ background: "rgba(139,92,246,0.08)" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Top — identity, pool pair, and actions (farm stats / deposit) */}
      <div
        className="px-4 py-3.5"
        style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="shrink-0">
              <TokenIcon address={tokenAddress} symbol={pairSymbol} size={40} logoUrl={icon} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="font-grotesk text-[18px] sm:text-[20px] font-semibold tracking-tight truncate leading-tight"
                style={{ color: "#FFFFFF" }}
              >
                {displayName}
              </p>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 font-mono text-[13px] sm:text-[14px]" style={{ color: "#FFFFFF" }}>
                <span>{pairSymbol}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="inline-flex items-center transition hover:opacity-80"
                  style={{ color: copied ? "#A78BFA" : "rgba(255,255,255,0.35)" }}
                  title="Copy token address"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>/</span>
                <span>{quoteSymbol}</span>
                <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                <span style={{ color: "rgba(255,255,255,0.45)" }}>Monad</span>
                {dexLabel && (
                  <>
                    <span style={{ color: "rgba(255,255,255,0.25)" }}>{'\u203A'}</span>
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>{dexLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {actions && (
            <div className="flex flex-col items-end gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2.5 sm:shrink-0 sm:max-w-[55%] sm:w-auto">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Banner — full bleed between header and footer */}
      {headerImage ? (
        <div
          className="relative w-full aspect-[3/1] bg-cover bg-center"
          style={{ backgroundImage: `url(${headerImage})` }}
          role="img"
          aria-label={`${displayName} banner`}
        />
      ) : profile && (profile.links.length > 0 || profile.description?.trim()) ? (
        <div
          className="w-full aspect-[3/1]"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(10,10,12,0.95) 100%)",
          }}
        />
      ) : null}

      {profile?.description?.trim() && (
        <p
          className="px-4 py-3 font-mono text-[13px] leading-relaxed line-clamp-3 text-center sm:text-left"
          style={{ color: "rgba(255,255,255,0.62)", background: "#0a0a0c", borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {profile.description}
        </p>
      )}

      {profile && (profile.links.length > 0 || profile.dexscreenerUrl) && (
        <SocialBar links={profile.links} dexscreenerUrl={profile.dexscreenerUrl} />
      )}
    </div>
  );
}
