import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  LogOut,
  Settings2,
  User,
} from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

function shorten(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Deterministic avatar from wallet address — always GZ purple (never green/gold hues). */
function WalletAvatar({ address, size = 32 }: { address: string; size?: number }) {
  const seed = parseInt(address.slice(2, 10), 16);
  const monogram = address.slice(2, 4).toUpperCase();
  const hue = 262 + (seed % 22);
  const lightTop = 48 + (seed % 10);
  const lightBot = 32 + (seed % 8);

  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-mono font-bold uppercase"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        color: "#EDE0FF",
        background: `linear-gradient(145deg, hsl(${hue}, 55%, ${lightTop}%) 0%, hsl(${hue + 8}, 50%, ${lightBot}%) 100%)`,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 2px rgba(155,127,212,0.45)",
      }}
      aria-hidden
    >
      {monogram}
    </div>
  );
}

const pillBase =
  "flex items-center gap-2 rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#9B7FD4]/50";

const pillStyle = {
  background: "rgba(42, 31, 107, 0.55)",
  border: "1px solid rgba(155, 127, 212, 0.38)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
} as const;

const pillHover = "hover:border-[rgba(155,127,212,0.55)] hover:bg-[rgba(91,79,232,0.22)]";

const menuPanelStyle = {
  background: "#120E1F",
  border: "1px solid rgba(155,127,212,0.28)",
  color: "#EDE0FF",
} as const;

/**
 * Profile-style wallet control: avatar, address, menu (account / copy / explorer / disconnect).
 * Uses a lightweight menu (no Radix dropdown) to avoid focus-trap loops with wallet extensions.
 */
export function WalletStatusPill() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        onClick={() => open()}
        className={`${pillBase} ${pillHover} pl-1.5 pr-4 py-1.5`}
        style={pillStyle}
        aria-label="Connect wallet"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "rgba(155,127,212,0.15)",
            border: "1px solid rgba(155,127,212,0.35)",
          }}
        >
          <User className="w-4 h-4" style={{ color: "#9B7FD4" }} />
        </span>
        <span className="font-grotesk text-[11px] uppercase tracking-wider" style={{ color: "#EDE0FF" }}>
          Connect
        </span>
      </button>
    );
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${pillBase} ${pillHover} pl-1 pr-2.5 py-1 gap-2`}
        style={pillStyle}
        aria-label="Wallet profile menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <WalletAvatar address={address} size={32} />
        <span
          className="hidden sm:inline font-mono text-[11px] tracking-tight"
          style={{ color: "#EDE0FF" }}
        >
          {shorten(address)}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 opacity-70 transition-transform ${menuOpen ? "rotate-180" : ""}`}
          style={{ color: "#C4A8F0" }}
          aria-hidden
        />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-xl p-1.5 shadow-xl"
          style={menuPanelStyle}
        >
          <div className="px-2 py-2">
            <div className="flex items-center gap-3">
              <WalletAvatar address={address} size={40} />
              <div className="min-w-0">
                <p className="font-grotesk text-[12px] uppercase tracking-wide" style={{ color: "#C4A8F0" }}>
                  Wallet
                </p>
                <p className="font-mono text-[11px] truncate" style={{ color: "#EDE0FF" }}>
                  {shorten(address)}
                </p>
              </div>
            </div>
          </div>

          <div className="my-1 h-px" style={{ background: "rgba(155,127,212,0.15)" }} />

          <ProfileMenuItem
            icon={<Settings2 className="w-4 h-4" />}
            label="Wallet settings"
            onClick={() => {
              closeMenu();
              open({ view: "Account" });
            }}
          />
          <ProfileMenuItem
            icon={<Copy className="w-4 h-4" />}
            label={copied ? "Copied!" : "Copy address"}
            onClick={() => void copyAddress()}
          />
          <ProfileMenuItem
            icon={<ExternalLink className="w-4 h-4" />}
            label="View on Explorer"
            onClick={() => {
              closeMenu();
              window.open(`https://monadexplorer.com/address/${address}`, "_blank", "noopener");
            }}
          />

          <div className="my-1 h-px" style={{ background: "rgba(155,127,212,0.15)" }} />

          <ProfileMenuItem
            icon={<LogOut className="w-4 h-4" />}
            label="Disconnect"
            destructive
            onClick={() => {
              closeMenu();
              disconnect();
            }}
          />
        </div>
      )}
    </div>
  );
}

function ProfileMenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer font-mono text-[11px] outline-none hover:bg-[rgba(155,127,212,0.18)] text-left"
      style={{ color: destructive ? "#F87171" : "#EDE0FF" }}
    >
      <span style={{ color: destructive ? "#F87171" : "#9B7FD4" }}>{icon}</span>
      {label}
    </button>
  );
}
