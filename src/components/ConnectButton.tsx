import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  return (
    <button
      onClick={() => open()}
      className="rounded-full px-4 py-2 font-grotesk text-[11px] uppercase tracking-wider transition hover:bg-white/[0.06]"
      style={{
        background: "rgba(139,92,246,0.1)",
        color: "#FFFFFF",
        border: "1px solid rgba(139,92,246,0.35)",
      }}
    >
      {isConnected && address ? shorten(address) : "Connect"}
    </button>
  );
}
