import { Globe, Send } from "lucide-react";
import type { DexTokenLink, DexTokenProfile } from "@/lib/web3/dexscreenerProfile";

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
      return <XIcon className="w-3 h-3" />;
    case "telegram":
      return <Send className="w-3 h-3" />;
    case "website":
      return <Globe className="w-3 h-3" />;
    default:
      return <Globe className="w-3 h-3" />;
  }
}

export function TokenDexProfileSection({
  profile,
  loading,
  compact,
}: {
  profile: DexTokenProfile | null;
  loading?: boolean;
  compact?: boolean;
}) {
  if (loading && !profile) {
    return (
      <div
        className={`rounded-lg animate-pulse ${compact ? "h-10 mt-3" : "h-16 mt-4"}`}
        style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}
      />
    );
  }

  if (!profile) return null;

  const { description, headerImage, links, dexscreenerUrl } = profile;
  const hasBio = !!description?.trim();
  const hasLinks = links.length > 0 || !!dexscreenerUrl;
  if (!hasBio && !hasLinks && !headerImage) return null;

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      {headerImage && !compact && (
        <div
          className="rounded-lg overflow-hidden mb-3 h-[72px] sm:h-[88px] bg-cover bg-center"
          style={{
            backgroundImage: `url(${headerImage})`,
            border: "1px solid rgba(139,92,246,0.2)",
          }}
          role="img"
          aria-label="Token banner"
        />
      )}

      {hasBio && (
        <p
          className="font-mono text-[10px] leading-relaxed mb-3 line-clamp-4"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          {description}
        </p>
      )}

      {hasLinks && (
        <div className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition hover:opacity-90"
              style={{
                color: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(139,92,246,0.35)",
                background: "rgba(139,92,246,0.1)",
              }}
              title={link.url}
            >
              <SocialIcon kind={link.kind} />
              {link.label}
            </a>
          ))}
          {dexscreenerUrl && (
            <a
              href={dexscreenerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition hover:opacity-90"
              style={{
                color: "#A78BFA",
                border: "1px solid rgba(139,92,246,0.45)",
                background: "rgba(139,92,246,0.14)",
              }}
            >
              DexScreener
            </a>
          )}
        </div>
      )}
    </div>
  );
}
