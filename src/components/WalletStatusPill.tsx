import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

function shorten(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * The single Connect / wallet entry point. Clicking it opens the AppKit
 * modal which handles connect, switch network, and disconnect natively.
 */
export function WalletStatusPill() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();

  if (isConnected && address) {
    return (
      <button
        onClick={() => open()}
        className="flex items-center gap-2 rounded-full px-3 py-2 transition hover:bg-white/10"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "#4ade80", boxShadow: "0 0 6px #4ade80" }}
        />
        <span
          className="font-mono text-[10px]"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {shorten(address)}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      className="rounded-full px-4 py-2 font-grotesk text-[11px] uppercase tracking-wider transition hover:bg-white/10"
      style={{
        background: "rgba(255,255,255,0.08)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      Connect
    </button>
  );
}
