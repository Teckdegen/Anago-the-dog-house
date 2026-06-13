import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Copy, Coins, LogOut, Settings2 } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { explorerAddressUrl } from "@/lib/web3/explorer";
import { useIsProtocolOwner } from "@/lib/web3/useProtocolOwner";
import { ClaimFeesModal } from "./ClaimFeesModal";

function shorten(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const triggerClass =
  "flex items-center gap-1 font-mono text-[11px] tracking-tight transition hover:opacity-80 outline-none focus-visible:opacity-100";

const menuPanelStyle = {
  background: "#120E1F",
  border: "1px solid rgba(139,92,246,0.28)",
  color: "#FFFFFF",
} as const;

/**
 * Wallet control: address only in the header; menu for account / copy / explorer / disconnect.
 */
export function WalletStatusPill() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { isProtocolOwner } = useIsProtocolOwner();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feesOpen, setFeesOpen] = useState(false);
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
        className={`${triggerClass} uppercase font-grotesk text-[11px] tracking-wider`}
        style={{ color: "#FFFFFF" }}
        aria-label="Connect wallet"
      >
        Connect
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
        className={triggerClass}
        style={{ color: "#FFFFFF" }}
        aria-label="Wallet menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span>{shorten(address)}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 opacity-60 transition-transform ${menuOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-xl p-1.5 shadow-xl"
          style={menuPanelStyle}
        >
          <div className="px-2.5 py-2">
            <p className="font-mono text-[11px] break-all" style={{ color: "#FFFFFF" }}>
              {address}
            </p>
          </div>

          <div className="my-1 h-px" style={{ background: "rgba(139,92,246,0.15)" }} />

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
            label="View on Explorer"
            onClick={() => {
              closeMenu();
              window.open(explorerAddressUrl(address), "_blank", "noopener");
            }}
          />
          {isProtocolOwner && (
            <ProfileMenuItem
              icon={<Coins className="w-4 h-4" />}
              label="Claim fees"
              onClick={() => {
                closeMenu();
                setFeesOpen(true);
              }}
            />
          )}

          <div className="my-1 h-px" style={{ background: "rgba(139,92,246,0.15)" }} />

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

      <ClaimFeesModal open={feesOpen} onClose={() => setFeesOpen(false)} />
    </div>
  );
}

function ProfileMenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer font-mono text-[11px] outline-none hover:bg-[rgba(139,92,246,0.18)] text-left"
      style={{ color: destructive ? "#F87171" : "#FFFFFF" }}
    >
      {icon != null && (
        <span style={{ color: destructive ? "#F87171" : "#8B5CF6" }}>{icon}</span>
      )}
      {label}
    </button>
  );
}
