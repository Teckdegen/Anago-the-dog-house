import { useLocation } from "@tanstack/react-router";
import { useChainId, useSwitchChain } from "wagmi";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MONAD_CHAIN_ID } from "@/lib/web3/chains";

function SwitchButton({
  chainId,
  label,
  pendingLabel,
}: {
  chainId: number;
  label: string;
  pendingLabel: string;
}) {
  const { switchChain, isPending, error } = useSwitchChain();

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchChain({ chainId })}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-grotesk text-[10px] uppercase tracking-wider transition disabled:opacity-50 shrink-0"
        style={{
          background: "rgba(155,127,212,0.35)",
          color: "#EDE0FF",
          border: "1px solid rgba(155,127,212,0.55)",
        }}
      >
        {isPending ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            {pendingLabel}
          </>
        ) : (
          label
        )}
      </button>
      {error && (
        <p className="font-mono text-[9px] mt-1" style={{ color: "rgba(255,120,120,0.9)" }}>
          {(error as Error).message}
        </p>
      )}
    </div>
  );
}

/** Prompt wallet switch when not on Monad mainnet (143). */
export function NetworkRouteBanner() {
  const { pathname } = useLocation();
  const chainId = useChainId();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [pathname]);

  const onMainnet = chainId === MONAD_CHAIN_ID;

  if (dismissed || onMainnet) return null;

  return (
    <div
      className="relative z-30 px-5 sm:px-8 lg:px-14 py-2.5 flex flex-wrap items-center justify-center gap-3 text-center pr-10"
      style={{
        background: "rgba(155,127,212,0.12)",
        borderBottom: "1px solid rgba(155,127,212,0.28)",
      }}
    >
      <p className="font-mono text-[10px] sm:text-[11px]" style={{ color: "rgba(196,168,240,0.85)" }}>
        The Dog House runs on Monad mainnet (chain 143). Switch your wallet to continue.
      </p>
      <SwitchButton chainId={MONAD_CHAIN_ID} label="Switch to Monad" pendingLabel="Switching…" />
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-60 hover:opacity-100"
        style={{ color: "rgba(196,168,240,0.7)" }}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
