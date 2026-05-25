import { useState, type ReactNode } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function shorten(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Deterministic avatar from wallet address (GZ purple palette). */
function WalletAvatar({ address, size = 32 }: { address: string; size?: number }) {
  const seed = parseInt(address.slice(2, 10), 16);
  const hue = seed % 360;
  const monogram = address.slice(2, 4).toUpperCase();

  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-mono font-bold uppercase"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        color: "#EDE0FF",
        background: `linear-gradient(145deg, hsl(${hue}, 48%, 38%) 0%, hsl(${(hue + 55) % 360}, 42%, 28%) 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 0 0 2px rgba(155,127,212,0.35)",
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

/**
 * Profile-style wallet control: avatar, address, menu (account / copy / explorer / disconnect).
 */
export function WalletStatusPill() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);

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
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`${pillBase} ${pillHover} pl-1 pr-2.5 py-1 gap-2`}
          style={pillStyle}
          aria-label="Wallet profile menu"
        >
          <WalletAvatar address={address} size={32} />
          <span
            className="hidden sm:inline font-mono text-[11px] tracking-tight"
            style={{ color: "#EDE0FF" }}
          >
            {shorten(address)}
          </span>
          <ChevronDown
            className="w-3.5 h-3.5 shrink-0 opacity-70"
            style={{ color: "#C4A8F0" }}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[220px] rounded-xl p-1.5 border-0 shadow-xl"
        style={{
          background: "#120E1F",
          border: "1px solid rgba(155,127,212,0.28)",
          color: "#EDE0FF",
        }}
      >
        <DropdownMenuLabel className="px-2 py-2 font-normal">
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
        </DropdownMenuLabel>

        <DropdownMenuSeparator style={{ background: "rgba(155,127,212,0.15)" }} />

        <ProfileMenuItem
          icon={<Settings2 className="w-4 h-4" />}
          label="Wallet settings"
          onClick={() => open({ view: "Account" })}
        />
        <ProfileMenuItem
          icon={<Copy className="w-4 h-4" />}
          label={copied ? "Copied!" : "Copy address"}
          onClick={() => void copyAddress()}
        />
        <ProfileMenuItem
          icon={<ExternalLink className="w-4 h-4" />}
          label="View on Explorer"
          onClick={() => window.open(`https://monadexplorer.com/address/${address}`, "_blank", "noopener")}
        />

        <DropdownMenuSeparator style={{ background: "rgba(155,127,212,0.15)" }} />

        <ProfileMenuItem
          icon={<LogOut className="w-4 h-4" />}
          label="Disconnect"
          destructive
          onClick={() => disconnect()}
        />
      </DropdownMenuContent>
    </DropdownMenu>
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
    <DropdownMenuItem
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer font-mono text-[11px] outline-none focus:bg-[rgba(155,127,212,0.18)]"
      style={{ color: destructive ? "#F87171" : "#EDE0FF" }}
    >
      <span style={{ color: destructive ? "#F87171" : "#9B7FD4" }}>{icon}</span>
      {label}
    </DropdownMenuItem>
  );
}
